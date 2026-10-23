import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { requirePlayer } from "@/lib/playerAuth";

export async function GET() {
  try {
    const dni = await requirePlayer();
    const data = getDB().prepare(`
      SELECT j.nombres, j.puntos, j.partidas_jugadas, j.partidas_ganadas, j.racha_actual,
             j.mejor_racha, COALESCE(w.saldo_real, 0) AS creditos,
             COALESCE(w.saldo_bono, 0) AS creditos_bono,
             COALESCE(w.moneda_ingame, 0) AS gemas
      FROM jugadores j JOIN wallet w ON w.dni = j.dni
      WHERE j.dni = ? AND j.activo = 1
    `).get(dni);
    if (!data) return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
    return NextResponse.json({ player: data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}
