import { getEstadisticasGlobales } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await getEstadisticasGlobales();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error getting stats:", error);
    return NextResponse.json(
      { error: "Error al obtener estadísticas" },
      { status: 500 }
    );
  }
}
