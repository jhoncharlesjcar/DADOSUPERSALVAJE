export const ALLOWED_STAKES = [200n, 500n, 1000n, 2000n, 3000n, 4000n, 5000n, 10000n] as const;
export function cents(value: unknown): bigint {
  if (typeof value !== "bigint" && (typeof value !== "string" || !/^-?\d+$/.test(value))) throw new Error("Céntimos enteros requeridos");
  const result = BigInt(value);
  if (result < -9223372036854775808n || result > 9223372036854775807n) throw new Error("Monto fuera de rango");
  return result;
}
/** Compatibility input only: parse decimal text, never multiply a floating point amount. */
export function solesToCents(value: unknown): bigint {
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error("Monto en soles inválido");
  const [whole, fraction = ""] = text.split(".");
  return cents(`${whole}${fraction.padEnd(2, "0")}`);
}
export function splitPot(pot: bigint, winners = 1) {
  if (pot <= 0n || !Number.isSafeInteger(winners) || winners < 1 || winners > 10) throw new Error("Pozo inválido");
  const ranking = pot * 4n / 100n;
  const baseHouse = pot * 16n / 100n;
  const winnerPool = pot - baseHouse - ranking;
  const each = winnerPool / BigInt(winners);
  return { ranking, house: baseHouse + winnerPool % BigInt(winners), prize: each * BigInt(winners), each };
}
/** Presentation boundary for the existing UI; not for accounting or persistence. */
export function displaySoles(value: bigint | string) {
  const amount = BigInt(value);
  if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount < -BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Saldo excede la interfaz heredada");
  return Number(amount) / 100;
}
