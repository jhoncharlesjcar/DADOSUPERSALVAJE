import { handlePaymentWebhook } from "@/lib/data/payments";
import { paymentError } from "@/lib/data/paymentRoutes";

export async function POST(request: Request, context: { params: Promise<{ pasarela: string }> }) {
  try {
    const { pasarela } = await context.params;
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 262144) return Response.json({ error: "Evento demasiado grande" }, { status: 413 });
    return Response.json(await handlePaymentWebhook(pasarela, raw, request.headers));
  } catch (error) { return paymentError(error); }
}
