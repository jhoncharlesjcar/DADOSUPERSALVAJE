import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/data/database";
import { cents, displaySoles } from "@/lib/data/money";
import { adjustDemoBalance } from "@/lib/data/ledger";
import { Validators } from "@/lib/db";
import { walletIsDemo } from "@/lib/wallet";
import { createPlayerSessionToken,hashPin,isValidPin,PLAYER_COOKIE_NAME,playerSessionCookieOptions } from "@/lib/playerAuth";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    const clientKey=request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
    const rate=await checkRateLimit(`player-register:${clientKey}`,5,15*60*1000);
    if(!rate.allowed) return NextResponse.json({error:"Demasiados intentos. Espera antes de volver a intentar."},{status:429,headers:{"Retry-After":String(rate.retryAfter)}});
    const body=await request.json();
    const dni=String(body.dni || "").trim(),nombres=String(body.nombres || "").trim().replace(/\s+/g," "),pin=String(body.pin || "");
    if(!Validators.dni(dni) || nombres.length<2 || nombres.length>80 || !isValidPin(pin)) return NextResponse.json({error:"Completa un DNI válido, tu nombre y un PIN de 6 dígitos."},{status:400});
    const welcome=walletIsDemo() ? cents(process.env.DEMO_WELCOME_CENTIMOS ?? "0") : 0n;
    if(welcome<0n) throw new Error("Configuración demo inválida");
    const pinHash=hashPin(pin);
    await getDatabase().transaction(async client=>{
      const result=await client.query<{id:string}>("INSERT INTO usuarios(dni,nombres,pin_hash) VALUES($1,$2,$3) ON CONFLICT(dni) DO NOTHING RETURNING id",[dni,nombres,pinHash]);
      if(!result.rows[0]) throw new Error("PLAYER_EXISTS");
      const userId=result.rows[0].id;
      await client.query("INSERT INTO billeteras(usuario_id,demo) VALUES($1,true),($1,false)",[userId]);
      await client.query("INSERT INTO limites_usuario(usuario_id) VALUES($1)",[userId]);
      if(welcome>0n) await adjustDemoBalance(client,userId,welcome,`welcome:${userId}`,"Bienvenida demo","registro-demo");
    });
    const response=NextResponse.json({ok:true,player:{nombres},wallet:{creditos:displaySoles(welcome),disponible_centimos:String(welcome),demo:walletIsDemo()}},{status:201});
    response.cookies.set(PLAYER_COOKIE_NAME,createPlayerSessionToken(dni),playerSessionCookieOptions);
    return response;
  } catch(error) {
    if(error instanceof Error && error.message==="PLAYER_EXISTS") return NextResponse.json({error:"Este jugador ya existe. Inicia sesión con tu PIN."},{status:409});
    return NextResponse.json({error:"No se pudo crear el jugador."},{status:503});
  }
}
