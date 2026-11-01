import "server-only";
import { getDatabase, type SqlClient } from "./data/database";
import { generateMatch, members, type MatchRow } from "./data/matches";
import type { ArenaMatch } from "./arena/types";

/** Only the authenticated admin adapter projects private DNIs for the existing arena. */
async function projectManual(client: SqlClient, match: ArenaMatch, externalId: string): Promise<ArenaMatch> {
  const roster = await members(client,match.id);
  const ids = new Map(roster.map(p=>[p.id,p.dni]));
  return { ...match,id:externalId,players:match.players.map(p=>({...p,id:ids.get(p.id)!})),winnerId:ids.get(match.winnerId)!,
    rounds:match.rounds.map(r=>({rolls:r.rolls.map(v=>({...v,playerId:ids.get(v.playerId)!})),leaders:r.leaders.map(id=>ids.get(id)!)})) };
}
export async function readManualMatch(externalId: string): Promise<ArenaMatch | null> {
  const client=getDatabase();
  const row=(await client.query<MatchRow>("SELECT * FROM partidas WHERE external_id=$1",[externalId])).rows[0];
  return row?.replay && "winnerId" in row.replay ? projectManual(client,row.replay,externalId) : null;
}
export async function prepareManualMatch(externalId: string,cosmetics:Record<string,string>={}): Promise<ArenaMatch> {
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(externalId)) throw new Error("Identificador de partida inválido");
  return getDatabase().transaction(async client=>{
    const row=(await client.query<MatchRow>("SELECT * FROM partidas WHERE external_id=$1 FOR UPDATE",[externalId])).rows[0];
    if (!row) throw new Error("La partida no tiene entradas confirmadas");
    const replay=await generateMatch(client,row.id,cosmetics);
    if (!("winnerId" in replay)) throw new Error("La arena manual requiere modo individual");
    return projectManual(client,replay,externalId);
  });
}
