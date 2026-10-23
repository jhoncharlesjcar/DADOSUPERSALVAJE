import { getDB } from "./db";
import { DADOS_DISPONIBLES } from "./dados";
import { resolveArena } from "./resolveArena";
import type { ArenaMatch } from "./arena/types";

export function readManualMatch(matchId: string): ArenaMatch | null {
  const row = getDB().prepare("SELECT match_json FROM manual_rolls WHERE match_id = ?").get(matchId) as { match_json: string } | undefined;
  return row ? JSON.parse(row.match_json) as ArenaMatch : null;
}

export function prepareManualMatch(matchId: string, cosmetics: Record<string, string> = {}): ArenaMatch {
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(matchId)) throw new Error("Identificador de partida inválido");
  const db = getDB();
  return db.transaction(() => {
    const saved = readManualMatch(matchId);
    if (saved) return saved;
    const prefix = `manual:${matchId}:stake:`;
    const charged = db.prepare(`SELECT t.dni, j.nombres FROM transacciones t
      JOIN jugadores j ON j.dni = t.dni WHERE substr(t.referencia, 1, ?) = ? AND t.tipo = 'egreso'
      ORDER BY t.id`).all(prefix.length, prefix) as Array<{ dni: string; nombres: string }>;
    const players = charged.map((p, i) => ({
      id: p.dni, name: p.nombres,
      dadoId: DADOS_DISPONIBLES.find(d => d.id === cosmetics[p.dni])?.id || DADOS_DISPONIBLES[i % DADOS_DISPONIBLES.length].id,
    }));
    const match = resolveArena(matchId, players);
    db.prepare("INSERT INTO manual_rolls (match_id, match_json) VALUES (?, ?)").run(matchId, JSON.stringify(match));
    return match;
  }).immediate();
}
