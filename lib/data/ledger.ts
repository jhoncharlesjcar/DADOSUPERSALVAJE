import "server-only";
import type { SqlClient } from "./database";
import { splitPot } from "./money";

export interface WalletRow {
  id: string; usuario_id: string | null; sistema: string | null; demo: boolean;
  disponible_centimos: string; bloqueado_centimos: string; bono_centimos: string;
}
interface MatchRow {
  id: string; estado: string; demo: boolean; modo: string; monto_entrada_centimos: string;
  min_jugadores: number | null; max_jugadores: number; hash_semilla: string | null;
  ganador_usuario_id: string | null; ganador_equipo: string | null;
}
interface MemberRow {
  id: string; usuario_id: string; equipo: string | null; confirmado: boolean; apuesta_centimos: string;
  estado_usuario: string; excluido: boolean; adulto: boolean; estado_identidad: string;
}
export class LedgerError extends Error {}
export function requireRealMoneyEnabled() {
  if (process.env.DINERO_REAL_HABILITADO !== "true") throw new LedgerError("Dinero real deshabilitado");
}
async function lockMatch(client: SqlClient, id: string) {
  const match = (await client.query<MatchRow>("SELECT * FROM partidas WHERE id=$1 FOR UPDATE", [id])).rows[0];
  if (!match) throw new LedgerError("Partida inexistente");
  return match;
}
async function lockMembers(client: SqlClient, id: string) {
  return (await client.query<MemberRow>(`SELECT p.*, u.estado AS estado_usuario, u.estado_identidad,
    COALESCE(u.autoexcluido_hasta > now(),false) AS excluido,
    COALESCE(u.fecha_nacimiento <= ((now() AT TIME ZONE 'America/Lima')::date - INTERVAL '18 years')::date,false) AS adulto
    FROM participantes p JOIN usuarios u ON u.id=p.usuario_id
    WHERE p.partida_id=$1 ORDER BY u.id FOR UPDATE OF u,p`, [id])).rows;
}
async function lockWallets(client: SqlClient, members: MemberRow[], demo: boolean, system = false) {
  return (await client.query<WalletRow>(`SELECT * FROM billeteras WHERE demo=$1
    AND (usuario_id=ANY($2::uuid[]) OR ($3 AND sistema IS NOT NULL)) ORDER BY id FOR UPDATE`,
  [demo, members.map(p => p.usuario_id), system])).rows;
}
export async function audit(client: SqlClient, actor: string, action: string, kind: string, id: string, detail: object = {}) {
  if (!actor.trim()) throw new LedgerError("Actor de auditoría requerido");
  await client.query(`INSERT INTO auditoria_admin(actor,accion,referencia_tipo,referencia_id,detalle)
    VALUES($1,$2,$3,$4,$5::jsonb)`, [actor, action, kind, id, JSON.stringify(detail)]);
}
/** Only call inside the same database transaction as the owning business operation. */
export async function postMovement(client: SqlClient, walletId: string, type: string, available: bigint,
  blocked: bigint, kind: string, reference: string, key: string, description = "") {
  const wallet = (await client.query<WalletRow>("SELECT * FROM billeteras WHERE id=$1 FOR UPDATE", [walletId])).rows[0];
  if (!wallet) throw new LedgerError("Billetera inexistente");
  const previous = (await client.query<{ billetera_id: string; disponible_delta: string; bloqueado_delta: string;
    tipo: string; referencia_tipo: string; referencia_id: string }>(
    "SELECT * FROM movimientos WHERE clave_idempotencia=$1", [key])).rows[0];
  if (previous) {
    if (previous.billetera_id !== walletId || BigInt(previous.disponible_delta) !== available ||
      BigInt(previous.bloqueado_delta) !== blocked || previous.tipo !== type ||
      previous.referencia_tipo !== kind || previous.referencia_id !== reference) throw new LedgerError("Conflicto de idempotencia");
    return { replay: true, wallet };
  }
  if (BigInt(wallet.disponible_centimos) + available < 0n || BigInt(wallet.bloqueado_centimos) + blocked < 0n) {
    throw new LedgerError("Saldo insuficiente");
  }
  const updated = (await client.query<WalletRow>(`UPDATE billeteras SET
    disponible_centimos=disponible_centimos+$2::bigint,bloqueado_centimos=bloqueado_centimos+$3::bigint,
    version=version+1,actualizado_en=now() WHERE id=$1 RETURNING *`, [walletId, available.toString(), blocked.toString()])).rows[0];
  await client.query(`INSERT INTO movimientos(billetera_id,tipo,monto_centimos,disponible_delta,bloqueado_delta,
    saldo_disponible_despues,saldo_bloqueado_despues,referencia_tipo,referencia_id,clave_idempotencia,descripcion,saldo_bono_despues)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [walletId, type, (available + blocked).toString(),
    available.toString(), blocked.toString(), updated.disponible_centimos, updated.bloqueado_centimos,
    kind, reference, key, description, updated.bono_centimos]);
  return { replay: false, wallet: updated };
}
function memberWallet(wallets: WalletRow[], id: string) {
  const wallet = wallets.find(w => w.usuario_id === id);
  if (!wallet) throw new LedgerError("Billetera del participante inexistente");
  return wallet;
}
export async function checkEligibility(client: SqlClient, userId: string, demo: boolean, exposure = 0n) {
  const user = (await client.query<{ estado: string; excluido: boolean; adulto: boolean; estado_identidad: string }>(
    `SELECT estado,estado_identidad,COALESCE(autoexcluido_hasta>now(),false) AS excluido,
    COALESCE(fecha_nacimiento <= ((now() AT TIME ZONE 'America/Lima')::date - INTERVAL '18 years')::date,false) AS adulto
    FROM usuarios WHERE id=$1 FOR UPDATE`, [userId])).rows[0];
  if (!user || user.estado !== "activo" || user.excluido) throw new LedgerError("Jugador bloqueado o autoexcluido");
  if (demo) return;
  requireRealMoneyEnabled();
  if (!user.adulto || user.estado_identidad !== "verificado") throw new LedgerError("Identidad y mayoría de edad requeridas");
  if (exposure > 0n) {
    const limit = (await client.query<{ perdida_diaria_centimos: string | null }>(
      "SELECT perdida_diaria_centimos FROM limites_usuario WHERE usuario_id=$1 FOR UPDATE", [userId])).rows[0];
    if (limit?.perdida_diaria_centimos == null) throw new LedgerError("TODO(DECISIÓN): límite diario de pérdida requerido");
    const loss = (await client.query<{ value: string }>(`SELECT GREATEST(0,-COALESCE(SUM(m.monto_centimos),0))::text AS value
      FROM movimientos m JOIN billeteras b ON b.id=m.billetera_id WHERE b.usuario_id=$1 AND NOT b.demo
      AND m.tipo IN ('apuesta_cobro','premio') AND m.creado_en >=
      (date_trunc('day',now() AT TIME ZONE 'America/Lima') AT TIME ZONE 'America/Lima')`, [userId])).rows[0];
    const held = (await client.query<{ value: string }>(`SELECT COALESCE(SUM(m.bloqueado_delta),0)::text AS value
      FROM movimientos m JOIN billeteras b ON b.id=m.billetera_id WHERE b.usuario_id=$1 AND NOT b.demo
      AND m.referencia_tipo='partida'`, [userId])).rows[0];
    if (BigInt(loss.value) + BigInt(held?.value ?? "0") + exposure > BigInt(limit.perdida_diaria_centimos)) {
      throw new LedgerError("Límite diario de pérdida alcanzado");
    }
  }
}
export async function blockEntries(client: SqlClient, matchId: string) {
  const match = await lockMatch(client, matchId);
  if (["en_curso", "en_desempate", "finalizada"].includes(match.estado)) return { replay: true };
  if (match.estado !== "confirmando") throw new LedgerError("Partida fuera de confirmación");
  if (!match.hash_semilla) throw new LedgerError("Compromiso de semilla requerido antes de apostar");
  const members = await lockMembers(client, matchId);
  if (match.min_jugadores == null) throw new LedgerError("TODO(DECISIÓN): mínimo de participantes requerido");
  if (members.length < match.min_jugadores || members.length > match.max_jugadores || members.some(p => !p.confirmado)) {
    throw new LedgerError("Todos deben confirmar antes de bloquear dinero");
  }
  if (match.modo === "duelo" && members.length !== 2) throw new LedgerError("Duelo requiere dos participantes");
  if (match.modo.startsWith("equipos_")) {
    const size = Number(match.modo.slice(8,9));
    if (members.length !== size * 2 || ["A","B"].some(team => members.filter(p => p.equipo === team).length !== size)) {
      throw new LedgerError("Equipos incompletos");
    }
  }
  for (const member of members) {
    if (BigInt(member.apuesta_centimos) !== BigInt(match.monto_entrada_centimos)) throw new LedgerError("Apuesta inconsistente");
    await checkEligibility(client, member.usuario_id, match.demo, BigInt(member.apuesta_centimos));
  }
  const wallets = await lockWallets(client, members, match.demo);
  for (const member of members) {
    const amount = BigInt(member.apuesta_centimos);
    await postMovement(client, memberWallet(wallets, member.usuario_id).id, "apuesta_bloqueo", -amount, amount,
      "partida", matchId, `${matchId}:${member.usuario_id}:bloqueo`);
  }
  await client.query("UPDATE partidas SET estado='en_curso',iniciada_en=now(),pozo_centimos=$2 WHERE id=$1",
    [matchId, (BigInt(match.monto_entrada_centimos) * BigInt(members.length)).toString()]);
  return { replay: false };
}
export async function settleMatch(client: SqlClient, matchId: string, winnerUserIds: string[]) {
  const match = await lockMatch(client, matchId);
  const members = await lockMembers(client, matchId);
  const winners = match.modo.startsWith("equipos_")
    ? members.filter(p => match.ganador_equipo && p.equipo === match.ganador_equipo).map(p => p.usuario_id)
    : match.ganador_usuario_id ? [match.ganador_usuario_id] : [];
  if (!winners.length || new Set(winnerUserIds).size !== winnerUserIds.length || winners.length !== winnerUserIds.length ||
    winners.some(id => !winnerUserIds.includes(id) || !members.some(p => p.usuario_id === id))) {
    throw new LedgerError("Ganador explícito del servidor requerido");
  }
  const pot = members.reduce((sum, p) => sum + BigInt(p.apuesta_centimos), 0n);
  const split = splitPot(pot, winners.length);
  if (match.estado === "finalizada") return { replay: true, split };
  if (!["en_curso","en_desempate"].includes(match.estado)) throw new LedgerError("Partida no liquidable");
  const wallets = await lockWallets(client, members, match.demo, true);
  for (const member of members) {
    const reservation = (await client.query<{ bloqueado_delta: string }>(
      "SELECT bloqueado_delta FROM movimientos WHERE clave_idempotencia=$1 AND billetera_id=$2",
      [`${matchId}:${member.usuario_id}:bloqueo`, memberWallet(wallets, member.usuario_id).id])).rows[0];
    if (!reservation || BigInt(reservation.bloqueado_delta) !== BigInt(member.apuesta_centimos)) {
      throw new LedgerError("La apuesta de esta partida no fue bloqueada");
    }
    await postMovement(client, memberWallet(wallets, member.usuario_id).id, "apuesta_cobro", 0n,
      -BigInt(member.apuesta_centimos), "partida", matchId, `${matchId}:${member.usuario_id}:cobro`);
    if (winners.includes(member.usuario_id)) {
      await postMovement(client, memberWallet(wallets, member.usuario_id).id, "premio", split.each, 0n,
        "partida", matchId, `${matchId}:${member.usuario_id}:premio`);
      await client.query("UPDATE participantes SET premio_centimos=$3,posicion=1 WHERE partida_id=$1 AND usuario_id=$2",
        [matchId, member.usuario_id, split.each.toString()]);
    }
  }
  for (const [system, type, amount] of [["CASA","comision_casa",split.house],["FONDO_RANKING","fondo_ranking",split.ranking]] as const) {
    const wallet = wallets.find(w => w.sistema === system);
    if (!wallet) throw new LedgerError("Billetera de sistema inexistente");
    await postMovement(client, wallet.id, type, amount, 0n, "partida", matchId, `${matchId}:${system}`);
  }
  const sum = (await client.query<{ total: string }>(`SELECT COALESCE(SUM(monto_centimos),0)::text AS total
    FROM movimientos WHERE referencia_tipo='partida' AND referencia_id=$1`, [matchId])).rows[0];
  if (BigInt(sum.total) !== 0n) throw new LedgerError("La liquidación no conserva el dinero");
  await client.query(`INSERT INTO comisiones_casa(partida_id,pozo,monto_casa,monto_ranking) VALUES($1,$2,$3,$4)`,
    [matchId, pot.toString(), split.house.toString(), split.ranking.toString()]);
  await client.query(`UPDATE partidas SET estado='finalizada',finalizada_en=now(),pozo_centimos=$2,
    comision_casa_centimos=$3,fondo_ranking_centimos=$4,premio_centimos=$5,
    semilla_revelada=(SELECT semilla_servidor FROM semillas_partida WHERE partida_id=$1) WHERE id=$1`,
  [matchId, pot.toString(), split.house.toString(), split.ranking.toString(), split.prize.toString()]);
  return { replay: false, split };
}
export async function cancelMatch(client: SqlClient, matchId: string) {
  const match = await lockMatch(client, matchId);
  if (match.estado === "anulada") return { replay: true };
  if (["finalizada","en_disputa"].includes(match.estado)) throw new LedgerError("Partida no anulable sin resolución de disputa");
  const members = await lockMembers(client, matchId);
  const wallets = await lockWallets(client, members, match.demo);
  for (const member of members) {
    const blocked = (await client.query("SELECT id FROM movimientos WHERE clave_idempotencia=$1", [`${matchId}:${member.usuario_id}:bloqueo`])).rowCount;
    if (blocked) await postMovement(client, memberWallet(wallets, member.usuario_id).id, "apuesta_liberacion",
      BigInt(member.apuesta_centimos), -BigInt(member.apuesta_centimos), "partida", matchId, `${matchId}:${member.usuario_id}:liberacion`);
  }
  await client.query("UPDATE partidas SET estado='anulada',finalizada_en=now() WHERE id=$1", [matchId]);
  return { replay: false };
}
export async function disputeMatch(client: SqlClient, matchId: string, actor: string, reason: string) {
  const match = await lockMatch(client, matchId);
  if (match.estado === "en_disputa") return { replay: true };
  if (!["en_curso","en_desempate"].includes(match.estado) || !reason.trim()) throw new LedgerError("Disputa inválida");
  await client.query("UPDATE partidas SET estado='en_disputa' WHERE id=$1", [matchId]);
  await audit(client, actor, "abrir_disputa", "partida", matchId, { reason });
  return { replay: false };
}
export async function adjustDemoBalance(client: SqlClient, userId: string, delta: bigint, key: string, reason: string, actor = "admin") {
  if (!reason.trim() || !key.trim() || delta === 0n) throw new LedgerError("Motivo, clave e importe requeridos");
  await client.query("SELECT id FROM usuarios WHERE id=$1 FOR UPDATE", [userId]);
  const wallet = (await client.query<WalletRow>("SELECT * FROM billeteras WHERE usuario_id=$1 AND demo FOR UPDATE", [userId])).rows[0];
  if (!wallet) throw new LedgerError("Billetera demo inexistente");
  const result = await postMovement(client, wallet.id, "ajuste_admin", delta, 0n, "ajuste_demo", userId, key, reason);
  if (!result.replay) await audit(client, actor, "ajuste_demo", "usuario", userId, { delta: delta.toString(), key, reason });
  return result.wallet;
}
