import { createRecharge } from "@/lib/data/payments";
import { authenticatedUserId, paymentError } from "@/lib/data/paymentRoutes";

export async function POST(request: Request) {
  try {
    const userId = await authenticatedUserId();
    const body = await request.json();
    if (typeof body.montoCentimos !== "string" || typeof body.pasarela !== "string" || typeof body.metodo !== "string") throw new Error("Entrada inválida");
    const result = await createRecharge(userId, body.montoCentimos, body.pasarela, body.metodo, request.headers.get("Idempotency-Key") ?? "");
    return Response.json(result, { status: 201 });
  } catch (error) { return paymentError(error); }
}
