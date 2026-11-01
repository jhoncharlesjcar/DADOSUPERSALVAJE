import { NextResponse } from "next/server";
import { getPartidas } from "@/lib/db";
import { requirePlayer } from "@/lib/playerAuth";
export async function GET() {
  let dni: string;
  try { dni=await requirePlayer(); } catch { return NextResponse.json({error:"No autorizado"},{status:401}); }
  try {
    const matches=(await getPartidas(8,dni)).map(match=>({id:match.id,mode:match.modo,stake:match.monto,pool:match.pozo,
      winnerName:match.ganador_nombre,prize:match.premio,won:match.won,playedAt:match.fecha,
      stakeCents:match.monto_centimos,poolCents:match.pozo_centimos,prizeCents:match.premio_centimos,demo:match.demo}));
    return NextResponse.json({matches},{headers:{"Cache-Control":"no-store"}});
  } catch { return NextResponse.json({error:"No se pudo consultar el historial"},{status:503}); }
}
