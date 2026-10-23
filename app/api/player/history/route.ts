import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { requirePlayer } from "@/lib/playerAuth";

type MatchRow = {
  id: number;
  modo: string;
  monto: number;
  pozo: number;
  ganador_dni: string;
  ganador_nombre: string;
  premio: number;
  jugadores_json: string;
  fecha: string;
};

export async function GET() {
  try {
    const dni = await requirePlayer();
    const recent = getDB().prepare(`
      SELECT id, modo, monto, pozo, ganador_dni, ganador_nombre, premio, jugadores_json, fecha
      FROM partidas
      WHERE modo LIKE 'online-%'
      ORDER BY id DESC
      LIMIT 100
    `).all() as MatchRow[];

    const matches = recent.filter(match => {
      try {
        const players = JSON.parse(match.jugadores_json) as Array<string | { dni?: string }>;
        return Array.isArray(players) && players.some(player => typeof player === "string" ? player === dni : player?.dni === dni);
      } catch {
        return false;
      }
    }).slice(0, 8).map(match => ({
      id: match.id,
      mode: match.modo.replace("online-", ""),
      stake: match.monto,
      pool: match.pozo,
      winnerName: match.ganador_nombre,
      prize: match.premio,
      won: match.ganador_dni === dni,
      playedAt: match.fecha,
    }));

    return NextResponse.json({ matches }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}
