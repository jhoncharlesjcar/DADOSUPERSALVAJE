import { NextResponse } from "next/server";
import { getJugador } from "@/lib/db";
import { getDatabase } from "@/lib/data/database";
import { getWallet } from "@/lib/wallet";
import { requirePlayer } from "@/lib/playerAuth";
export async function GET() {
  let dni: string;
  try { dni=await requirePlayer(); } catch { return NextResponse.json({error:"No autorizado"},{status:401}); }
  try {
    const state=(await getDatabase().query<{estado:string}>("SELECT estado FROM usuarios WHERE dni=$1",[dni])).rows[0];
    if(!state || state.estado!=="activo") return NextResponse.json({error:"Jugador no disponible"},{status:403});
    const [p,w]=await Promise.all([getJugador(dni),getWallet(dni)]);
    if(!p || !w) return NextResponse.json({error:"Jugador no encontrado"},{status:404});
    return NextResponse.json({player:{nombres:p.nombres,puntos:p.puntos,partidas_jugadas:p.partidas_jugadas,
      partidas_ganadas:p.partidas_ganadas,racha_actual:p.racha_actual,mejor_racha:p.mejor_racha,
      creditos:w.saldo_real,creditos_bono:w.saldo_bono,gemas:w.moneda_ingame,
      disponible_centimos:w.disponible_centimos,bloqueado_centimos:w.bloqueado_centimos,demo:w.demo}}, {headers:{"Cache-Control":"no-store"}});
  } catch { return NextResponse.json({error:"No se pudo consultar el perfil"},{status:503}); }
}
