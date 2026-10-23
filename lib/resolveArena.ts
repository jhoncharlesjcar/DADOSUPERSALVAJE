import { randomInt } from "node:crypto";
import type { ArenaMatch, ArenaPlayer, ArenaRound } from "./arena/types";

export function resolveArena(id: string, players: ArenaPlayer[], rollDie = () => randomInt(1, 7)): ArenaMatch {
  if (players.length < 2 || players.length > 10 || new Set(players.map(p => p.id)).size !== players.length) throw new Error("Participantes inválidos");
  let active = players.map(player => player.id);
  const rounds: ArenaRound[] = [];
  while (active.length > 1 && rounds.length < 100) {
    const rolls = active.map(playerId => ({ playerId, value: rollDie() }));
    if (rolls.some(roll => !Number.isInteger(roll.value) || roll.value < 1 || roll.value > 6)) throw new Error("Tirada inválida");
    const max = Math.max(...rolls.map(roll => roll.value));
    active = rolls.filter(roll => roll.value === max).map(roll => roll.playerId);
    rounds.push({ rolls, leaders: [...active] });
  }
  if (active.length !== 1) throw new Error("No fue posible resolver el desempate");
  return { id, players, rounds, winnerId: active[0] };
}
