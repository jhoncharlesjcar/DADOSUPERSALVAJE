import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

const databasePath = path.join(tmpdir(), `dado-salvaje-finance-${randomUUID()}.db`);
let databaseModule: typeof import("../lib/db");
let walletModule: typeof import("../lib/wallet");
let rollSignerModule: typeof import("../lib/rollSigner");
let rateLimitModule: typeof import("../lib/rateLimit");

beforeAll(async () => {
  process.env.DATABASE_PATH = databasePath;
  databaseModule = await import("../lib/db");
  walletModule = await import("../lib/wallet");
  rollSignerModule = await import("../lib/rollSigner");
  rateLimitModule = await import("../lib/rateLimit");

  const db = databaseModule.getDB();
  databaseModule.registrarJugadorSeguro("11112222", "Test Jugador 1");
  databaseModule.registrarJugadorSeguro("33334444", "Test Jugador 2");
  db.prepare("UPDATE wallet SET saldo_real = 50 WHERE dni = '11112222'").run();
  db.prepare("UPDATE wallet SET saldo_real = 50 WHERE dni = '33334444'").run();
});

afterAll(() => {
  databaseModule.getDB().close();
  for (const suffix of ["", "-wal", "-shm"]) {
    const target = `${databasePath}${suffix}`;
    if (existsSync(target)) rmSync(target);
  }
  delete process.env.DATABASE_PATH;
});

describe("Flujo Financiero y Billetera (R-01, R-10, FIN-001)", () => {
  it("calcula y distribuye premio sincronizando wallet y legacy monto_yapeo", () => {
    const db = databaseModule.getDB();
    const pozo = 40; // 2 jugadores x 20
    const { premioJugador, gananciaCasa, gananciaRanking } = walletModule.distribuirPremio("11112222", pozo);

    expect(premioJugador).toBe(32); // 80%
    expect(gananciaRanking).toBe(1.6); // 4%
    expect(gananciaCasa).toBe(6.4); // 16%
    expect(premioJugador + gananciaCasa + gananciaRanking).toBe(pozo);

    const wallet = db.prepare("SELECT saldo_real FROM wallet WHERE dni = '11112222'").get() as { saldo_real: number };
    const jugador = db.prepare("SELECT monto_yapeo FROM jugadores WHERE dni = '11112222'").get() as { monto_yapeo: number };

    expect(wallet.saldo_real).toBe(82); // 50 + 32
    // R-10: monto_yapeo debe coincidir exactamente con saldo_real
    expect(jugador.monto_yapeo).toBe(wallet.saldo_real);
  });

  it("protege contra saldos insuficientes en billetera", () => {
    const db = databaseModule.getDB();
    const charge = db.prepare("UPDATE wallet SET saldo_real = saldo_real - ? WHERE dni = ? AND saldo_real >= ?");
    const result = charge.run(1000, "11112222", 1000);
    expect(result.changes).toBe(0);
  });
});

describe("Tiradas Firmadas en Servidor (R-03)", () => {
  it("genera tiradas criptográficas dentro del rango 1 a 6 con firma HMAC", () => {
    const dnis = ["11112222", "33334444"];
    const matchId = "match_test_123";
    const result = rollSignerModule.generateServerRolls(dnis, matchId);

    expect(result.matchId).toBe(matchId);
    expect(result.signature).toBeTruthy();
    expect(result.rolls["11112222"]).toBeGreaterThanOrEqual(1);
    expect(result.rolls["11112222"]).toBeLessThanOrEqual(6);
    expect(result.rolls["33334444"]).toBeGreaterThanOrEqual(1);
    expect(result.rolls["33334444"]).toBeLessThanOrEqual(6);

    const verified = rollSignerModule.verifyServerRolls(result);
    expect(verified).toBe(true);
  });

  it("rechaza tiradas alteradas o con firma falsificada", () => {
    const dnis = ["11112222", "33334444"];
    const result = rollSignerModule.generateServerRolls(dnis, "match_tamper");

    // Intento de alteración de dado client-side
    const tampered = {
      ...result,
      rolls: { ...result.rolls, "11112222": 6 },
    };
    // Si el valor era ya 6, probamos con otro para garantizar tamper
    if (result.rolls["11112222"] === 6) {
      tampered.rolls["11112222"] = 1;
    }

    const verified = rollSignerModule.verifyServerRolls(tampered);
    expect(verified).toBe(false);
  });
});

describe("Persistent SQLite Rate Limiter (R-09)", () => {
  it("permite peticiones dentro del límite y bloquea al exceder", () => {
    const key = `test_rate_${Date.now()}`;
    const limit = 3;
    const windowMs = 5000;

    const r1 = rateLimitModule.checkRateLimit(key, limit, windowMs);
    expect(r1.allowed).toBe(true);

    const r2 = rateLimitModule.checkRateLimit(key, limit, windowMs);
    expect(r2.allowed).toBe(true);

    const r3 = rateLimitModule.checkRateLimit(key, limit, windowMs);
    expect(r3.allowed).toBe(true);

    // 4ta petición excede límite
    const r4 = rateLimitModule.checkRateLimit(key, limit, windowMs);
    expect(r4.allowed).toBe(false);
    expect(r4.retryAfter).toBeGreaterThan(0);

    rateLimitModule.clearRateLimit(key);
    const r5 = rateLimitModule.checkRateLimit(key, limit, windowMs);
    expect(r5.allowed).toBe(true);
  });
});
