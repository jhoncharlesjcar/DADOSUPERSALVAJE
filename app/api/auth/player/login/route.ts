import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/data/database";
import { Validators } from "@/lib/db";
import { clearRateLimit, checkRateLimit } from "@/lib/rateLimit";
import { createPlayerSessionToken, PLAYER_COOKIE_NAME, playerSessionCookieOptions, verifyPin } from "@/lib/playerAuth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const dni = String(body.dni || "").trim();
    const pin = String(body.pin || "");
    if (!Validators.dni(dni) || !/^\d{6}$/.test(pin)) return NextResponse.json({error:"DNI o PIN incorrectos."},{status:401});
    const clientKey = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
    const rateKey = `player-login:${clientKey}:${dni}`;
    const rate = await checkRateLimit(rateKey,6,10*60*1000);
    if (!rate.allowed) return NextResponse.json({error:"Demasiados intentos. Espera antes de volver a intentar."},{status:429,headers:{"Retry-After":String(rate.retryAfter)}});
    const player = (await getDatabase().query<{nombres:string;pin_hash:string|null;estado:string}>(
      "SELECT nombres,pin_hash,estado FROM usuarios WHERE dni=$1",[dni])).rows[0];
    if(!player || player.estado!=="activo" || !verifyPin(pin,player.pin_hash)) return NextResponse.json({error:"DNI o PIN incorrectos."},{status:401});
    await clearRateLimit(rateKey);
    const response = NextResponse.json({ok:true,player:{nombres:player.nombres}});
    response.cookies.set(PLAYER_COOKIE_NAME,createPlayerSessionToken(dni),playerSessionCookieOptions);
    return response;
  } catch {
    return NextResponse.json({error:"No se pudo iniciar sesión."},{status:503});
  }
}
