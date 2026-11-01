import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { resolveArena } from "../resolveArena";
import type { ArenaMatch, ArenaPlayer } from "../arena/types";

export function seedHash(seed: string) { return createHash("sha256").update(seed, "utf8").digest("hex"); }
export function createSeedCommitment() {
  const seed = randomBytes(32).toString("hex");
  return { seed, hash: seedHash(seed) };
}
/** Protocol v1: HMAC key is the UTF-8 hex seed. JSON tuple avoids ambiguous concatenation.
 * Reject the top four uint32 values to remove modulo bias; cosmetics never enter the tuple. */
export function deriveDie(seed: string, matchId: string, participantId: string, round: number) {
  if (!/^[a-f0-9]{64}$/.test(seed) || !matchId || !participantId || !Number.isSafeInteger(round) || round < 1) throw new Error("Contexto de tirada inválido");
  for (let counter = 0; counter < 1000; counter++) {
    const digest = createHmac("sha256", seed).update(JSON.stringify(["dado-salvaje-v1", matchId, participantId, round, counter])).digest();
    for (let offset = 0; offset < digest.length; offset += 4) {
      const n = digest.readUInt32BE(offset);
      if (n < 4294967292) return n % 6 + 1;
    }
  }
  throw new Error("No fue posible derivar una tirada");
}
export function committedReplay(id: string, players: ArenaPlayer[], seed: string) {
  return resolveArena(id, players, (participant, round) => deriveDie(seed, id, participant, round));
}
export interface TeamReplay {
  id: string; players: Array<ArenaPlayer & { team: "A" | "B" }>;
  rounds: Array<{ rolls: Array<{ playerId: string; value: number }>; totals: { A: number; B: number } }>;
  winnerTeam: "A" | "B";
}
export function committedTeamReplay(id: string, players: TeamReplay["players"], seed: string): TeamReplay {
  const size = players.filter(p => p.team === "A").length;
  if (![3,4,5].includes(size) || players.length !== size * 2 || new Set(players.map(p => p.id)).size !== players.length || players.some(p => p.team !== "A" && p.team !== "B")) throw new Error("Equipos inválidos");
  const rounds: TeamReplay["rounds"] = [];
  for (let round = 1; round <= 100; round++) {
    const rolls = players.map(p => ({ playerId: p.id, value: deriveDie(seed, id, p.id, round) }));
    const totals = { A: 0, B: 0 };
    players.forEach((p,i) => { totals[p.team] += rolls[i].value; });
    rounds.push({ rolls, totals });
    if (totals.A !== totals.B) return { id, players, rounds, winnerTeam: totals.A > totals.B ? "A" : "B" };
  }
  throw new Error("No fue posible resolver el desempate de equipos");
}
export function verifyReplay(hash: string, seed: string, replay: ArenaMatch | TeamReplay) {
  if (!/^[a-f0-9]{64}$/.test(hash) || !timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(seedHash(seed), "hex"))) return false;
  try {
    const expected = "winnerTeam" in replay ? committedTeamReplay(replay.id, replay.players, seed) : committedReplay(replay.id, replay.players, seed);
    // jsonb reorders object keys. Compare canonical tuples, preserving only protocol array order.
    const canonical = (value: ArenaMatch | TeamReplay) => value.rounds.map(round => [
      round.rolls.map(roll => [roll.playerId, roll.value]),
      "leaders" in round ? round.leaders : [round.totals.A, round.totals.B],
    ]);
    return JSON.stringify(canonical(expected)) === JSON.stringify(canonical(replay)) &&
      ("winnerTeam" in expected && "winnerTeam" in replay ? expected.winnerTeam === replay.winnerTeam : "winnerId" in expected && "winnerId" in replay && expected.winnerId === replay.winnerId);
  } catch { return false; }
}
