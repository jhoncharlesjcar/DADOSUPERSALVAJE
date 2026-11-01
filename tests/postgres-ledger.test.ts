// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { createTestDatabase } from "./helpers/postgres";
import { adjustDemoBalance, blockEntries, cancelMatch, disputeMatch, settleMatch } from "../lib/data/ledger";
import { splitPot } from "../lib/data/money";

let db: Awaited<ReturnType<typeof createTestDatabase>>;
let sequence = 41000000;
async function user(balance = 10000n, demo = true) {
  const id = randomUUID();
  await db.query("INSERT INTO usuarios(id,dni,nombres) VALUES($1,$2,'Prueba')", [id, String(sequence++)]);
  await db.query("INSERT INTO billeteras(usuario_id,demo,disponible_centimos) VALUES($1,$2,$3)", [id, demo, balance.toString()]);
  return id;
}
async function match(users: string[], options: { demo?: boolean; confirmed?: boolean; mode?: string } = {}) {
  const id = randomUUID();
  await db.query(`INSERT INTO partidas(id,modo,demo,monto_entrada_centimos,min_jugadores,max_jugadores,estado,hash_semilla)
    VALUES($1,$2,$3,200,$4,$4,'confirmando',$5)`, [id, options.mode ?? "duelo", options.demo ?? true, users.length, "a".repeat(64)]);
  await db.query("INSERT INTO semillas_partida(partida_id,semilla_servidor) VALUES($1,'seed')", [id]);
  for (const [index, uid] of users.entries()) await db.query(`INSERT INTO participantes(partida_id,usuario_id,dado_id,apuesta_centimos,confirmado,equipo)
    VALUES($1,$2,'rojo',200,$3,$4)`, [id, uid, options.confirmed ?? true, options.mode?.startsWith("equipos") ? index < users.length / 2 ? "A" : "B" : null]);
  return id;
}
async function balance(uid: string) {
  return (await db.query<{ disponible_centimos: string; bloqueado_centimos: string }>(
    "SELECT disponible_centimos::text,bloqueado_centimos::text FROM billeteras WHERE usuario_id=$1", [uid])).rows[0];
}
beforeAll(async () => { db = await createTestDatabase(); }, 30000);
afterAll(async () => { await db?.close(); });
describe("PostgreSQL monetary ledger", () => {
  it("distributes odd cents and team residual without losing a cent", () => {
    expect(splitPot(1003n)).toEqual({ ranking: 40n, house: 160n, prize: 803n, each: 803n });
    expect(splitPot(1003n, 3)).toEqual({ ranking: 40n, house: 162n, prize: 801n, each: 267n });
  });
  it("blocks only after every confirmation, settles once and remains zero-sum", async () => {
    const users = [await user(), await user()];
    const id = await match(users, { confirmed: false });
    await expect(db.transaction(c => blockEntries(c, id))).rejects.toThrow("confirmar");
    expect((await balance(users[0])).disponible_centimos).toBe("10000");
    await db.query("UPDATE participantes SET confirmado=true WHERE partida_id=$1", [id]);
    expect(await db.transaction(c => blockEntries(c, id))).toEqual({ replay: false });
    expect(await db.transaction(c => blockEntries(c, id))).toEqual({ replay: true });
    expect(await balance(users[0])).toEqual({ disponible_centimos: "9800", bloqueado_centimos: "200" });
    await expect(db.transaction(c => settleMatch(c, id, [users[0]]))).rejects.toThrow("Ganador");
    await db.query("UPDATE partidas SET ganador_usuario_id=$2 WHERE id=$1", [id, users[0]]);
    const settled = await db.transaction(c => settleMatch(c, id, [users[0]]));
    expect(settled.replay).toBe(false);
    expect(await balance(users[0])).toEqual({ disponible_centimos: "10120", bloqueado_centimos: "0" });
    expect((await db.transaction(c => settleMatch(c, id, [users[0]]))).replay).toBe(true);
    const sum = await db.query<{ total: string }>("SELECT SUM(monto_centimos)::text AS total FROM movimientos WHERE referencia_id=$1", [id]);
    expect(sum.rows[0].total).toBe("0");
    expect((await db.query<{ semilla_revelada: string }>("SELECT semilla_revelada FROM partidas WHERE id=$1", [id])).rows[0].semilla_revelada).toBe("seed");
  });
  it("rolls back every participant on insufficient funds", async () => {
    const users = [await user(), await user(0n)];
    const id = await match(users);
    await expect(db.transaction(c => blockEntries(c, id))).rejects.toThrow("Saldo insuficiente");
    expect(await balance(users[0])).toEqual({ disponible_centimos: "10000", bloqueado_centimos: "0" });
    expect((await db.query("SELECT id FROM movimientos WHERE referencia_id=$1", [id])).rows).toHaveLength(0);
  });
  it("annuls idempotently and refunds reservations", async () => {
    const users = [await user(), await user()]; const id = await match(users);
    await db.transaction(c => blockEntries(c, id));
    await db.transaction(c => cancelMatch(c, id));
    expect((await db.transaction(c => cancelMatch(c, id))).replay).toBe(true);
    expect(await balance(users[0])).toEqual({ disponible_centimos: "10000", bloqueado_centimos: "0" });
  });
  it("keeps disputed funds frozen and records the actor", async () => {
    const users = [await user(), await user()]; const id = await match(users);
    await db.transaction(c => blockEntries(c, id));
    await db.transaction(c => disputeMatch(c, id, "test-admin", "Revisión solicitada"));
    await expect(db.transaction(c => cancelMatch(c, id))).rejects.toThrow("disputa");
    expect((await balance(users[0])).bloqueado_centimos).toBe("200");
    expect((await db.query<{ actor: string }>("SELECT actor FROM auditoria_admin WHERE referencia_id=$1", [id])).rows[0].actor).toBe("test-admin");
  });
  it("does not consume reservations belonging to another match", async () => {
    const users = [await user(), await user()]; const first = await match(users); const other = await match(users);
    await db.transaction(c => blockEntries(c, first));
    await db.query("UPDATE partidas SET estado='en_curso',ganador_usuario_id=$2 WHERE id=$1", [other, users[0]]);
    await expect(db.transaction(c => settleMatch(c, other, [users[0]]))).rejects.toThrow("no fue bloqueada");
    expect((await balance(users[0])).bloqueado_centimos).toBe("200");
  });
  it("distributes the winning team's prize to every member", async () => {
    const users = await Promise.all(Array.from({ length: 6 }, () => user()));
    const id = await match(users, { mode: "equipos_3v3" });
    await db.transaction(c => blockEntries(c, id));
    await db.query("UPDATE partidas SET ganador_equipo='A' WHERE id=$1", [id]);
    await expect(db.transaction(c => settleMatch(c, id, [users[0]]))).rejects.toThrow("Ganador");
    const { split } = await db.transaction(c => settleMatch(c, id, users.slice(0, 3)));
    expect(split.each).toBe(320n);
    for (const uid of users.slice(0, 3)) expect((await balance(uid)).disponible_centimos).toBe("10120");
  });
  it("serializes 100 competing operations without negative balances or duplicate movements", async () => {
    const uid = await user(1000n); const opponent = await user(100000n);
    const ids = [];
    for (let i = 0; i < 100; i++) ids.push(await match([uid, opponent]));
    const attempts = await Promise.allSettled(ids.map(id => db.transaction(c => blockEntries(c, id))));
    expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(5);
    expect(await balance(uid)).toEqual({ disponible_centimos: "0", bloqueado_centimos: "1000" });
    const movements = await db.query<{ count: string; distinct_count: string }>(`SELECT COUNT(*)::text AS count,
      COUNT(DISTINCT clave_idempotencia)::text AS distinct_count FROM movimientos m
      JOIN billeteras b ON b.id=m.billetera_id WHERE b.usuario_id=$1`, [uid]);
    expect(movements.rows[0]).toEqual({ count: "5", distinct_count: "5" });
  }, 30000);
  it("prevents client writes and cross-user reads with RLS", async () => {
    const own = await user(); const other = await user();
    const visible = await db.transaction(async c => {
      await c.query("SET LOCAL ROLE authenticated");
      await c.query("SELECT set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: own })]);
      return c.query<{ usuario_id: string }>("SELECT usuario_id FROM billeteras");
    });
    expect(visible.rows).toEqual([{ usuario_id: own }]);
    await expect(db.transaction(async c => {
      await c.query("SET LOCAL ROLE authenticated");
      await c.query("UPDATE billeteras SET disponible_centimos=100000 WHERE usuario_id=$1", [other]);
    })).rejects.toThrow("permission denied");
    await expect(db.transaction(async c => {
      await c.query("SET LOCAL ROLE anon");
      await c.query("SELECT * FROM semillas_partida");
    })).rejects.toThrow("permission denied");
  });
  it("rejects mutation of ledger and audits demo adjustments idempotently", async () => {
    const uid = await user();
    const adjust = () => db.transaction(c => adjustDemoBalance(c, uid, 75n, `test:${uid}`, "Prueba", "test-admin"));
    await adjust(); await adjust();
    expect((await balance(uid)).disponible_centimos).toBe("10075");
    await expect(db.transaction(c => adjustDemoBalance(c, uid, 76n, `test:${uid}`, "Prueba"))).rejects.toThrow("idempotencia");
    await expect(db.query("UPDATE movimientos SET descripcion='borrado'")).rejects.toThrow("inmutables");
    await expect(db.query("DELETE FROM movimientos")).rejects.toThrow("inmutables");
    await expect(db.query("TRUNCATE movimientos CASCADE")).rejects.toThrow("inmutables");
  });
  it("fails closed for real funds, minors, unverified identity, exclusion and missing loss limits", async () => {
    const users = [await user(10000n, false), await user(10000n, false)];
    const id = await match(users, { demo: false });
    vi.stubEnv("DINERO_REAL_HABILITADO", "false");
    await expect(db.transaction(c => blockEntries(c, id))).rejects.toThrow("deshabilitado");
    vi.stubEnv("DINERO_REAL_HABILITADO", "true");
    await expect(db.transaction(c => blockEntries(c, id))).rejects.toThrow("Identidad");
    await db.query("UPDATE usuarios SET estado_identidad='verificado',fecha_nacimiento='1990-01-01' WHERE id=ANY($1::uuid[])", [users]);
    await db.query("UPDATE usuarios SET fecha_nacimiento=((now() AT TIME ZONE 'America/Lima')::date-interval '18 years'+interval '1 day')::date WHERE id=ANY($1::uuid[])", [users]);
    await expect(db.transaction(c => blockEntries(c, id))).rejects.toThrow("mayoría de edad");
    await db.query("UPDATE usuarios SET fecha_nacimiento='1990-01-01' WHERE id=ANY($1::uuid[])", [users]);
    await expect(db.transaction(c => blockEntries(c, id))).rejects.toThrow("límite diario");
    for (const uid of users) await db.query("INSERT INTO limites_usuario(usuario_id,perdida_diaria_centimos) VALUES($1,199)", [uid]);
    await expect(db.transaction(c => blockEntries(c, id))).rejects.toThrow("Límite diario");
    // Isolate exclusion from the independently tested limit, regardless of UUID lock order.
    await db.query("UPDATE limites_usuario SET perdida_diaria_centimos=5000 WHERE usuario_id=ANY($1::uuid[])", [users]);
    await db.query("UPDATE usuarios SET estado='autoexcluido' WHERE id=$1", [users[0]]);
    await expect(db.transaction(c => blockEntries(c, id))).rejects.toThrow("autoexcluido");
    vi.unstubAllEnvs();
  });
});
