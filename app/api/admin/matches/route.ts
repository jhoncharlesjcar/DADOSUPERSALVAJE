import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getDatabase } from "@/lib/data/database";
import { audit,cancelMatch,disputeMatch } from "@/lib/data/ledger";
import { cancelStaleMatches,settleResolvedMatch,validMatchId } from "@/lib/data/matches";
import { releaseRoomQueue,expireConfirmations,expireDisconnects } from "@/lib/matchmaking";
import { routeError } from "@/lib/data/http";
export async function POST(request:Request) {
  try {
    await requireAdmin();
    const {id,action,reason,before}=await request.json();
    if(action==="expire") return NextResponse.json({confirmations:await expireConfirmations(),disconnects:await expireDisconnects()});
    if(action==="recover_crash") {
      if(typeof before!=="string" || !before.endsWith("Z") || !Number.isFinite(Date.parse(before)) || Date.parse(before)>Date.now()) throw new Error("Fecha de corte UTC inválida");
      return NextResponse.json({cancelled:await cancelStaleMatches(new Date(before),"admin")});
    }
    if(typeof id!=="string" || !validMatchId(id) || typeof reason!=="string" || !reason.trim() || reason.length>1000) throw new Error("Partida y motivo requeridos");
    const result=await getDatabase().transaction(async client=>{
      if(action==="dispute") return disputeMatch(client,id,"admin",reason);
      if(!["cancel","resolve_cancel","resolve_settle"].includes(action)) throw new Error("Acción inválida");
      const row=(await client.query<{estado:string}>("SELECT estado FROM partidas WHERE id=$1 FOR UPDATE",[id])).rows[0];
      if(!row) throw new Error("Partida no encontrada");
      if(action.startsWith("resolve_")) {
        if(row.estado!=="en_disputa") throw new Error("La partida no está en disputa");
        await audit(client,"admin",action,"partida",id,{reason});
        await client.query("UPDATE partidas SET estado='en_curso' WHERE id=$1",[id]);
      } else await audit(client,"admin","anulacion_manual","partida",id,{reason});
      const outcome=action==="resolve_settle" ? await settleResolvedMatch(client,id) : await cancelMatch(client,id);
      await releaseRoomQueue(client,id);
      return outcome;
    });
    return NextResponse.json({ok:true,...result});
  } catch(error) { return routeError(error); }
}
