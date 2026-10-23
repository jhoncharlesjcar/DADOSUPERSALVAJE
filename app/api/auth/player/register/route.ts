import { NextResponse } from "next/server";
import { getDB, Validators } from "@/lib/db";
import { createPlayerSessionToken, hashPin, isValidPin, PLAYER_COOKIE_NAME, playerSessionCookieOptions } from "@/lib/playerAuth";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const clientKey = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const rate = checkRateLimit(`player-register:${clientKey}`, 5, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Demasiados intentos. Espera antes de volver a intentar." }, {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfter) },
    });
  }

  try {
    const body = await request.json();
    const dni = String(body.dni || "").trim();
    const nombres = String(body.nombres || "").trim().replace(/\s+/g, " ");
    const pin = String(body.pin || "");
    if (!Validators.dni(dni) || nombres.length < 2 || nombres.length > 80 || !isValidPin(pin)) {
      return NextResponse.json({ error: "Completa un DNI válido, tu nombre y un PIN de 6 dígitos." }, { status: 400 });
    }

    const db = getDB();
    const welcomeCredits = Math.max(0, Math.min(1000, Math.floor(Number(process.env.WELCOME_CREDITS) || 100)));
    const pinHash = hashPin(pin);
    db.transaction(() => {
      if (db.prepare("SELECT 1 FROM jugadores WHERE dni = ?").get(dni)) {
        throw new Error("PLAYER_EXISTS");
      }
      db.prepare("INSERT INTO jugadores (dni, nombres, pin_hash, monto_yapeo) VALUES (?, ?, ?, ?)")
        .run(dni, nombres, pinHash, welcomeCredits);
      db.prepare("INSERT INTO wallet (dni, saldo_real) VALUES (?, ?)").run(dni, welcomeCredits);
      db.prepare(`
        INSERT INTO transacciones (dni, operacion, tipo, monto, referencia)
        VALUES (?, 'Créditos de bienvenida', 'ingreso', ?, ?)
      `).run(dni, welcomeCredits, `welcome:${dni}`);
    })();

    const response = NextResponse.json({ ok: true, player: { nombres }, wallet: { creditos: welcomeCredits } }, { status: 201 });
    response.cookies.set(PLAYER_COOKIE_NAME, createPlayerSessionToken(dni), playerSessionCookieOptions);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "PLAYER_EXISTS") {
      return NextResponse.json({ error: "Este jugador ya existe. Inicia sesión con tu PIN." }, { status: 409 });
    }
    console.error("Player registration failed", error);
    return NextResponse.json({ error: "No se pudo crear el jugador." }, { status: 500 });
  }
}
