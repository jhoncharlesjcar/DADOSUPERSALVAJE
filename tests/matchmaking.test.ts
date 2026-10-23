import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

const databasePath = path.join(tmpdir(), `dado-salvaje-matchmaking-${randomUUID()}.db`);
let databaseModule: typeof import("../lib/db");
let matchmakingModule: typeof import("../lib/matchmaking");

beforeAll(async () => {
  process.env.DATABASE_PATH = databasePath;
  databaseModule = await import("../lib/db");
  matchmakingModule = await import("../lib/matchmaking");

  const db = databaseModule.getDB();
  for (const [dni, name] of [["12345678", "Ana"], ["87654321", "Luis"]]) {
    databaseModule.registrarJugadorSeguro(dni, name);
    db.prepare("UPDATE wallet SET saldo_real = 10 WHERE dni = ?").run(dni);
    db.prepare("UPDATE jugadores SET monto_yapeo = 10 WHERE dni = ?").run(dni);
  }
});

afterAll(() => {
  databaseModule.getDB().close();
  for (const suffix of ["", "-wal", "-shm"]) {
    const target = `${databasePath}${suffix}`;
    if (existsSync(target)) rmSync(target);
  }
  delete process.env.DATABASE_PATH;
});

describe("matchmaking con dinero", () => {
  it("cobra, liquida y conserva el dinero una sola vez", () => {
    expect(matchmakingModule.joinQueue("12345678", "duelo", 10)).toBeNull();
    const roomId = matchmakingModule.joinQueue("87654321", "duelo", 10);
    expect(roomId).toEqual(expect.any(Number));

    const db = databaseModule.getDB();
    const total = db.prepare("SELECT SUM(saldo_real) AS total FROM wallet").get() as { total: number };
    expect(total.total).toBe(16);
    expect((db.prepare("SELECT COUNT(*) AS total FROM online_partidas").get() as { total: number }).total).toBe(1);
    const replay = JSON.parse((db.prepare("SELECT replay_json FROM online_partidas").get() as { replay_json: string }).replay_json);
    expect(replay.players).toHaveLength(2);
    expect(replay.rounds.length).toBeGreaterThan(0);
    expect(replay.rounds.at(-1).leaders).toEqual([replay.winnerId]);
    expect((db.prepare("SELECT COUNT(*) AS total FROM partidas").get() as { total: number }).total).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS total FROM transacciones").get() as { total: number }).total).toBe(3);

    expect(matchmakingModule.getMatchStatus("12345678")).toMatchObject({ status: "encontrada", salaId: roomId });
    expect(matchmakingModule.getMatchStatus("87654321")).toMatchObject({ status: "encontrada", salaId: roomId });
  });

  it("rechaza identidad, modo, monto y saldo inválidos", () => {
    expect(() => matchmakingModule.joinQueue("bad", "duelo", 10)).toThrow();
    expect(() => matchmakingModule.joinQueue("12345678", "inventado", 10)).toThrow();
    expect(() => matchmakingModule.joinQueue("12345678", "duelo", -10)).toThrow();
    expect(() => matchmakingModule.joinQueue("12345678", "duelo", 100)).toThrow("Saldo insuficiente");
  });
});
