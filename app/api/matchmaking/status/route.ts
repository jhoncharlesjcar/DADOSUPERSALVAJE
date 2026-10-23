import { NextResponse } from 'next/server';
import { getMatchStatus } from '@/lib/matchmaking';
import { isOnlineModeEnabled } from '@/lib/onlineMode';
import { requirePlayer } from '@/lib/playerAuth';

export async function GET() {
  if (!isOnlineModeEnabled()) return NextResponse.json({ error: "Modo online temporalmente no disponible" }, { status: 503 });
  try {
    const dni = await requirePlayer();
    const status = getMatchStatus(dni);
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message === "No autorizado" ? message : "Error interno" }, { status: message === "No autorizado" ? 401 : 500 });
  }
}
