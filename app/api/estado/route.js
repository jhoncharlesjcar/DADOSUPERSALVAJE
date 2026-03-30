import { getLiveState, updateLiveState } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = getLiveState();
  return NextResponse.json(state);
}

export async function POST(request) {
  try {
    const body = await request.json();
    updateLiveState(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al actualizar estado" },
      { status: 500 }
    );
  }
}
