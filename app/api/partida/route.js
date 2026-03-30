import { getDB } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      modo,
      monto,
      pozo,
      ganador_dni,
      ganador_nombre,
      premio,
      jugadores,
      resultados,
    } = body;

    const db = getDB();

    // Save the game
    const result = db
      .prepare(
        `INSERT INTO partidas 
        (modo, monto, pozo, ganador_dni, ganador_nombre, premio, jugadores_json, resultados_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        modo || "normal",
        monto || 10,
        pozo || 0,
        ganador_dni || "",
        ganador_nombre || "",
        premio || 0,
        JSON.stringify(jugadores || []),
        JSON.stringify(resultados || [])
      );

    // Update all players stats (partidas_jugadas)
    if (jugadores && Array.isArray(jugadores)) {
      const updatePlayed = db.prepare(
        "UPDATE jugadores SET partidas_jugadas = partidas_jugadas + 1 WHERE dni = ?"
      );
      for (const j of jugadores) {
        updatePlayed.run(j.dni);
      }
    }

    // Update winner stats (puntos, partidas_ganadas, total_ganado)
    if (ganador_dni) {
      // Points = monto * 10 (more monto = more points)
      const puntosGanados = (monto || 10) * 10;
      db.prepare(
        `UPDATE jugadores SET 
          puntos = puntos + ?, 
          partidas_ganadas = partidas_ganadas + 1,
          total_ganado = total_ganado + ?
        WHERE dni = ?`
      ).run(puntosGanados, premio || 0, ganador_dni);
    }

    return NextResponse.json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch (error) {
    console.error("Error saving partida:", error);
    return NextResponse.json(
      { error: "Error al guardar partida" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const db = getDB();
  const partidas = db
    .prepare("SELECT * FROM partidas ORDER BY fecha DESC LIMIT 20")
    .all();

  return NextResponse.json(partidas);
}
