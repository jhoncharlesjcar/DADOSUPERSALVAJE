import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const databasePath = path.join(tmpdir(), `dado-salvaje-schema-${process.pid}.db`);
let databaseModule: typeof import("../lib/db");

beforeAll(async () => {
  process.env.DATABASE_PATH = databasePath;
  databaseModule = await import("../lib/db");
});

afterAll(() => {
  databaseModule.getDB().close();
  for (const suffix of ["", "-wal", "-shm"]) {
    const target = `${databasePath}${suffix}`;
    if (existsSync(target)) rmSync(target);
  }
  delete process.env.DATABASE_PATH;
});

describe("esquema reproducible", () => {
  it("crea todas las tablas requeridas en una base vacía", () => {
    const rows = databaseModule.getDB().prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).all() as Array<{ name: string }>;
    const tables = rows.map(row => row.name);

    for (const required of [
      "jugadores", "wallet", "partidas", "transacciones", "estado_live",
      "matchmaking_queue", "salas", "online_partidas", "online_room_views", "teams",
    ]) {
      expect(tables).toContain(required);
    }
  });

  it("aplica restricciones únicas de idempotencia", () => {
    const indexes = databaseModule.getDB().prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index'"
    ).all() as Array<{ name: string }>;
    expect(indexes.map(index => index.name)).toEqual(expect.arrayContaining([
      "idx_partidas_external_id",
      "idx_transacciones_referencia",
      "idx_matchmaking_dni",
      "idx_online_partidas_sala",
    ]));
  });
});
