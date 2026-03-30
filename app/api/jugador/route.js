import { getDB } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const dni = searchParams.get("dni");

  if (!dni) {
    return NextResponse.json({ error: "DNI requerido" }, { status: 400 });
  }

  const db = getDB();
  const jugador = db
    .prepare("SELECT * FROM jugadores WHERE dni = ?")
    .get(dni);

  return NextResponse.json(jugador || null);
}
