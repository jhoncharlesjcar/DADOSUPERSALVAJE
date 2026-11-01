// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { createTestDatabase } from "./helpers/postgres";
import { setTestDatabase } from "../lib/data/database";
import { setIdentityVerifierForTests } from "../lib/data/identity";
import { createRecharge, handlePaymentWebhook, reconcilePayments, requestWithdrawal, reviewWithdrawal,
  setPaymentGatewayForTests, type VerifiedPayment, type PasarelaPago } from "../lib/data/payments";

let db: Awaited<ReturnType<typeof createTestDatabase>>;
let nextDni = 52000000;
let report: Awaited<ReturnType<PasarelaPago["reporteDiario"]>> = [];
const signature = (body: string) => createHmac("sha256", "test-contract-only").update(body).digest("hex");
const gateway: PasarelaPago = {
  nombre: "culqi",
  async crearCobro(input) { return { idExterno: `test-${input.id}`, instrucciones: { id: input.id } }; },
  async verificarWebhook(body, headers) {
    // Test adapter, deliberately not an implementation of Culqi's production signature protocol.
    if (headers.get("X-Test-Signature") !== signature(body)) throw new Error("Firma inválida");
    return JSON.parse(body) as VerifiedPayment;
  },
  async reporteDiario() { return report; },
};
async function user() {
  const id = randomUUID();
  await db.query(`INSERT INTO usuarios(id,dni,nombres,fecha_nacimiento,estado_identidad)
    VALUES($1,$2,'Prueba','1990-01-01','verificado')`, [id, String(nextDni++)]);
  await db.query("INSERT INTO billeteras(usuario_id,demo,disponible_centimos) VALUES($1,false,10000),($1,true,777)", [id]);
  await db.query(`INSERT INTO limites_usuario(usuario_id,recarga_diaria_centimos,retiro_diario_centimos,perdida_diaria_centimos)
    VALUES($1,5000,5000,5000)`, [id]);
  return id;
}
async function balance(id: string) {
  return (await db.query<{ disponible_centimos: string; bloqueado_centimos: string }>(
    "SELECT disponible_centimos::text,bloqueado_centimos::text FROM billeteras WHERE usuario_id=$1 AND NOT demo", [id])).rows[0];
}
async function eventFor(userId: string, amount = "1000") {
  const created = await createRecharge(userId, amount, "culqi", "yape", `test:${randomUUID()}`);
  const event: VerifiedPayment = { recargaId: created.id, idExterno: created.idExterno!, montoCentimos: amount,
    moneda: "PEN", estado: "confirmada", evidencia: { receipt: created.id } };
  return event;
}
async function webhook(event: VerifiedPayment) {
  const body = JSON.stringify(event);
  return handlePaymentWebhook("culqi", body, new Headers({ "X-Test-Signature": signature(body) }));
}
beforeAll(async () => {
  db = await createTestDatabase(); setTestDatabase(db); vi.stubEnv("DINERO_REAL_HABILITADO", "true");
  setPaymentGatewayForTests(gateway);
  setIdentityVerifierForTests({ async verificar() { return { estado: "verificado", referencia: "test" }; },
    async verificarTitularCuenta({ cuenta }) { return { coincideTitular: cuenta === "own-account", referencia: "test-proof" }; } });
}, 30000);
afterAll(async () => {
  setTestDatabase(undefined); setPaymentGatewayForTests(undefined); setIdentityVerifierForTests(undefined);
  vi.unstubAllEnvs(); await db?.close();
});
describe("verified payments and manual withdrawals", () => {
  it("creates pending with no client credit, rejects invalid signature and credits only once", async () => {
    const id = await user(); const event = await eventFor(id);
    expect((await balance(id)).disponible_centimos).toBe("10000");
    await expect(handlePaymentWebhook("culqi", JSON.stringify(event), new Headers())).rejects.toThrow("Firma");
    expect((await balance(id)).disponible_centimos).toBe("10000");
    expect(await webhook(event)).toEqual({ replay: false });
    expect(await webhook(event)).toEqual({ replay: true });
    expect((await balance(id)).disponible_centimos).toBe("11000");
    const demo = await db.query<{ disponible_centimos: string }>("SELECT disponible_centimos::text FROM billeteras WHERE usuario_id=$1 AND demo", [id]);
    expect(demo.rows[0].disponible_centimos).toBe("777");
    await expect(webhook({ ...event, montoCentimos: "1001" })).rejects.toThrow("no coincide");
    expect((await db.query("SELECT id FROM movimientos WHERE referencia_tipo='recarga' AND referencia_id=$1", [event.recargaId])).rows).toHaveLength(1);
  });
  it("reuses a recharge key only with the same owner, amount and method", async () => {
    const id = await user(); const key = `test:${randomUUID()}`;
    const first = await createRecharge(id, "1000", "culqi", "yape", key);
    const second = await createRecharge(id, "1000", "culqi", "yape", key);
    expect(second.id).toBe(first.id);
    await expect(createRecharge(id, "999", "culqi", "yape", key)).rejects.toThrow("idempotencia");
  });
  it("reserves pending deposits against the configured daily limit", async () => {
    const id = await user(); await eventFor(id, "4000");
    await expect(eventFor(id, "1001")).rejects.toThrow("Límite diario");
    expect((await balance(id)).disponible_centimos).toBe("10000");
  });
  it("requires same-holder proof and manual approval before a withdrawal can be marked paid", async () => {
    const id = await user(); const key = `withdraw:${randomUUID()}`;
    await expect(requestWithdrawal(id, "1000", "foreign-account", "test-bank", key)).rejects.toThrow("mismo titular");
    const withdrawal = await requestWithdrawal(id, "1000", "own-account", "test-bank", key);
    expect((await requestWithdrawal(id, "1000", "own-account", "test-bank", key)).replay).toBe(true);
    expect(await balance(id)).toEqual({ disponible_centimos: "9000", bloqueado_centimos: "1000" });
    await expect(reviewWithdrawal(withdrawal.id, "pagado", "test-admin", "receipt")).rejects.toThrow("Transición");
    await reviewWithdrawal(withdrawal.id, "aprobar", "test-admin", "Verificado");
    await reviewWithdrawal(withdrawal.id, "pagado", "test-admin", "receipt");
    expect((await reviewWithdrawal(withdrawal.id, "pagado", "test-admin", "receipt")).replay).toBe(true);
    expect(await balance(id)).toEqual({ disponible_centimos: "9000", bloqueado_centimos: "0" });
    expect((await db.query("SELECT id FROM auditoria_admin WHERE referencia_id=$1", [withdrawal.id])).rows).toHaveLength(2);
  });
  it("refunds a rejected withdrawal once, enforcing the daily limit", async () => {
    const id = await user();
    const withdrawal = await requestWithdrawal(id, "4000", "own-account", "test-bank", `withdraw:${randomUUID()}`);
    await expect(requestWithdrawal(id, "1001", "own-account", "test-bank", `withdraw:${randomUUID()}`)).rejects.toThrow("Límite diario");
    await reviewWithdrawal(withdrawal.id, "rechazar", "test-admin", "No aprobado");
    await reviewWithdrawal(withdrawal.id, "rechazar", "test-admin", "No aprobado");
    expect(await balance(id)).toEqual({ disponible_centimos: "10000", bloqueado_centimos: "0" });
  });
  it("reports reconciliation mismatches without silently changing balances or duplicating credit", async () => {
    const id = await user(); const event = await eventFor(id); await webhook(event);
    report = [{ idExterno: event.idExterno, montoCentimos: "999", moneda: "PEN" }];
    const date = (await db.query<{ date: string }>("SELECT (now() AT TIME ZONE 'America/Lima')::date::text AS date")).rows[0].date;
    const result = await reconcilePayments("culqi", date);
    expect(result.differences.some(row => row.id === event.recargaId && row.received === "999")).toBe(true);
    expect((await db.query<{ estado: string }>("SELECT estado FROM recargas WHERE id=$1", [event.recargaId])).rows[0].estado).toBe("revision");
    const repeated = await reconcilePayments("culqi", date);
    expect(repeated.expected).toBe(result.expected);
    expect((await webhook(event)).replay).toBe(true);
    expect((await balance(id)).disponible_centimos).toBe("11000");
  });
  it("fails closed without real-money flag or configured provider", async () => {
    const id = await user(); vi.stubEnv("DINERO_REAL_HABILITADO", "false");
    await expect(eventFor(id)).rejects.toThrow("deshabilitado");
    vi.stubEnv("DINERO_REAL_HABILITADO", "true");
    await expect(createRecharge(id, "1000", "izipay", "yape", `test:${randomUUID()}`)).rejects.toThrow("no configurada");
  });
});
