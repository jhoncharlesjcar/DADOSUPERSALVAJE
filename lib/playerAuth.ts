import "server-only";

import { cookies } from "next/headers";
import { PLAYER_SESSION_TTL_SECONDS, verifyPlayerSessionToken } from "./playerSecurity";
export { createPlayerSessionToken, hashPin, isValidPin, verifyPin, verifyPlayerSessionToken } from "./playerSecurity";

export const PLAYER_COOKIE_NAME = "dado_player_session";
export async function getAuthenticatedPlayerDni(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyPlayerSessionToken(cookieStore.get(PLAYER_COOKIE_NAME)?.value);
}

export async function requirePlayer(): Promise<string> {
  const dni = await getAuthenticatedPlayerDni();
  if (!dni) throw new Error("No autorizado");
  return dni;
}

export const playerSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: PLAYER_SESSION_TTL_SECONDS,
  priority: "high" as const,
};
