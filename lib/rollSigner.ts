import { randomInt, createHmac, timingSafeEqual } from "node:crypto";

const ROLL_SECRET = process.env.ROLL_SECRET || process.env.ADMIN_SESSION_SECRET || "dado-salvaje-secure-server-roll-secret-key-32chars";

export interface ServerRollResult {
  matchId: string;
  rolls: Record<string, number>;
  timestamp: number;
  signature: string;
}

export function generateServerRolls(dnis: string[], matchId: string): ServerRollResult {
  const timestamp = Date.now();
  const rolls: Record<string, number> = {};

  for (const dni of dnis) {
    rolls[dni] = randomInt(1, 7);
  }

  const payload = JSON.stringify({ matchId, rolls, timestamp });
  const signature = createHmac("sha256", ROLL_SECRET).update(payload).digest("base64url");

  return { matchId, rolls, timestamp, signature };
}

export function verifyServerRolls(result: {
  matchId: string;
  rolls: Record<string, number>;
  timestamp: number;
  signature: string;
}): boolean {
  if (!result || !result.matchId || !result.rolls || !result.signature || !result.timestamp) {
    return false;
  }

  // Window of 10 minutes
  if (Math.abs(Date.now() - result.timestamp) > 10 * 60 * 1000) {
    return false;
  }

  const payload = JSON.stringify({
    matchId: result.matchId,
    rolls: result.rolls,
    timestamp: result.timestamp,
  });

  const expectedSig = createHmac("sha256", ROLL_SECRET).update(payload).digest("base64url");
  const expectedBuf = Buffer.from(expectedSig);
  const receivedBuf = Buffer.from(result.signature);

  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}
