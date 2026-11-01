import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/data/database";
import { validMatchId,type MatchRow } from "@/lib/data/matches";
import { verifyReplay } from "@/lib/data/fairness";
import { routeError } from "@/lib/data/http";
export async function GET(request:Request) {
  try {
    const id=new URL(request.url).searchParams.get("id") || "";
    if(!validMatchId(id)) throw new Error("Partida inválida");
    const m=(await getDatabase().query<MatchRow>("SELECT id,estado,hash_semilla,semilla_revelada,replay FROM partidas WHERE id=$1",[id])).rows[0];
    if(!m) return NextResponse.json({error:"Partida no encontrada"},{status:404});
    // Public proof contains anonymous participant IDs, never DNI or private unrevealed seeds.
    const reveal=m.estado==="finalizada" && m.semilla_revelada && m.replay;
    return NextResponse.json({id,protocol:"dado-salvaje-v1",hash:m.hash_semilla,
      seed:reveal?m.semilla_revelada:null,
      replay:reveal?{...m.replay!,players:m.replay!.players.map((p,i)=>({...p,name:`Jugador ${i+1}`}))}:null,
      verified:reveal?verifyReplay(m.hash_semilla,m.semilla_revelada!,m.replay!):null},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { return routeError(error); }
}
