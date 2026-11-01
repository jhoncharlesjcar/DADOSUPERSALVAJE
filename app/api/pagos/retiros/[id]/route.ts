import { requireAdmin } from "@/lib/adminAuth";
import { reviewWithdrawal } from "@/lib/data/payments";
import { paymentError } from "@/lib/data/paymentRoutes";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();
    if (!["aprobar","rechazar","pagado"].includes(body.accion) || typeof body.motivo !== "string") throw new Error("Entrada inválida");
    return Response.json(await reviewWithdrawal(id, body.accion, "admin-session", body.motivo));
  } catch (error) { return paymentError(error); }
}
