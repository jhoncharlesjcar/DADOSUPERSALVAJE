import { NextResponse } from "next/server";
import { requirePlayer } from "@/lib/playerAuth";
import { isOnlineModeEnabled } from "@/lib/onlineMode";
import { getDatabase } from "@/lib/data/database";
import { generateMatch,members,settleResolvedMatch,validMatchId,type MatchRow } from "@/lib/data/matches";
import { blockEntries } from "@/lib/data/ledger";
import { confirmRoomInTransaction,releaseRoomQueue,setDisconnected,reconnectRoom,markRoomViewed } from "@/lib/matchmaking";
import { displaySoles } from "@/lib/data/money";
import { routeError } from "@/lib/data/http";

async function authorized(id:string,dni:string) {
  if(!validMatchId(id)) throw new Error("Sala inválida");
  const roster=await members(getDatabase(),id);
  if(!roster.some(p=>p.dni===dni)) throw new Error("Sala no encontrada");
  return roster;
}
export async function GET(request:Request) {
  if(!isOnlineModeEnabled()) return NextResponse.json({error:"Modo online temporalmente no disponible"},{status:503});
  try {
    const dni=await requirePlayer(),id=new URL(request.url).searchParams.get("id") || "";
    const roster=await authorized(id,dni);
    const match=(await getDatabase().query<MatchRow>("SELECT * FROM partidas WHERE id=$1",[id])).rows[0];
    const completed=match.estado==="finalizada", replay=completed?match.replay:null;
    const values=new Map<string,number>();
    for(const round of replay?.rounds ?? []) for(const roll of round.rolls) values.set(roll.playerId,roll.value);
    const team=replay && "winnerTeam" in replay ? replay.winnerTeam:null;
    const winner=replay && "winnerId" in replay ? roster.find(p=>p.id===replay.winnerId):null;
    const teamWon=team!==null && roster.find(p=>p.dni===dni)?.equipo===team;
    return NextResponse.json({
      replay:replay && "winnerId" in replay?replay:null,
      teamReplay:team?replay:null,
      hash_semilla:match.hash_semilla,semilla_revelada:completed?match.semilla_revelada:null,
      room:{id,mode:match.modo,stake:displaySoles(match.monto_entrada_centimos),status:completed?"completed":match.estado,
        players:roster.map((p,i)=>({seat:i+1,name:p.nombres,isMe:p.dni===dni,confirmed:p.confirmado,team:p.equipo}))},
      result:completed && replay?{
        winner:{seat:winner?roster.indexOf(winner)+1:0,name:winner?.nombres ?? `Equipo ${team}`,value:winner?values.get(winner.id):0,isMe:winner?winner.dni===dni:teamWon},
        winnerTeam:team,
        rolls:roster.map((p,i)=>({seat:i+1,name:p.nombres,value:values.get(p.id),isMe:p.dni===dni,team:p.equipo})),
        prize:displaySoles(teamWon?roster.find(p=>p.dni===dni)!.premio_centimos:match.premio_centimos),
        pool:displaySoles(match.pozo_centimos),prize_centimos:String(match.premio_centimos),pool_centimos:String(match.pozo_centimos),tiebreakRounds:replay.rounds.length-1
      }:null
    },{headers:{"Cache-Control":"no-store"}});
  } catch(error) { return routeError(error); }
}
export async function POST(request:Request) {
  if(!isOnlineModeEnabled()) return NextResponse.json({error:"Modo online temporalmente no disponible"},{status:503});
  try {
    const dni=await requirePlayer(),body=await request.json(),id=String(body.id || "");
    await authorized(id,dni);
    if(body.action==="disconnect") { await setDisconnected(id,dni); return NextResponse.json({ok:true}); }
    if(body.action==="reconnect") { await reconnectRoom(id,dni); return NextResponse.json({ok:true}); }
    if(body.action==="confirm") {
      const result=await getDatabase().transaction(async client=>{
        const confirmation=await confirmRoomInTransaction(client,id,dni);
        if(!confirmation.allConfirmed) return {completed:false};
        await blockEntries(client,id);
        await generateMatch(client,id);
        await settleResolvedMatch(client,id);
        await releaseRoomQueue(client,id);
        return {completed:true};
      });
      return NextResponse.json({ok:true,...result});
    }
    if(body.action && body.action!=="view") throw new Error("Acción inválida");
    await markRoomViewed(id,dni);
    return NextResponse.json({ok:true});
  } catch(error) { return routeError(error); }
}
