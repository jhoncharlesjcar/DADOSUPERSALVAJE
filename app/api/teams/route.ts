import { NextResponse } from "next/server";
import { requirePlayer } from "@/lib/playerAuth";
import { createTeam, getTeams, joinTeam, leaveTeam } from "@/lib/teamMode";
import { routeError } from "@/lib/data/http";

function failure(error: unknown) {
  return routeError(error);
}
export async function GET() {
  try { return NextResponse.json({ teams: await getTeams(await requirePlayer()) }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const dni = await requirePlayer(), body = await request.json();
    const id = body.action === "join" ? await joinTeam(String(body.teamId || ""), dni) : await createTeam(String(body.nombre || ""), dni);
    return NextResponse.json({ id });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
  try {
    const dni = await requirePlayer(), body = await request.json();
    await leaveTeam(String(body.teamId || ""), dni);
    return new NextResponse(null, { status: 204 });
  } catch (error) { return failure(error); }
}
