import { NextResponse } from "next/server";
import { getWallet } from "@/lib/wallet";
import { requirePlayer } from "@/lib/playerAuth";
import { isOnlineModeEnabled } from "@/lib/onlineMode";
export async function GET() {
  if(!isOnlineModeEnabled()) return NextResponse.json({error:"Modo online temporalmente no disponible"},{status:503});
  let dni: string;
  try { dni=await requirePlayer(); } catch { return NextResponse.json({error:"No autorizado"},{status:401}); }
  try {
    const wallet=await getWallet(dni);
    if(!wallet) return NextResponse.json({error:"Billetera no encontrada"},{status:404});
    return NextResponse.json({creditos:wallet.saldo_real,creditos_bono:wallet.saldo_bono,gemas:wallet.moneda_ingame,
      disponible_centimos:wallet.disponible_centimos,bloqueado_centimos:wallet.bloqueado_centimos,bono_centimos:wallet.bono_centimos,demo:wallet.demo},
      {headers:{"Cache-Control":"no-store"}});
  } catch { return NextResponse.json({error:"No se pudo consultar la billetera"},{status:503}); }
}
