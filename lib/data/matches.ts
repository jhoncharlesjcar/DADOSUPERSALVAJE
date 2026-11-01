import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabase, type SqlClient } from "./database";
import { ALLOWED_STAKES, displaySoles, solesToCents } from "./money";
import { blockEntries, cancelMatch, settleMatch } from "./ledger";
import { committedReplay, committedTeamReplay, createSeedCommitment, verifyReplay, type TeamReplay } from "./fairness";
import { GameEngine } from "../gameEngine";
import { DADOS_DISPONIBLES } from "../dados";
import { releaseRoomQueue } from "../matchmaking";
import type { ArenaMatch } from "../arena/types";
import type { LevelUp } from "@/types";

export type MatchRow = { id: string; external_id: string | null; modo: string; demo: boolean; estado: string; monto_entrada_centimos: string; pozo_centimos: string; premio_centimos: string; hash_semilla: string; semilla_revelada: string | null; replay: ArenaMatch | TeamReplay | null; ganador_usuario_id: string | null; ganador_equipo: string | null };
export type MemberRow = { id: string; usuario_id: string; dni: string; nombres: string; equipo: "A" | "B" | null; dado_id: string; confirmado: boolean; premio_centimos: string; puntos: number; racha_actual: number; rating: number };
export const validMatchId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export async function members(client: SqlClient, id: string): Promise<MemberRow[]> {
  return (await client.query<MemberRow>(`SELECT p.*,u.dni,u.nombres,u.puntos,u.racha_actual,COALESCE(r.rating,1200) AS rating
    FROM participantes p JOIN usuarios u ON u.id=p.usuario_id JOIN partidas m ON m.id=p.partida_id
    LEFT JOIN ratings r ON r.usuario_id=u.id AND r.modo=m.modo WHERE p.partida_id=$1 ORDER BY p.posicion,p.id`, [id])).rows;
}
export async function balances(client: SqlClient, id: string) {
  const rows = (await client.query<{ dni: string; disponible_centimos: string; bloqueado_centimos: string }>(`SELECT u.dni,b.disponible_centimos::text,b.bloqueado_centimos::text
    FROM participantes p JOIN usuarios u ON u.id=p.usuario_id JOIN partidas m ON m.id=p.partida_id
    JOIN billeteras b ON b.usuario_id=u.id AND b.demo=m.demo WHERE m.id=$1`, [id])).rows;
  return rows.map(r => ({ ...r, saldo_real: displaySoles(r.disponible_centimos) }));
}
export async function createManualEntry(dnis: string[], stakeInput: unknown, externalId: string) {
  if (!Array.isArray(dnis) || dnis.length < 2 || dnis.length > 10 || new Set(dnis).size !== dnis.length || !dnis.every(d=>/^\d{8}$/.test(d)) || !/^[a-zA-Z0-9_-]{16,100}$/.test(externalId)) throw new Error("Datos de partida inválidos");
  const stake = solesToCents(stakeInput);
  if (!ALLOWED_STAKES.some(s => s === stake)) throw new Error("Apuesta inválida");
  // Operator-managed legacy arena is demo only: an operator cannot consent for real-money players.
  if (process.env.DINERO_REAL_HABILITADO === "true") throw new Error("La arena manual solo admite saldo demo");
  return getDatabase().transaction(async client => {
    // Serialize retries even before the unique external id exists.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`manual:${externalId}`]);
    let match = (await client.query<MatchRow>("SELECT * FROM partidas WHERE external_id=$1 FOR UPDATE", [externalId])).rows[0];
    if (match) {
      const saved = await members(client, match.id);
      if (BigInt(match.monto_entrada_centimos) !== stake || !match.demo || saved.length !== dnis.length || saved.some(p=>!dnis.includes(p.dni))) throw new Error("Identificador usado con otros participantes o monto");
      if (["anulada","en_disputa"].includes(match.estado)) throw new Error("Partida no disponible");
      return { replay: true, id: match.id, hash_semilla: match.hash_semilla, balances: await balances(client,match.id) };
    }
    const users = (await client.query<{ id: string; dni: string }>("SELECT id,dni FROM usuarios WHERE dni=ANY($1::text[]) ORDER BY id FOR UPDATE", [dnis])).rows;
    if (users.length !== dnis.length) throw new Error("Participantes no encontrados");
    const id = randomUUID(), commitment = createSeedCommitment();
    match = (await client.query<MatchRow>(`INSERT INTO partidas(id,external_id,modo,demo,monto_entrada_centimos,min_jugadores,max_jugadores,estado,hash_semilla)
      VALUES($1,$2,$3,true,$4,$5,$5,'confirmando',$6) RETURNING *`, [id,externalId,dnis.length===2?"duelo":"batalla",stake.toString(),dnis.length,commitment.hash])).rows[0];
    await client.query("INSERT INTO semillas_partida(partida_id,semilla_servidor) VALUES($1,$2)", [id,commitment.seed]);
    for (let i=0;i<dnis.length;i++) await client.query(`INSERT INTO participantes(partida_id,usuario_id,dado_id,apuesta_centimos,confirmado,posicion)
      VALUES($1,$2,$3,$4,true,$5)`, [id,users.find(u=>u.dni===dnis[i])!.id,DADOS_DISPONIBLES[i % DADOS_DISPONIBLES.length].id,stake.toString(),i+1]);
    await client.query(`INSERT INTO auditoria_admin(actor,accion,referencia_tipo,referencia_id,detalle) VALUES('admin','confirmacion_manual_demo','partida',$1,$2::jsonb)`, [id,JSON.stringify({ participants:dnis.length })]);
    await blockEntries(client,id);
    return { replay:false,id,hash_semilla:commitment.hash,balances:await balances(client,id) };
  });
}

export async function generateMatch(client: SqlClient, id: string, cosmetics: Record<string,string> = {}) {
  const match = (await client.query<MatchRow>("SELECT * FROM partidas WHERE id=$1 FOR UPDATE",[id])).rows[0];
  if (!match) throw new Error("Partida no encontrada");
  if (match.replay) return match.replay;
  if (!["en_curso","en_desempate"].includes(match.estado)) throw new Error("La partida no tiene entradas confirmadas");
  const roster = await members(client,id);
  const seed = (await client.query<{ semilla_servidor: string }>("SELECT semilla_servidor FROM semillas_partida WHERE partida_id=$1",[id])).rows[0]?.semilla_servidor;
  if (!seed) throw new Error("Compromiso de semilla ausente");
  const players = roster.map(p => ({ id:p.id,name:p.nombres,dadoId:DADOS_DISPONIBLES.find(d=>d.id===cosmetics[p.dni])?.id ?? p.dado_id }));
  const replay = match.modo.startsWith("equipos_")
    ? committedTeamReplay(id,players.map((p,i)=>({...p,team:roster[i].equipo!})),seed)
    : committedReplay(id,players,seed);
  if (!verifyReplay(match.hash_semilla,seed,replay)) throw new Error("La semilla no corresponde al compromiso");
  for (const [i,round] of replay.rounds.entries()) for (const roll of round.rolls) await client.query("INSERT INTO tiradas(partida_id,participante_id,ronda,valor) VALUES($1,$2,$3,$4)",[id,roll.playerId,i+1,roll.value]);
  for (const p of players) await client.query("UPDATE participantes SET dado_id=$1 WHERE id=$2",[p.dadoId,p.id]);
  await client.query("UPDATE partidas SET replay=$2::jsonb,ganador_usuario_id=$3,ganador_equipo=$4 WHERE id=$1",[id,JSON.stringify(replay),"winnerId" in replay?roster.find(p=>p.id===replay.winnerId)!.usuario_id:null,"winnerTeam" in replay?replay.winnerTeam:null]);
  return replay;
}

/** Runs under the match lock and only after a first successful ledger settlement. */
async function applyStats(client: SqlClient, match: MatchRow, roster: MemberRow[], winners: string[]): Promise<LevelUp | null> {
  const k = Number(process.env.ELO_K);
  if (!Number.isFinite(k) || k <= 0) throw new Error("TODO(DECISIÓN): configura ELO_K");
  // User locks serialize stats across matches; always use the same UUID order.
  const fresh = (await client.query<{id:string;puntos:number;racha_actual:number}>("SELECT id,puntos,racha_actual FROM usuarios WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",[roster.map(p=>p.usuario_id)])).rows;
  for (const p of roster) await client.query("INSERT INTO ratings(usuario_id,modo) VALUES($1,$2) ON CONFLICT DO NOTHING",[p.usuario_id,match.modo]);
  const ratingRows = (await client.query<{usuario_id:string;rating:number}>("SELECT usuario_id,rating FROM ratings WHERE usuario_id=ANY($1::uuid[]) AND modo=$2 ORDER BY usuario_id FOR UPDATE",[roster.map(p=>p.usuario_id),match.modo])).rows;
  const rating = new Map(ratingRows.map(r=>[r.usuario_id,r.rating]));
  let levelUp: LevelUp | null = null;
  for (const p of roster) {
    const user = fresh.find(u=>u.id===p.usuario_id)!;
    const won = winners.includes(p.usuario_id);
    const opponents = roster.filter(o=>p.equipo ? o.equipo!==p.equipo : o.id!==p.id);
    const expected = opponents.reduce((sum,o)=>sum+1/(1+10**((rating.get(o.usuario_id)!-rating.get(p.usuario_id)!)/400)),0)/opponents.length;
    // Pairwise Elo: non-winning individuals tie with one another, and lose to the winner.
    const score = won ? 1 : p.equipo ? 0 : (opponents.length - 1) / (2 * opponents.length);
    const nextRating = Math.round(rating.get(p.usuario_id)! + k*(score-expected));
    const evolution = won ? GameEngine.calculateEvolution(p.dni,displaySoles(match.pozo_centimos),user.puntos,roster.length) : null;
    const points = evolution?.puntosGanados ?? 0;
    await client.query(`UPDATE usuarios SET partidas_jugadas=partidas_jugadas+1,partidas_ganadas=partidas_ganadas+$2,puntos=puntos+$3,
      total_ganado_centimos=total_ganado_centimos+(SELECT premio_centimos FROM participantes WHERE id=$4),
      racha_actual=CASE WHEN $2=1 THEN racha_actual+1 ELSE 0 END,
      mejor_racha=CASE WHEN $2=1 THEN GREATEST(mejor_racha,racha_actual+1) ELSE mejor_racha END WHERE id=$1`,[p.usuario_id,won?1:0,points,p.id]);
    await client.query("UPDATE ratings SET rating=$3 WHERE usuario_id=$1 AND modo=$2",[p.usuario_id,match.modo,nextRating]);
    if (won && !levelUp) levelUp = { ...(evolution?.levelUp ?? {}),puntosGanados:points,puntosTotal:user.puntos+points,puntosAntes:user.puntos,puntosNuevos:user.puntos+points,rachaActual:user.racha_actual+1 };
  }
  return levelUp;
}
export async function settleResolvedMatch(client: SqlClient,id:string) {
  const match = (await client.query<MatchRow>("SELECT * FROM partidas WHERE id=$1 FOR UPDATE",[id])).rows[0];
  if (!match?.replay) throw new Error("La partida no tiene tirada confirmada");
  const seed = (await client.query<{semilla_servidor:string}>("SELECT semilla_servidor FROM semillas_partida WHERE partida_id=$1",[id])).rows[0]?.semilla_servidor;
  if (!seed || !verifyReplay(match.hash_semilla,seed,match.replay)) throw new Error("Resultado no verificable");
  const roster = await members(client,id);
  const replay = match.replay;
  const winners = "winnerTeam" in replay ? roster.filter(p=>p.equipo===replay.winnerTeam).map(p=>p.usuario_id) : roster.filter(p=>p.id===replay.winnerId).map(p=>p.usuario_id);
  if (match.ganador_usuario_id ? winners.length!==1 || winners[0]!==match.ganador_usuario_id : !match.ganador_equipo || !("winnerTeam" in match.replay) || match.ganador_equipo!==match.replay.winnerTeam) throw new Error("Ganador inconsistente");
  const settlement = await settleMatch(client,id,winners);
  const updated = (await client.query<MatchRow>("SELECT * FROM partidas WHERE id=$1",[id])).rows[0];
  const levelUp = settlement.replay ? null : await applyStats(client,updated,roster,winners);
  await client.query("UPDATE partidas SET semilla_revelada=$2 WHERE id=$1 AND estado='finalizada'",[id,seed]);
  return { id,replay:settlement.replay,levelUp,updatedBalances:await balances(client,id) };
}
export async function cancelStaleMatches(before: Date, actor: string) {
  if (!Number.isFinite(before.getTime()) || !actor.trim()) throw new Error("Recuperación inválida");
  return getDatabase().transaction(async client => {
    const ids = (await client.query<{id:string}>("SELECT id FROM partidas WHERE estado IN ('en_curso','en_desempate') AND iniciada_en<$1 ORDER BY id FOR UPDATE",[before])).rows;
    for (const {id} of ids) {
      await cancelMatch(client,id);
      await releaseRoomQueue(client,id);
      await client.query("INSERT INTO auditoria_admin(actor,accion,referencia_tipo,referencia_id) VALUES($1,'recuperacion_caida','partida',$2)",[actor,id]);
    }
    return ids.map(r=>r.id);
  });
}
