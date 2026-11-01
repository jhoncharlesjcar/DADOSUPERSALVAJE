export const MODES = ["duelo", "batalla", "equipos_3v3", "equipos_4v4", "equipos_5v5"] as const;
export type MatchMode = typeof MODES[number];
export interface QueueUnit {
  id: string;
  rating: number;
  joinedAt: number;
  priority: boolean;
  members: Array<{ id: string; rating: number; dadoId: string }>;
}
export interface MatchingConfig {
  maxRange: number;
  teamMaxDifference?: number;
  battleMinimum?: number;
  battleWaitMs?: number;
}
export function searchRange(joinedAt: number, now: number, cap: number) {
  if (!Number.isFinite(cap) || cap < 50) throw new Error("Tope de rango inválido");
  return Math.min(cap, 50 + 25 * Math.floor(Math.max(0, now - joinedAt) / 10000));
}
export function teamSize(mode: MatchMode) {
  return mode === "equipos_3v3" ? 3 : mode === "equipos_4v4" ? 4 : mode === "equipos_5v5" ? 5 : 0;
}
const sum = (units: QueueUnit[]) => units.reduce((total, unit) => total + unit.members.reduce((n, member) => n + member.rating, 0), 0);
const count = (units: QueueUnit[]) => units.reduce((total, unit) => total + unit.members.length, 0);

/** All groups remain indivisible. Range is mutual: neither side's wait is bypassed. */
export function matchUnits(units: QueueUnit[], mode: MatchMode, config: MatchingConfig, now: number): { units: QueueUnit[]; teamA: string[]; teamB: string[] } | null {
  const ordered = [...units].sort((a, b) => Number(b.priority) - Number(a.priority) || a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
  const compatible = (a: QueueUnit, b: QueueUnit) => Math.abs(a.rating - b.rating) <= Math.min(searchRange(a.joinedAt, now, config.maxRange), searchRange(b.joinedAt, now, config.maxRange));
  if (mode === "duelo") {
    let pair: QueueUnit[] | null = null, distance = Infinity;
    let prioritized = false;
    for (let i = 0; i < ordered.length; i++) for (let j = i + 1; j < ordered.length; j++) {
      const a = ordered[i], b = ordered[j];
      if (a.members.length !== 1 || b.members.length !== 1 || !compatible(a, b)) continue;
      const difference = Math.abs(a.rating - b.rating);
      const priority = a.priority || b.priority;
      if (priority && !prioritized || priority === prioritized && difference < distance) {
        pair = [a, b]; distance = difference; prioritized = priority;
      }
    }
    return pair ? { units: pair, teamA: [], teamB: [] } : null;
  }
  const size = teamSize(mode);
  if (size && (config.teamMaxDifference === undefined || config.teamMaxDifference < 0)) throw new Error("TODO(DECISIÓN): diferencia máxima de rating entre equipos");
  for (const anchor of ordered) {
    const eligible = ordered.filter(unit => unit.id === anchor.id || compatible(anchor, unit));
    if (!size) {
      const players = eligible.filter(unit => unit.members.length === 1).slice(0, 10);
      const timedOut = config.battleMinimum !== undefined && config.battleWaitMs !== undefined && now - anchor.joinedAt >= config.battleWaitMs;
      if (players.length === 10 || timedOut && players.length >= config.battleMinimum!) return { units: players, teamA: [], teamB: [] };
      continue;
    }
    // At most ten participant seats are filled. Backtracking includes whole units only.
    let result: { units: QueueUnit[]; teamA: string[]; teamB: string[] } | null = null;
    const fill = (index: number, a: QueueUnit[], b: QueueUnit[]) => {
      if (result) return;
      const na = count(a), nb = count(b);
      if (na === size && nb === size) {
        if (Math.abs(sum(a) - sum(b)) <= config.teamMaxDifference!) result = { units: [...a, ...b], teamA: a.flatMap(u => u.members.map(m => m.id)), teamB: b.flatMap(u => u.members.map(m => m.id)) };
        return;
      }
      if (index >= eligible.length) return;
      const unit = eligible[index];
      if (unit.id === anchor.id) { fill(index + 1, a, b); return; }
      if (na + unit.members.length <= size) fill(index + 1, [...a, unit], b);
      if (nb + unit.members.length <= size) fill(index + 1, a, [...b, unit]);
      fill(index + 1, a, b);
    };
    if (anchor.members.length <= size) fill(0, [anchor], []);
    if (result) return result;
  }
  return null;
}
