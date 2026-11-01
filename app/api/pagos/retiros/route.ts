import { requestWithdrawal } from "@/lib/data/payments";
import { authenticatedUserId, paymentError } from "@/lib/data/paymentRoutes";

export async function POST(request: Request) {
  try {
    const userId = await authenticatedUserId();
    const body = await request.json();
    if (typeof body.montoCentimos !== "string" || typeof body.cuenta !== "string" || typeof body.banco !== "string") throw new Error("Entrada inválida");
    return Response.json(await requestWithdrawal(userId, body.montoCentimos, body.cuenta, body.banco, request.headers.get("Idempotency-Key") ?? ""), { status: 201 });
  } catch (error) { return paymentError(error); }
}
