import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabase, type SqlClient } from "./data/database";
import { ALLOWED_STAKES, solesToCents } from "./data/money";
import { createSeedCommitment } from "./data/fairness";
import { getRedisIndex, queueKey } from "./data/redis";
import { MODES, matchUnits, searchRange, teamSize, type MatchMode, type MatchingConfig, type QueueUnit } from "./data/matching";

const demoMode = () => process.env.DINERO_REAL_HABILITADO !== "true";
const validDni = (dni: string) => /^\d{8}$/.test(dni);
export function requiredQueueNumber(name: string, minimum: number) {
  const value = process.env[name];
  if (!value || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < minimum) throw new Error(`TODO(DECISIÓN): configura ${name}`);
  return Number(value);
}
function config(mode: MatchMode): MatchingConfig {
  const result: MatchingConfig = { maxRange: requiredQueueNumber("MATCHMAKING_MAX_RANGE", 50) };
  if (teamSize(mode)) result.teamMaxDifference = requiredQueueNumber("TEAM_MAX_RATING_DIFFERENCE", 0);
  if (mode === "batalla" && (process.env.BATTLE_MIN_PLAYERS || process.env.BATTLE_WAIT_SECONDS)) {
    result.battleMinimum = requiredQueueNumber("BATTLE_MIN_PLAYERS", 2);
    if (result.battleMinimum > 10) throw new Error("Mínimo de batalla inválido");
    result.battleWaitMs = requiredQueueNumber("BATTLE_WAIT_SECONDS", 1) * 1000;
  }
  return result;
}
function parameters(mode: string, amount: unknown): { mode: MatchMode; stake: bigint } {
  const stake = solesToCents(amount);
  if (!(MODES as readonly string[]).includes(mode) || !ALLOWED_STAKES.some(value => value === stake)) throw new Error("Parámetros de matchmaking inválidos");
  return { mode: mode as MatchMode, stake };
}
interface QueueRow { id: string; rating_promedio: number; joined_at: Date | string; prioridad: boolean; }
interface MemberRow { unidad_id: string; usuario_id: string; rating: number; dado_id: string; }
async function waitingUnits(client: SqlClient, mode: MatchMode, stake: bigint, demo: boolean): Promise<QueueUnit[]> {
  const rows = (await client.query<QueueRow>(`SELECT id,rating_promedio,joined_at,prioridad FROM queue_units
    WHERE modo=$1 AND monto_centimos=$2 AND demo=$3 AND estado='esperando' AND disponible_desde<=now()
    ORDER BY prioridad DESC,joined_at,id FOR UPDATE`, [mode, stake.toString(), demo])).rows;
  if (!rows.length) return [];
  const members = (await client.query<MemberRow>(`SELECT unidad_id,usuario_id,rating,dado_id FROM queue_members
    WHERE unidad_id=ANY($1::uuid[]) AND activo ORDER BY usuario_id`, [rows.map(r => r.id)])).rows;
  return rows.map(row => ({ id: row.id, rating: row.rating_promedio, joinedAt: new Date(row.joined_at).getTime(), priority: row.prioridad,
    members: members.filter(m => m.unidad_id === row.id).map(m => ({ id: m.usuario_id, rating: m.rating, dadoId: m.dado_id })) }));
}
async function lockQueue(client: SqlClient, mode: MatchMode, stake: bigint, demo: boolean) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [queueKey(mode, stake.toString(), demo)]);
}
async function createRoom(client: SqlClient, mode: MatchMode, stake: bigint, demo: boolean): Promise<string | null> {
  const selected = matchUnits(await waitingUnits(client, mode, stake, demo), mode, config(mode), Date.now());
  if (!selected) return null;
  const seconds = requiredQueueNumber("CONFIRMATION_SECONDS", 1);
  requiredQueueNumber("CONFIRMATION_PENALTY_SECONDS", 0);
  const id = randomUUID(), commitment = createSeedCommitment();
  const members = selected.units.flatMap(unit => unit.members);
  await client.query(`INSERT INTO partidas(id,modo,demo,monto_entrada_centimos,min_jugadores,max_jugadores,estado,hash_semilla,confirmacion_hasta)
    VALUES($1,$2,$3,$4,$5,$5,'confirmando',$6,now()+$7::int*interval '1 second')`, [id, mode, demo, stake.toString(), members.length, commitment.hash, seconds]);
  await client.query("INSERT INTO semillas_partida(partida_id,semilla_servidor) VALUES($1,$2)", [id, commitment.seed]);
  for (const member of members) {
    const team = selected.teamA.includes(member.id) ? "A" : selected.teamB.includes(member.id) ? "B" : null;
    await client.query(`INSERT INTO participantes(partida_id,usuario_id,equipo,dado_id,apuesta_centimos)
      VALUES($1,$2,$3,$4,$5)`, [id, member.id, team, member.dadoId, stake.toString()]);
  }
  await client.query("UPDATE queue_units SET estado='asignado',partida_id=$1 WHERE id=ANY($2::uuid[])", [id, selected.units.map(unit => unit.id)]);
  return id;
}
/** Redis stores queue IDs and ratings only. PostgreSQL can rebuild it after any failure. */
export async function rebuildQueueIndex(mode: MatchMode, stake: bigint, demo = demoMode()): Promise<boolean> {
  const redis = getRedisIndex();
  if (!redis) return false;
  try {
    const rows = (await getDatabase().query<{ id: string; rating_promedio: number }>(`SELECT id,rating_promedio FROM queue_units
      WHERE modo=$1 AND monto_centimos=$2 AND demo=$3 AND estado='esperando' AND disponible_desde<=now()`, [mode, stake.toString(), demo])).rows;
    await redis.command("EVAL", "redis.call('DEL', KEYS[1]); for i=1,#ARGV,2 do redis.call('ZADD',KEYS[1],ARGV[i],ARGV[i+1]); end; return #ARGV/2", 1, queueKey(mode, stake.toString(), demo), ...rows.flatMap(row => [row.rating_promedio, row.id]));
    return true;
  } catch { return false; }
}
export async function joinQueue(dni: string, modeName: string, amount: unknown, options: { groupId?: string; dadoId?: string } = {}) {
  if (!validDni(dni)) throw new Error("DNI inválido");
  const { mode, stake } = parameters(modeName, amount), demo = demoMode();
  config(mode); requiredQueueNumber("CONFIRMATION_SECONDS", 1); requiredQueueNumber("CONFIRMATION_PENALTY_SECONDS", 0);
  await expireConfirmations();
  const matchId = await getDatabase().transaction(async client => {
    await lockQueue(client, mode, stake, demo);
    const actor = (await client.query<{ id: string }>("SELECT id FROM usuarios WHERE dni=$1", [dni])).rows[0];
    if (!actor) throw new Error("Jugador no registrado");
    let ids = [actor.id];
    if (options.groupId) {
      if (!teamSize(mode)) throw new Error("Los grupos requieren modo de equipos");
      const group = (await client.query<{ lider_usuario_id: string }>("SELECT lider_usuario_id FROM equipos WHERE id=$1 FOR UPDATE", [options.groupId])).rows[0];
      if (!group || group.lider_usuario_id !== actor.id) throw new Error("Solo el líder puede inscribir su grupo");
      ids = (await client.query<{ usuario_id: string }>("SELECT usuario_id FROM equipo_miembros WHERE equipo_id=$1 ORDER BY usuario_id", [options.groupId])).rows.map(row => row.usuario_id);
      if (!ids.includes(actor.id) || ids.length > teamSize(mode)) throw new Error("Tamaño de grupo incompatible");
    }
    const players = (await client.query<{ id: string; rating: number; disponible_centimos: string; habilitado: boolean }>(`SELECT u.id,
      COALESCE(r.rating,1200) AS rating,b.disponible_centimos,
      (u.estado='activo' AND (u.autoexcluido_hasta IS NULL OR u.autoexcluido_hasta<=now())) AS habilitado
      FROM usuarios u JOIN billeteras b ON b.usuario_id=u.id AND b.demo=$2
      LEFT JOIN ratings r ON r.usuario_id=u.id AND r.modo=$3 WHERE u.id=ANY($1::uuid[]) ORDER BY u.id FOR UPDATE OF u`, [ids, demo, mode])).rows;
    if (players.length !== ids.length || players.some(p => !p.habilitado)) throw new Error("Jugador no habilitado");
    if (players.some(p => BigInt(p.disponible_centimos) < stake)) throw new Error("Saldo insuficiente");
    const existing = (await client.query<{ id: string; modo: string; monto_centimos: string; demo: boolean; estado: string; partida_id: string | null; grupo_id: string | null }>(`SELECT q.* FROM queue_units q JOIN queue_members m ON m.unidad_id=q.id
      WHERE m.usuario_id=ANY($1::uuid[]) AND m.activo`, [ids])).rows;
    if (existing.length) {
      const unit = existing[0];
      if (existing.length !== ids.length || existing.some(e => e.id !== unit.id) || unit.modo !== mode || BigInt(unit.monto_centimos) !== stake || unit.demo !== demo || unit.grupo_id !== (options.groupId || null)) throw new Error("Ya participas en otra cola o partida");
      return unit.partida_id || createRoom(client, mode, stake, demo);
    }
    const dadoId = options.dadoId || "rojo";
    if (!(await client.query("SELECT id FROM dados WHERE id=$1 AND activo", [dadoId])).rowCount) throw new Error("Dado inválido");
    const unitId = randomUUID(), rating = players.reduce((total, p) => total + p.rating, 0) / players.length;
    await client.query(`INSERT INTO queue_units(id,modo,monto_centimos,demo,grupo_id,rating_promedio,disponible_desde)
      VALUES($1,$2,$3,$4,$5,$6,GREATEST(now(),COALESCE((SELECT max(hasta) FROM queue_penalties WHERE usuario_id=ANY($7::uuid[])),now())))`, [unitId, mode, stake.toString(), demo, options.groupId || null, rating, ids]);
    for (const player of players) await client.query("INSERT INTO queue_members(unidad_id,usuario_id,rating,dado_id) VALUES($1,$2,$3,$4)", [unitId, player.id, player.rating, dadoId]);
    return createRoom(client, mode, stake, demo);
  });
  await rebuildQueueIndex(mode, stake, demo);
  return matchId;
}
export async function checkMatchmaking(modeName: string, amount: unknown) {
  const { mode, stake } = parameters(modeName, amount), demo = demoMode();
  await expireConfirmations();
  const result = await getDatabase().transaction(async client => { await lockQueue(client, mode, stake, demo); return createRoom(client, mode, stake, demo); });
  await rebuildQueueIndex(mode, stake, demo);
  return result;
}
export async function leaveQueue(dni: string) {
  if (!validDni(dni)) throw new Error("DNI inválido");
  const removed = await getDatabase().transaction(async client => {
    const rows = (await client.query<{ id: string; modo: MatchMode; monto_centimos: string; demo: boolean; estado: string }>(`SELECT q.* FROM queue_units q
      JOIN queue_members m ON m.unidad_id=q.id JOIN usuarios u ON u.id=m.usuario_id WHERE u.dni=$1 AND m.activo FOR UPDATE OF q`, [dni])).rows;
    for (const row of rows) {
      if (row.estado !== "esperando") throw new Error("La sala ya requiere confirmación; espera su vencimiento");
      await client.query("UPDATE queue_units SET estado='retirado' WHERE id=$1", [row.id]);
      await client.query("UPDATE queue_members SET activo=false WHERE unidad_id=$1", [row.id]);
    }
    return rows;
  });
  for (const row of removed) await rebuildQueueIndex(row.modo, BigInt(row.monto_centimos), row.demo);
}
export async function getMatchStatus(dni: string) {
  if (!validDni(dni)) throw new Error("DNI inválido");
  await expireConfirmations();
  type Waiting = { modo: MatchMode; monto_centimos: string; joined_at: Date; disponible_desde: Date };
  const query = `SELECT q.* FROM queue_units q JOIN queue_members m ON m.unidad_id=q.id JOIN usuarios u ON u.id=m.usuario_id WHERE u.dni=$1 AND m.activo AND q.estado='esperando'`;
  let queue = (await getDatabase().query<Waiting>(query, [dni])).rows[0];
  if (queue) {
    await checkMatchmaking(queue.modo, BigInt(queue.monto_centimos) / 100n);
    queue = (await getDatabase().query<Waiting>(query, [dni])).rows[0];
    if (queue) {
      const range = searchRange(new Date(queue.joined_at).getTime(), Date.now(), config(queue.modo).maxRange);
      return { status: "buscando", range, atMaximumRange: range === config(queue.modo).maxRange, availableAt: queue.disponible_desde };
    }
  }
  const room = (await getDatabase().query<{ id: string; modo: string; hash_semilla: string; confirmacion_hasta: Date }>(`SELECT p.id,p.modo,p.hash_semilla,p.confirmacion_hasta
    FROM partidas p JOIN participantes a ON a.partida_id=p.id JOIN usuarios u ON u.id=a.usuario_id
    WHERE u.dni=$1 AND p.estado NOT IN ('anulada') AND NOT EXISTS(SELECT 1 FROM online_room_views v WHERE v.partida_id=p.id AND v.usuario_id=u.id)
    AND EXISTS(SELECT 1 FROM queue_units q WHERE q.partida_id=p.id) ORDER BY p.creada_en DESC LIMIT 1`, [dni])).rows[0];
  return room ? { status: "encontrada", salaId: room.id, modo: room.modo, seedHash: room.hash_semilla, confirmationDeadline: room.confirmacion_hasta } : { status: "inactivo" };
}
export async function confirmRoomInTransaction(client: SqlClient, matchId: string, dni: string) {
  const room = (await client.query<{ estado: string; vencida: boolean }>("SELECT estado,confirmacion_hasta<=now() AS vencida FROM partidas WHERE id=$1 FOR UPDATE", [matchId])).rows[0];
  if (!room) throw new Error("Sala no encontrada");
  const participant = (await client.query<{ id: string; confirmado: boolean }>(`SELECT p.id,p.confirmado FROM participantes p JOIN usuarios u ON u.id=p.usuario_id WHERE p.partida_id=$1 AND u.dni=$2`, [matchId, dni])).rows[0];
  if (!participant) throw new Error("No autorizado");
  if (!["confirmando", "en_curso", "finalizada"].includes(room.estado)) throw new Error("Sala no confirmable");
  if (room.estado === "confirmando" && room.vencida) throw new Error("Confirmación vencida");
  if (!participant.confirmado && room.estado !== "confirmando") throw new Error("Participante no confirmado");
  await client.query("UPDATE participantes SET confirmado=true WHERE id=$1", [participant.id]);
  const pending = (await client.query("SELECT id FROM participantes WHERE partida_id=$1 AND NOT confirmado", [matchId])).rowCount;
  return { allConfirmed: pending === 0, matchId };
}
export async function releaseRoomQueue(client: SqlClient, matchId: string) {
  await client.query("UPDATE queue_members SET activo=false WHERE unidad_id IN (SELECT id FROM queue_units WHERE partida_id=$1)", [matchId]);
  await client.query("UPDATE queue_units SET estado='retirado' WHERE partida_id=$1", [matchId]);
}
export async function markRoomViewed(matchId: string, dni: string) {
  const result = await getDatabase().query(`INSERT INTO online_room_views(partida_id,usuario_id)
    SELECT p.id,u.id FROM partidas p JOIN participantes a ON a.partida_id=p.id JOIN usuarios u ON u.id=a.usuario_id
    WHERE p.id=$1 AND u.dni=$2 AND p.estado IN ('finalizada','anulada')
    ON CONFLICT(partida_id,usuario_id) DO UPDATE SET visto_en=now() RETURNING partida_id`, [matchId, dni]);
  if (!result.rowCount) throw new Error("Sala no finalizada o acceso no autorizado");
}
export async function expireConfirmations() {
  return getDatabase().transaction(async client => {
    const rooms = (await client.query<{ id: string }>("SELECT id FROM partidas WHERE estado='confirmando' AND confirmacion_hasta<=now() ORDER BY id FOR UPDATE SKIP LOCKED")).rows;
    if (!rooms.length) return 0;
    const penalty = requiredQueueNumber("CONFIRMATION_PENALTY_SECONDS", 0);
    for (const room of rooms) {
      await client.query(`INSERT INTO queue_penalties(usuario_id,hasta) SELECT usuario_id,now()+$2::int*interval '1 second' FROM participantes WHERE partida_id=$1 AND NOT confirmado
        ON CONFLICT(usuario_id) DO UPDATE SET hasta=GREATEST(queue_penalties.hasta,excluded.hasta)`, [room.id, penalty]);
      await client.query(`UPDATE queue_units q SET estado='esperando',partida_id=NULL,
        prioridad=NOT EXISTS(SELECT 1 FROM queue_members m JOIN participantes p ON p.usuario_id=m.usuario_id AND p.partida_id=$1 WHERE m.unidad_id=q.id AND NOT p.confirmado),
        disponible_desde=GREATEST(now(),COALESCE((SELECT max(p.hasta) FROM queue_members m JOIN queue_penalties p ON p.usuario_id=m.usuario_id WHERE m.unidad_id=q.id),now())) WHERE q.partida_id=$1`, [room.id]);
      await client.query("UPDATE partidas SET estado='anulada',finalizada_en=now() WHERE id=$1", [room.id]);
    }
    return rooms.length;
  });
}
export async function setDisconnected(matchId: string, dni: string) {
  await getDatabase().query(`UPDATE participantes p SET estado='desconectado',desconectado_en=COALESCE(desconectado_en,now()) FROM usuarios u,partidas g
    WHERE p.usuario_id=u.id AND u.dni=$2 AND p.partida_id=$1 AND g.id=p.partida_id AND g.estado IN ('en_curso','en_desempate') AND p.estado='activo'`, [matchId, dni]);
}
export async function reconnectRoom(matchId: string, dni: string) {
  return getDatabase().transaction(async client => {
    await client.query("SELECT id FROM partidas WHERE id=$1 FOR UPDATE", [matchId]);
    const result = await client.query(`UPDATE participantes p SET estado='activo',desconectado_en=NULL FROM usuarios u,partidas g
      WHERE p.usuario_id=u.id AND u.dni=$2 AND p.partida_id=$1 AND g.id=p.partida_id AND g.estado IN ('en_curso','en_desempate')
      AND p.estado='desconectado' AND p.desconectado_en>now()-interval '60 seconds' RETURNING p.id`, [matchId, dni]);
    return result.rowCount === 1;
  });
}
export async function expireDisconnects() {
  return getDatabase().transaction(async client => {
    const rooms = (await client.query<{ id: string }>(`SELECT p.id FROM partidas p WHERE estado IN ('en_curso','en_desempate')
      AND EXISTS(SELECT 1 FROM participantes a WHERE a.partida_id=p.id AND a.estado='desconectado' AND a.desconectado_en<=now()-interval '60 seconds')
      ORDER BY p.id FOR UPDATE SKIP LOCKED`)).rows;
    for (const room of rooms) {
      // TODO(DECISIÓN): no forfeiture is applied before defining the abandonment rule.
      await client.query("UPDATE partidas SET estado='en_disputa' WHERE id=$1", [room.id]);
      await client.query(`INSERT INTO auditoria_admin(actor,accion,referencia_tipo,referencia_id,detalle)
        VALUES('servidor','desconexion_60s_pendiente_regla','partida',$1,'{"decision":"abandono pendiente; saldo congelado"}'::jsonb)`, [room.id]);
    }
    return rooms.length;
  });
}
