import { NextResponse } from "next/server";
import { getDB, Validators } from "@/lib/db";
import { clearRateLimit, checkRateLimit } from "@/lib/rateLimit";
import { createPlayerSessionToken, PLAYER_COOKIE_NAME, playerSessionCookieOptions, verifyPin } from "@/lib/playerAuth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const dni = String(body.dni || "").trim();
    const pin = String(body.pin || "");
    if (!Validators.dni(dni) || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: "DNI o PIN incorrectos." }, { status: 401 });
    }

    const clientKey = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
    const rateKey = `player-login:${clientKey}:${dni}`;
    const rate = checkRateLimit(rateKey, 6, 10 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Demasiados intentos. Espera antes de volver a intentar." }, {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfter) },
      });
    }

    const player = getDB().prepare("SELECT nombres, pin_hash, activo FROM jugadores WHERE dni = ?").get(dni) as {
      nombres: string;
      pin_hash: string | null;
      activo: number;
    } | undefined;
    if (!player || player.activo !== 1 || !verifyPin(pin, player.pin_hash)) {
      return NextResponse.json({ error: "DNI o PIN incorrectos." }, { status: 401 });
    }

    clearRateLimit(rateKey);
    const response = NextResponse.json({ ok: true, player: { nombres: player.nombres } });
    response.cookies.set(PLAYER_COOKIE_NAME, createPlayerSessionToken(dni), playerSessionCookieOptions);
    return response;
  } catch (error) {
    console.error("Player login failed", error);
    return NextResponse.json({ error: "No se pudo iniciar sesión." }, { status: 500 });
  }
}
