import { NextResponse } from "next/server";
import { PLAYER_COOKIE_NAME } from "@/lib/playerAuth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PLAYER_COOKIE_NAME, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "strict" });
  return response;
}
