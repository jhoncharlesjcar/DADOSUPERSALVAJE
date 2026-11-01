import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabase, type SqlClient } from "./database";
import { cents } from "./money";
import { audit, checkEligibility, postMovement, requireRealMoneyEnabled, type WalletRow } from "./ledger";
import { getIdentityVerifier } from "./identity";

export type PaymentProvider = "niubiz" | "izipay" | "culqi" | "mercadopago";
export interface VerifiedPayment {
  recargaId: string; idExterno: string; montoCentimos: string; moneda: "PEN";
  estado: "confirmada" | "fallida"; evidencia: Record<string, unknown>;
}
export interface PasarelaPago {
  nombre: PaymentProvider;
  crearCobro(input: { id: string; montoCentimos: string; moneda: "PEN"; metodo: string }): Promise<{
    idExterno: string; instrucciones: Record<string, unknown>;
  }>;
  /** Must authenticate raw bytes, timestamp/replay bounds and the provider's documented signature. */
  verificarWebhook(rawBody: string, headers: Headers): Promise<VerifiedPayment>;
  reporteDiario(fecha: string): Promise<Array<{ idExterno: string; montoCentimos: string; moneda: "PEN" }>>;
}
let testGateway: PasarelaPago | undefined;
export function setPaymentGatewayForTests(gateway: PasarelaPago | undefined) {
  if (process.env.NODE_ENV !== "test") throw new Error("Solo para pruebas");
  testGateway = gateway;
}
export function getPaymentGateway(name: string): PasarelaPago {
  if (testGateway?.nombre === name) return testGateway;
  // TODO(DECISIÓN): provider selection and signature/secret contract; fail closed until implemented.
  throw new Error("TODO(DECISIÓN): pasarela de pago no configurada");
}
function positiveAmount(value: unknown) {
  const amount = cents(value);
  if (amount <= 0n) throw new Error("Monto positivo requerido");
  return amount;
}
function idempotencyKey(value: string) {
  if (!/^[a-zA-Z0-9:_-]{16,160}$/.test(value)) throw new Error("Clave de idempotencia inválida");
  return value;
}
const todaySql = "(date_trunc('day',now() AT TIME ZONE 'America/Lima') AT TIME ZONE 'America/Lima')";
async function enforceDepositLimit(client: SqlClient, userId: string, amount: bigint, exceptId?: string) {
  const limit = (await client.query<{ recarga_diaria_centimos: string | null }>(
    "SELECT recarga_diaria_centimos FROM limites_usuario WHERE usuario_id=$1 FOR UPDATE", [userId])).rows[0];
  if (limit?.recarga_diaria_centimos == null) throw new Error("TODO(DECISIÓN): límite diario de recarga requerido");
  const total = (await client.query<{ total: string }>(`SELECT COALESCE(SUM(monto_centimos),0)::text AS total FROM recargas
    WHERE usuario_id=$1 AND estado IN ('pendiente','confirmada','revision') AND (creada_en >= ${todaySql} OR confirmada_en >= ${todaySql})
    AND ($2::uuid IS NULL OR id <> $2)`, [userId, exceptId ?? null])).rows[0];
  if (BigInt(total.total) + amount > BigInt(limit.recarga_diaria_centimos)) throw new Error("Límite diario de recarga alcanzado");
}
interface RechargeRow {
  id: string; usuario_id: string; monto_centimos: string; pasarela: string; metodo: string;
  id_externo: string | null; estado: string;
}
export async function createRecharge(userId: string, amountInput: string, provider: string, method: string, key: string) {
  requireRealMoneyEnabled();
  const gateway = getPaymentGateway(provider);
  const amount = positiveAmount(amountInput);
  idempotencyKey(key);
  if (!method || method.length > 40) throw new Error("Método de pago inválido");
  const recharge = await getDatabase().transaction(async client => {
    await checkEligibility(client, userId, false);
    const old = (await client.query<RechargeRow>("SELECT * FROM recargas WHERE clave_idempotencia=$1 FOR UPDATE", [key])).rows[0];
    if (old) {
      if (old.usuario_id !== userId || BigInt(old.monto_centimos) !== amount || old.pasarela !== provider || old.metodo !== method) {
        throw new Error("Conflicto de idempotencia");
      }
      return old;
    }
    await enforceDepositLimit(client, userId, amount);
    return (await client.query<RechargeRow>(`INSERT INTO recargas(usuario_id,monto_centimos,pasarela,metodo,clave_idempotencia)
      VALUES($1,$2,$3,$4,$5) RETURNING *`, [userId, amount.toString(), provider, method, key])).rows[0];
  });
  if (recharge.estado === "confirmada") return { id: recharge.id, estado: recharge.estado, idExterno: recharge.id_externo };
  // The provider MUST honor the internal recharge UUID as its idempotency key, including retries after a timeout.
  const checkout = await gateway.crearCobro({ id: recharge.id, montoCentimos: amount.toString(), moneda: "PEN", metodo: method });
  if (!checkout.idExterno) throw new Error("Pasarela devolvió referencia vacía");
  await getDatabase().transaction(async client => {
    const row = (await client.query<RechargeRow>("SELECT * FROM recargas WHERE id=$1 FOR UPDATE", [recharge.id])).rows[0];
    if (row.id_externo && row.id_externo !== checkout.idExterno) throw new Error("Pasarela no respetó la idempotencia");
    await client.query("UPDATE recargas SET id_externo=$2 WHERE id=$1", [recharge.id, checkout.idExterno]);
  });
  return { id: recharge.id, estado: recharge.estado, ...checkout };
}
export async function handlePaymentWebhook(provider: string, rawBody: string, headers: Headers) {
  requireRealMoneyEnabled();
  // No parsed client fields reach the ledger before the adapter verifies the ORIGINAL signed bytes.
  const event = await getPaymentGateway(provider).verificarWebhook(rawBody, headers);
  const amount = positiveAmount(event.montoCentimos);
  if (event.moneda !== "PEN" || !event.idExterno || !["confirmada","fallida"].includes(event.estado)) throw new Error("Evento de pago inválido");
  return getDatabase().transaction(async client => {
    // Lock the user before the recharge to share lock order with creation and withdrawals.
    const owner = (await client.query<{ usuario_id: string }>("SELECT usuario_id FROM recargas WHERE id=$1", [event.recargaId])).rows[0];
    if (!owner) throw new Error("Recarga desconocida");
    await client.query("SELECT id FROM usuarios WHERE id=$1 FOR UPDATE", [owner.usuario_id]);
    const row = (await client.query<RechargeRow>("SELECT * FROM recargas WHERE id=$1 FOR UPDATE", [event.recargaId])).rows[0];
    if (row.pasarela !== provider || row.id_externo !== event.idExterno || BigInt(row.monto_centimos) !== amount) throw new Error("Evento no coincide con la recarga");
    const credited = (await client.query("SELECT id FROM movimientos WHERE clave_idempotencia=$1", [`recarga:${provider}:${event.idExterno}`])).rowCount > 0;
    if (row.estado === "confirmada" || credited) return { replay: true };
    if (event.estado === "fallida") {
      await client.query("UPDATE recargas SET estado='fallida',payload_webhook=$2::jsonb WHERE id=$1", [row.id, JSON.stringify(event.evidencia)]);
      return { replay: false };
    }
    if (!["pendiente","revision"].includes(row.estado)) throw new Error("Recarga no confirmable");
    await enforceDepositLimit(client, row.usuario_id, amount, row.id);
    const wallet = (await client.query<WalletRow>("SELECT * FROM billeteras WHERE usuario_id=$1 AND NOT demo FOR UPDATE", [row.usuario_id])).rows[0];
    if (!wallet) throw new Error("Billetera real inexistente");
    await postMovement(client, wallet.id, "recarga", amount, 0n, "recarga", row.id, `recarga:${provider}:${event.idExterno}`);
    await client.query("UPDATE recargas SET estado='confirmada',confirmada_en=now(),payload_webhook=$2::jsonb WHERE id=$1", [row.id, JSON.stringify(event.evidencia)]);
    return { replay: false };
  });
}
export async function reconcilePayments(provider: string, date: string) {
  requireRealMoneyEnabled();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new Error("Fecha inválida");
  const report = await getPaymentGateway(provider).reporteDiario(date);
  if (report.some(p => p.moneda !== "PEN") || new Set(report.map(p => p.idExterno)).size !== report.length) throw new Error("Reporte de pasarela inválido");
  const received = new Map(report.map(p => [p.idExterno, positiveAmount(p.montoCentimos)]));
  return getDatabase().transaction(async client => {
    const rows = (await client.query<RechargeRow>(`SELECT * FROM recargas WHERE pasarela=$1
      AND (COALESCE(confirmada_en,creada_en) AT TIME ZONE 'America/Lima')::date=$2::date ORDER BY id FOR UPDATE`, [provider, date])).rows;
    let expected = 0n;
    const differences: Array<{ id: string; expected: string; received: string }> = [];
    for (const row of rows) {
      const credited = (await client.query("SELECT id FROM movimientos WHERE referencia_tipo='recarga' AND referencia_id=$1", [row.id])).rowCount > 0;
      const expectedForRow = credited ? BigInt(row.monto_centimos) : 0n;
      const receivedForRow = row.id_externo ? received.get(row.id_externo) ?? 0n : 0n;
      expected += expectedForRow;
      if (expectedForRow !== receivedForRow) {
        differences.push({ id: row.id, expected: expectedForRow.toString(), received: receivedForRow.toString() });
        await client.query("UPDATE recargas SET estado='revision' WHERE id=$1", [row.id]);
      }
      if (row.id_externo) received.delete(row.id_externo);
    }
    for (const [external, value] of received) differences.push({ id: external, expected: "0", received: value.toString() });
    const actual = report.reduce((sum, item) => sum + positiveAmount(item.montoCentimos), 0n);
    await client.query(`INSERT INTO conciliaciones(fecha,pasarela,esperado_centimos,recibido_centimos,diferencia_centimos,detalle)
      VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(fecha,pasarela) DO UPDATE SET esperado_centimos=EXCLUDED.esperado_centimos,
      recibido_centimos=EXCLUDED.recibido_centimos,diferencia_centimos=EXCLUDED.diferencia_centimos,detalle=EXCLUDED.detalle,creado_en=now()`,
    [date, provider, expected.toString(), actual.toString(), (actual - expected).toString(), JSON.stringify({ differences })]);
    return { expected: expected.toString(), received: actual.toString(), difference: (actual - expected).toString(), differences };
  });
}
export async function requestWithdrawal(userId: string, amountInput: string, account: string, bank: string, key: string) {
  requireRealMoneyEnabled();
  const amount = positiveAmount(amountInput);
  idempotencyKey(key);
  if (!account.trim() || account.length > 100 || !bank.trim() || bank.length > 80) throw new Error("Cuenta inválida");
  const user = (await getDatabase().query<{ dni: string }>("SELECT dni FROM usuarios WHERE id=$1", [userId])).rows[0];
  if (!user) throw new Error("Jugador inexistente");
  const proof = await getIdentityVerifier().verificarTitularCuenta({ usuarioId: userId, dni: user.dni, cuenta: account, banco: bank });
  if (!proof.coincideTitular || !proof.referencia) throw new Error("La cuenta debe pertenecer al mismo titular");
  return getDatabase().transaction(async client => {
    await checkEligibility(client, userId, false);
    const old = (await client.query<{ id: string; usuario_id: string; monto_centimos: string; cuenta_destino: { cuenta: string; banco: string } }>(
      "SELECT * FROM retiros WHERE clave_idempotencia=$1 FOR UPDATE", [key])).rows[0];
    if (old) {
      if (old.usuario_id !== userId || BigInt(old.monto_centimos) !== amount || old.cuenta_destino.cuenta !== account || old.cuenta_destino.banco !== bank) throw new Error("Conflicto de idempotencia");
      return { id: old.id, replay: true };
    }
    const limit = (await client.query<{ retiro_diario_centimos: string | null }>("SELECT retiro_diario_centimos FROM limites_usuario WHERE usuario_id=$1 FOR UPDATE", [userId])).rows[0];
    if (limit?.retiro_diario_centimos == null) throw new Error("TODO(DECISIÓN): límite diario de retiro requerido");
    const total = (await client.query<{ total: string }>(`SELECT COALESCE(SUM(monto_centimos),0)::text AS total FROM retiros
      WHERE usuario_id=$1 AND estado <> 'rechazado' AND solicitado_en >= ${todaySql}`, [userId])).rows[0];
    if (BigInt(total.total) + amount > BigInt(limit.retiro_diario_centimos)) throw new Error("Límite diario de retiro alcanzado");
    const wallet = (await client.query<WalletRow>("SELECT * FROM billeteras WHERE usuario_id=$1 AND NOT demo FOR UPDATE", [userId])).rows[0];
    if (!wallet) throw new Error("Billetera real inexistente");
    const id = randomUUID();
    await client.query(`INSERT INTO retiros(id,usuario_id,monto_centimos,cuenta_destino,clave_idempotencia) VALUES($1,$2,$3,$4::jsonb,$5)`,
      [id, userId, amount.toString(), JSON.stringify({ cuenta: account, banco: bank, verificacion: proof.referencia }), key]);
    await postMovement(client, wallet.id, "retiro", -amount, amount, "retiro", id, `retiro:${id}:reserva`);
    return { id, replay: false };
  });
}
export async function reviewWithdrawal(id: string, action: "aprobar" | "rechazar" | "pagado", actor: string, reason: string) {
  requireRealMoneyEnabled();
  if (!reason.trim()) throw new Error("Motivo o comprobante requerido");
  return getDatabase().transaction(async client => {
    const owner = (await client.query<{ usuario_id: string }>("SELECT usuario_id FROM retiros WHERE id=$1", [id])).rows[0];
    if (!owner) throw new Error("Retiro inexistente");
    await client.query("SELECT id FROM usuarios WHERE id=$1 FOR UPDATE", [owner.usuario_id]);
    const withdrawal = (await client.query<{ usuario_id: string; estado: string; monto_centimos: string }>("SELECT * FROM retiros WHERE id=$1 FOR UPDATE", [id])).rows[0];
    const state = { aprobar: "aprobado", rechazar: "rechazado", pagado: "pagado" }[action];
    if (!state) throw new Error("Acción inválida");
    if (withdrawal.estado === state) return { replay: true };
    if ((action === "aprobar" && withdrawal.estado !== "solicitado") ||
      (action === "pagado" && withdrawal.estado !== "aprobado") ||
      (action === "rechazar" && !["solicitado","aprobado"].includes(withdrawal.estado))) throw new Error("Transición de retiro inválida");
    if (action !== "aprobar") {
      const wallet = (await client.query<WalletRow>("SELECT * FROM billeteras WHERE usuario_id=$1 AND NOT demo FOR UPDATE", [withdrawal.usuario_id])).rows[0];
      const amount = BigInt(withdrawal.monto_centimos);
      await postMovement(client, wallet.id, action === "pagado" ? "retiro" : "devolucion", action === "rechazar" ? amount : 0n,
        -amount, "retiro", id, `retiro:${id}:${state}`);
    }
    await client.query(`UPDATE retiros SET estado=$2,revisado_por=$3,revisado_en=now(),
      pagado_en=CASE WHEN $2='pagado' THEN now() ELSE pagado_en END WHERE id=$1`, [id, state, actor]);
    await audit(client, actor, `retiro_${state}`, "retiro", id, { reason });
    return { replay: false };
  });
}
