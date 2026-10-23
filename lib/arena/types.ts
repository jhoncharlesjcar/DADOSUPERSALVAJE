export interface ArenaPlayer { id: string; name: string; dadoId: string }
export interface ArenaRoll { playerId: string; value: number }
export interface ArenaRound { rolls: ArenaRoll[]; leaders: string[] }
export interface ArenaMatch {
  id: string;
  players: ArenaPlayer[];
  rounds: ArenaRound[];
  winnerId: string;
}

/** Values from different tiebreak rounds must never be ranked together. */
export function latestRolls(match: ArenaMatch): ArenaRoll[] {
  const values = new Map<string, number>();
  for (const round of match.rounds) for (const roll of round.rolls) values.set(roll.playerId, roll.value);
  return match.players.map(player => ({ playerId: player.id, value: values.get(player.id)! }));
}

export function validateMatch(match: ArenaMatch): boolean {
  if (!match || !Array.isArray(match.players) || !Array.isArray(match.rounds)) return false;
  if (typeof match.id !== "string" || match.players.some(player => !player || typeof player.id !== "string" || typeof player.name !== "string" || typeof player.dadoId !== "string")) return false;
  if (match.players.length < 2 || match.players.length > 10 || !match.rounds.length || match.rounds.length > 100) return false;
  let active = match.players.map(player => player.id);
  if (new Set(active).size !== active.length) return false;
  for (let i = 0; i < match.rounds.length; i++) {
    const round = match.rounds[i];
    if (!round || !Array.isArray(round.rolls) || round.rolls.length !== active.length || round.rolls.some(roll => !roll)) return false;
    const ids = round.rolls.map(roll => roll.playerId);
    if (new Set(ids).size !== ids.length || ids.some(id => !active.includes(id))) return false;
    if (round.rolls.some(roll => !Number.isInteger(roll.value) || roll.value < 1 || roll.value > 6)) return false;
    const max = Math.max(...round.rolls.map(roll => roll.value));
    active = round.rolls.filter(roll => roll.value === max).map(roll => roll.playerId);
    if (!Array.isArray(round.leaders) || round.leaders.length !== active.length || new Set(round.leaders).size !== active.length || round.leaders.some(id => !active.includes(id))) return false;
    if (active.length === 1 && i !== match.rounds.length - 1) return false;
  }
  return active.length === 1 && active[0] === match.winnerId;
}
