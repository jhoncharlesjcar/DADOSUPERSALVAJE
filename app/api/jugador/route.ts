import { getDB } from "@/lib/db";
import { NextResponse, NextRequest } from "next/server";
import { Player } from "@/types";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "Búsqueda requerida" }, { status: 400 });
  }

  const db = getDB();
  const resultados = db
    .prepare(`
      SELECT j.dni, j.nombres, j.celular, j.puntos, j.partidas_jugadas,
             j.partidas_ganadas, j.total_ganado, j.racha_actual, j.mejor_racha,
             j.titulo, COALESCE(w.saldo_real, 0) as saldo_real
      FROM jugadores j 
      LEFT JOIN wallet w ON j.dni = w.dni 
      WHERE j.dni = ? OR j.nombres LIKE ? 
      LIMIT 20
    `)
    .all(q, `%${q}%`) as Player[];

  return NextResponse.json(resultados);
}
