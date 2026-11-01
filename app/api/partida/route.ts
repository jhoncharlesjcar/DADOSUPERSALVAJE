import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getDatabase } from "@/lib/data/database";
import { settleResolvedMatch } from "@/lib/data/matches";
import { getRanking,getEstadisticasGlobales,getPartidas } from "@/lib/db";
import { readManualMatch } from "@/lib/manualArena";
import { routeError } from "@/lib/data/http";
export async function POST(request:Request) {
  try {
    await requireAdmin();
    const externalId=String((await request.json()).idempotencyKey || "");
    const settlement=await getDatabase().transaction(async client=>{
      const row=(await client.query<{id:string}>("SELECT id FROM partidas WHERE external_id=$1 FOR UPDATE",[externalId])).rows[0];
      if(!row) throw new Error("La partida no tiene una tirada confirmada");
      return settleResolvedMatch(client,row.id);
    });
    const [ranking,stats,historial,match]=await Promise.all([getRanking(true),getEstadisticasGlobales(),getPartidas(),readManualMatch(externalId)]);
    return NextResponse.json({ok:true,...settlement,ranking,stats,historial,match});
  } catch(error) { return routeError(error); }
}
export async function GET() {
  try { await requireAdmin(); return NextResponse.json(await getPartidas()); }
  catch(error) { return routeError(error); }
}
