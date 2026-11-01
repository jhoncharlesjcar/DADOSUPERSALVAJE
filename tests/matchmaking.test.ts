// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createTestDatabase } from "./helpers/postgres";
import { setTestDatabase } from "../lib/data/database";
import { setTestRedis } from "../lib/data/redis";
import { joinQueue, confirmRoomInTransaction, expireConfirmations, getMatchStatus, leaveQueue, markRoomViewed, rebuildQueueIndex, reconnectRoom, setDisconnected, expireDisconnects } from "../lib/matchmaking";
import { createTeam, joinTeam } from "../lib/teamMode";
import { seedHash } from "../lib/data/fairness";
import { matchUnits, searchRange, type QueueUnit } from "../lib/data/matching";

let db: Awaited<ReturnType<typeof createTestDatabase>>;
let nextDni = 41000000;
async function player(rating = 1200) {
  const dni = String(nextDni++);
  const id = (await db.query<{ id: string }>("INSERT INTO usuarios(dni,nombres) VALUES($1,$2) RETURNING id", [dni, `Persona ${dni}`])).rows[0].id;
  await db.query("INSERT INTO billeteras(usuario_id,disponible_centimos) VALUES($1,10000)", [id]);
  await db.query("INSERT INTO ratings(usuario_id,modo,rating) VALUES($1,'duelo',$2)", [id, rating]);
  return { dni, id };
}
beforeAll(async () => {
  vi.stubEnv("DINERO_REAL_HABILITADO", "false"); vi.stubEnv("MATCHMAKING_MAX_RANGE", "300");
  vi.stubEnv("CONFIRMATION_SECONDS", "30"); vi.stubEnv("CONFIRMATION_PENALTY_SECONDS", "20");
  vi.stubEnv("TEAM_MAX_RATING_DIFFERENCE", "100");
  db = await createTestDatabase({ allMigrations: true }); setTestDatabase(db);
}, 60000);
afterAll(async () => { setTestDatabase(undefined); setTestRedis(undefined); vi.unstubAllEnvs(); await db?.close(); });

describe("cola durable PostgreSQL", () => {
  it("publica compromiso y espera todas las confirmaciones sin cobrar", async () => {
    const a = await player(), b = await player();
    expect(await joinQueue(a.dni, "duelo", 10)).toBeNull();
    const id = await joinQueue(b.dni, "duelo", 10);
    expect(id).toEqual(expect.any(String));
    const row = (await db.query<{ hash_semilla: string; semilla_servidor: string; estado: string }>("SELECT p.hash_semilla,p.estado,s.semilla_servidor FROM partidas p JOIN semillas_partida s ON s.partida_id=p.id WHERE p.id=$1", [id])).rows[0];
    expect(row.estado).toBe("confirmando"); expect(row.hash_semilla).toBe(seedHash(row.semilla_servidor));
    expect((await db.query("SELECT id FROM movimientos")).rowCount).toBe(0);
    expect((await db.transaction(client => confirmRoomInTransaction(client, id!, a.dni))).allConfirmed).toBe(false);
    expect((await db.transaction(client => confirmRoomInTransaction(client, id!, b.dni))).allConfirmed).toBe(true);
    expect((await db.transaction(client => confirmRoomInTransaction(client, id!, b.dni))).allConfirmed).toBe(true);
    expect((await getMatchStatus(a.dni))).toMatchObject({ status: "encontrada", salaId: id, seedHash: row.hash_semilla });
    await expect(db.transaction(client => confirmRoomInTransaction(client, id!, "99999999"))).rejects.toThrow("No autorizado");
    await expect(markRoomViewed(id!, a.dni)).rejects.toThrow();
    await db.query("UPDATE partidas SET estado='finalizada' WHERE id=$1", [id]);
    await markRoomViewed(id!, a.dni);
    expect(await getMatchStatus(a.dni)).toMatchObject({ status: "inactivo" });
  });
  it("vencimiento reencola aceptantes con prioridad y penaliza al ausente sin saldo afectado", async () => {
    const a = await player(), b = await player();
    await joinQueue(a.dni, "duelo", 5); const id = await joinQueue(b.dni, "duelo", 5);
    await db.transaction(client => confirmRoomInTransaction(client, id!, a.dni));
    await db.query("UPDATE partidas SET confirmacion_hasta=now()-interval '1 second' WHERE id=$1", [id]);
    expect(await expireConfirmations()).toBe(1);
    const rows = (await db.query<{ usuario_id: string; prioridad: boolean; penalizado: boolean }>(`SELECT m.usuario_id,q.prioridad,q.disponible_desde>now() AS penalizado FROM queue_units q JOIN queue_members m ON m.unidad_id=q.id WHERE m.usuario_id=ANY($1::uuid[])`, [[a.id, b.id]])).rows;
    expect(rows.find(r => r.usuario_id === a.id)).toMatchObject({ prioridad: true, penalizado: false });
    expect(rows.find(r => r.usuario_id === b.id)).toMatchObject({ prioridad: false, penalizado: true });
    await leaveQueue(a.dni); await leaveQueue(b.dni);
    await joinQueue(b.dni, "duelo", 5);
    expect((await getMatchStatus(b.dni)).status).toBe("buscando");
    expect((await db.query("SELECT id FROM movimientos")).rowCount).toBe(0);
  });
  it("no permite colas duplicadas ni montos, modos o usuarios inválidos", async () => {
    const a = await player();
    await joinQueue(a.dni, "duelo", 2);
    await expect(joinQueue(a.dni, "batalla", 2)).rejects.toThrow("otra cola");
    await expect(joinQueue(a.dni, "duelo", 3)).rejects.toThrow();
    await expect(joinQueue(a.dni, "nada", 2)).rejects.toThrow();
    await expect(joinQueue("bad", "duelo", 2)).rejects.toThrow();
    await db.query("UPDATE billeteras SET disponible_centimos=0 WHERE usuario_id=$1", [a.id]);
    await expect(joinQueue(a.dni, "duelo", 2)).rejects.toThrow("Saldo insuficiente");
    await leaveQueue(a.dni);
  });
  it("crea equipos sin dividir grupos y requiere aceptación individual", async () => {
    const members = await Promise.all(Array.from({ length: 6 }, () => player()));
    const groups = [];
    for (let team = 0; team < 2; team++) {
      const group = await createTeam(`Grupo ${team}`, members[team * 3].dni); groups.push(group);
      await joinTeam(group, members[team * 3 + 1].dni); await joinTeam(group, members[team * 3 + 2].dni);
    }
    expect(await joinQueue(members[0].dni, "equipos_3v3", 20, { groupId: groups[0] })).toBeNull();
    const id = await joinQueue(members[3].dni, "equipos_3v3", 20, { groupId: groups[1] });
    const rows = (await db.query<{ usuario_id: string; equipo: string; confirmado: boolean }>("SELECT usuario_id,equipo,confirmado FROM participantes WHERE partida_id=$1", [id])).rows;
    expect(rows).toHaveLength(6); expect(rows.every(r => !r.confirmado)).toBe(true);
    for (let team = 0; team < 2; team++) expect(new Set(rows.filter(r => members.slice(team * 3, team * 3 + 3).some(m => m.id === r.usuario_id)).map(r => r.equipo)).size).toBe(1);
    const outsider = await player(); await expect(joinTeam(groups[0], outsider.dni)).rejects.toThrow("ya está");
  });
  it("tolera pérdida de Redis y reconstruye únicamente IDs y ratings", async () => {
    const calls: Array<Array<string | number>> = [];
    setTestRedis({ async command<T>(...args: Array<string | number>) { calls.push(args); return 1 as T; } });
    expect(await rebuildQueueIndex("duelo", 500n)).toBe(true);
    expect(calls[0][0]).toBe("EVAL"); expect(JSON.stringify(calls)).not.toContain("disponible_centimos");
    setTestRedis({ async command() { throw new Error("offline"); } });
    expect(await rebuildQueueIndex("duelo", 500n)).toBe(false); setTestRedis(undefined);
  });
  it("reconecta dentro de 60s y congela disputa al vencer sin inventar abandono", async () => {
    const a = await player(), b = await player();
    await joinQueue(a.dni, "duelo", 30); const id = await joinQueue(b.dni, "duelo", 30);
    await db.query("UPDATE partidas SET estado='en_curso' WHERE id=$1", [id]);
    await setDisconnected(id!, a.dni); expect(await reconnectRoom(id!, a.dni)).toBe(true);
    await setDisconnected(id!, a.dni);
    await db.query("UPDATE participantes SET desconectado_en=now()-interval '61 seconds' WHERE partida_id=$1 AND usuario_id=$2", [id, a.id]);
    expect(await reconnectRoom(id!, a.dni)).toBe(false); expect(await expireDisconnects()).toBe(1);
    expect((await db.query<{ estado: string }>("SELECT estado FROM partidas WHERE id=$1", [id])).rows[0].estado).toBe("en_disputa");
  });
});

const unit = (id: string, rating: number, size = 1, joinedAt = 0): QueueUnit => ({ id, rating, joinedAt, priority: false,
  members: Array.from({ length: size }, (_, n) => ({ id: `${id}-${n}`, rating, dadoId: "rojo" })) });
describe("selección por rango y grupos", () => {
  it("amplía 25 cada diez segundos, con tope y rango mutuo", () => {
    expect(searchRange(0, 9999, 150)).toBe(50); expect(searchRange(0, 10000, 150)).toBe(75); expect(searchRange(0, 90000, 150)).toBe(150);
    expect(matchUnits([unit("a", 1200), unit("b", 1300)], "duelo", { maxRange: 150 }, 0)).toBeNull();
    expect(matchUnits([unit("a", 1200), unit("b", 1300)], "duelo", { maxRange: 150 }, 20000)?.units).toHaveLength(2);
    expect(matchUnits([unit("a", 1200), unit("b", 1300, 1, 20000)], "duelo", { maxRange: 150 }, 20000)).toBeNull();
  });
  it("elige los dos más cercanos y no inicia batalla incompleta sin decisión", () => {
    expect(matchUnits([unit("a", 1200), unit("b", 1240), unit("c", 1241)], "duelo", { maxRange: 150 }, 0)?.units.map(u => u.id)).toEqual(["b", "c"]);
    const players = Array.from({ length: 9 }, (_, n) => unit(String(n), 1200));
    expect(matchUnits(players, "batalla", { maxRange: 150 }, 90000)).toBeNull();
    expect(matchUnits(players, "batalla", { maxRange: 150, battleMinimum: 4, battleWaitMs: 10000 }, 90000)?.units).toHaveLength(9);
  });
  it("completa equipos con grupos indivisibles y diferencia configurada", () => {
    const groups = [unit("a", 1200, 2), unit("b", 1200, 2), unit("c", 1200), unit("d", 1200)];
    const found = matchUnits(groups, "equipos_3v3", { maxRange: 150, teamMaxDifference: 0 }, 0)!;
    expect(found.teamA).toHaveLength(3); expect(found.teamB).toHaveLength(3);
    expect(found.teamA.includes("a-0")).toBe(found.teamA.includes("a-1"));
    expect(found.teamB.includes("b-0")).toBe(found.teamB.includes("b-1"));
  });
});
