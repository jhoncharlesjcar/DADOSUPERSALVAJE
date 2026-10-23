import { getDB } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDB();
  const ranking = db
    .prepare(
      `SELECT nombres, puntos, partidas_ganadas, partidas_jugadas, 
              total_ganado, racha_actual, mejor_racha, titulo
       FROM jugadores 
       WHERE puntos > 0 
       ORDER BY puntos DESC 
       LIMIT 20`
    )
    .all() as Array<Record<string, unknown>>;

  return NextResponse.json(ranking.map((player, index) => ({ rank: index + 1, ...player })));
}
