import { getDB } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { dni, nombres, celular, codigo_yapeo } = body;

    if (!dni || !nombres) {
      return NextResponse.json(
        { error: "DNI y nombres son requeridos" },
        { status: 400 }
      );
    }

    const db = getDB();
    db.prepare(
      `INSERT OR REPLACE INTO jugadores 
      (dni, nombres, celular, codigo_yapeo) 
      VALUES (?, ?, ?, ?)`
    ).run(dni, nombres, celular || "", codigo_yapeo || "");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al registrar jugador" },
      { status: 500 }
    );
  }
}
