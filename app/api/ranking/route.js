import { getDB } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDB();
  const ranking = db
    .prepare(
      `SELECT dni, nombres, puntos, partidas_ganadas, partidas_jugadas, total_ganado 
       FROM jugadores 
       WHERE puntos > 0 
       ORDER BY puntos DESC 
       LIMIT 20`
    )
    .all();

  return NextResponse.json(ranking);
}
