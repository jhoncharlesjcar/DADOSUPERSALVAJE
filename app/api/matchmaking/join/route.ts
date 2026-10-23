import { NextResponse } from "next/server";
import { joinQueue, leaveQueue } from "@/lib/matchmaking";
import { isOnlineModeEnabled } from "@/lib/onlineMode";
import { requirePlayer } from "@/lib/playerAuth";

export async function POST(request: Request) {
  if (!isOnlineModeEnabled()) return NextResponse.json({ error: "Modo online temporalmente no disponible" }, { status: 503 });
  try {
    const dni = await requirePlayer();
    const body = await request.json();
    const matchedSala = joinQueue(dni, String(body.modo || ""), Number(body.monto));
    return NextResponse.json({ success: true, matchedSala });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: message === "No autorizado" ? 401 : 400 });
  }
}

export async function DELETE(request: Request) {
  if (!isOnlineModeEnabled()) return new NextResponse(null, { status: 204 });
  try {
    leaveQueue(await requirePlayer());
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}
