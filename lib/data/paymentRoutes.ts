import "server-only";
import { getDatabase } from "./database";
import { requirePlayer } from "../playerAuth";

export async function authenticatedUserId() {
  const dni = await requirePlayer();
  const row = (await getDatabase().query<{ id: string }>("SELECT id FROM usuarios WHERE dni=$1", [dni])).rows[0];
  if (!row) throw new Error("No autorizado");
  return row.id;
}
export function paymentError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "No autorizado") return Response.json({ error: message }, { status: 401 });
  if (message.startsWith("TODO(DECISIÓN)") || message === "Dinero real deshabilitado") {
    return Response.json({ error: message }, { status: 503 });
  }
  // Do not disclose database exceptions, provider payloads, account numbers or signature diagnostics.
  return Response.json({ error: "No se pudo procesar la operación de pago" }, { status: 400 });
}
