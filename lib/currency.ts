const PEN_FORMATTER = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatSoles(value: number | string): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? PEN_FORMATTER.format(amount).replace("PEN", "S/") : "S/ 0.00";
}
