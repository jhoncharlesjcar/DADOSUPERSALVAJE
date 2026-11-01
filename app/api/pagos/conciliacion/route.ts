import { requireAdmin } from "@/lib/adminAuth";
import { reconcilePayments } from "@/lib/data/payments";
import { paymentError } from "@/lib/data/paymentRoutes";
import { timingSafeEqual } from "node:crypto";

/** Invoke daily from the deployment scheduler; credentials and scheduler provisioning are external. */
export async function POST(request: Request) {
  try {
    const expected = process.env.CONCILIACION_CRON_SECRET;
    const supplied = request.headers.get("authorization") ?? "";
    const token = expected ? `Bearer ${expected}` : "";
    const cron = token.length >= 39 && Buffer.byteLength(token) === Buffer.byteLength(supplied) && timingSafeEqual(Buffer.from(token), Buffer.from(supplied));
    if (!cron) await requireAdmin();
    const body = await request.json();
    if (typeof body.pasarela !== "string" || typeof body.fecha !== "string") throw new Error("Entrada inválida");
    return Response.json(await reconcilePayments(body.pasarela, body.fecha));
  } catch (error) { return paymentError(error); }
}
