import { beforeAll, describe, expect, it } from "vitest";

let auth: typeof import("../lib/playerSecurity");

beforeAll(async () => {
  process.env.PLAYER_SESSION_SECRET = "test-player-session-secret-with-32-characters";
  auth = await import("../lib/playerSecurity");
});

describe("seguridad de jugador", () => {
  it("crea hashes de PIN con sal aleatoria y los verifica", () => {
    const first = auth.hashPin("123456");
    const second = auth.hashPin("123456");
    expect(first).not.toBe(second);
    expect(auth.verifyPin("123456", first)).toBe(true);
    expect(auth.verifyPin("654321", first)).toBe(false);
  });

  it("rechaza PIN y hashes malformados", () => {
    expect(auth.isValidPin("12345")).toBe(false);
    expect(auth.isValidPin("12345a")).toBe(false);
    expect(auth.verifyPin("123456", "texto-invalido")).toBe(false);
  });

  it("firma la sesión y rechaza modificaciones", () => {
    const token = auth.createPlayerSessionToken("12345678");
    expect(auth.verifyPlayerSessionToken(token)).toBe("12345678");
    expect(auth.verifyPlayerSessionToken(`${token}x`)).toBeNull();
  });

  it("rechaza sesiones vencidas", () => {
    const token = auth.createPlayerSessionToken("12345678", Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(auth.verifyPlayerSessionToken(token)).toBeNull();
  });
});
