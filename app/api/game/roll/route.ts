import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { prepareManualMatch } from "@/lib/manualArena";
import { routeError } from "@/lib/data/http";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();
    const match = await prepareManualMatch(String(body.matchId || ""), body.cosmetics || {});
    return NextResponse.json(match, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}
