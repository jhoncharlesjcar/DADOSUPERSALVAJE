import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { prepareManualMatch } from "@/lib/manualArena";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const match = prepareManualMatch(String(body.matchId || ""), body.cosmetics || {});
    return NextResponse.json(match, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos preparar la tirada";
    return NextResponse.json({ error: message }, { status: message === "No autorizado" ? 401 : 400 });
  }
}
