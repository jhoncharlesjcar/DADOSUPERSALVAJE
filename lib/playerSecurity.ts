import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const PLAYER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSessionSecret(): string {
  const secret = process.env.PLAYER_SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV !== "production") return "development-player-session-secret-change-me";
  throw new Error("PLAYER_SESSION_SECRET debe tener al menos 32 caracteres");
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export function hashPin(pin: string): string {
  if (!isValidPin(pin)) throw new Error("El PIN debe tener 6 dígitos");
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPin(pin: string, storedHash?: string | null): boolean {
  if (!isValidPin(pin) || !storedHash) return false;
  const [algorithm, saltValue, hashValue, extra] = storedHash.split("$");
  if (algorithm !== "scrypt" || !saltValue || !hashValue || extra) return false;
  try {
    const expected = Buffer.from(hashValue, "base64url");
    const actual = scryptSync(pin, Buffer.from(saltValue, "base64url"), expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function createPlayerSessionToken(dni: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ dni, exp: now + PLAYER_SESSION_TTL_SECONDS * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyPlayerSessionToken(token?: string): string | null {
  if (!token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  try {
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { dni?: string; exp?: number };
    if (!/^\d{8}$/.test(parsed.dni || "") || !Number.isFinite(parsed.exp) || Number(parsed.exp) <= Date.now()) return null;
    return parsed.dni!;
  } catch {
    return null;
  }
}
