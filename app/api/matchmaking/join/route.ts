import { NextResponse } from "next/server";
import { joinQueue, leaveQueue } from "@/lib/matchmaking";
import { isOnlineModeEnabled } from "@/lib/onlineMode";
import { requirePlayer } from "@/lib/playerAuth";
import { routeError } from "@/lib/data/http";

export async function POST(request: Request) {
  if (!isOnlineModeEnabled()) return NextResponse.json({ error: "Modo online temporalmente no disponible" }, { status: 503 });
  try {
    const dni = await requirePlayer();
    const body = await request.json();
    const matchedSala = await joinQueue(dni, String(body.modo || ""), body.monto, {
      groupId: typeof body.groupId === "string" ? body.groupId : undefined,
      dadoId: typeof body.dadoId === "string" ? body.dadoId : undefined,
    });
    return NextResponse.json({ success: true, matchedSala });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE() {
  if (!isOnlineModeEnabled()) return new NextResponse(null, { status: 204 });
  try {
    await leaveQueue(await requirePlayer());
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return routeError(error);
  }
}
