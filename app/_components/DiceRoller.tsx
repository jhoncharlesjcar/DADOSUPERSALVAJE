"use client";

import { useEffect, useRef, useState } from "react";
import type { DicePhase, Player } from "@/types";
import { validateMatch, type ArenaMatch } from "@/lib/arena/types";
import ArenaReplay from "./ArenaReplay";

interface Props {
  jugadores: Player[]; matchId: string;
  onFinish: (match: ArenaMatch, meta: { duracion_ms: number }) => Promise<void>;
  onPhaseChange?: (phase: DicePhase) => void;
}

export default function DiceRoller({jugadores,matchId,onFinish,onPhaseChange}:Props) {
  const [match,setMatch]=useState<ArenaMatch|null>(null),[error,setError]=useState("");
  const [attempt,setAttempt]=useState(0),[saving,setSaving]=useState(false),[completed,setCompleted]=useState(false);
  const cosmetics=useRef(Object.fromEntries(jugadores.map(player=>[player.dni,player.dadoId||"rojo"])));
  const start=useRef(0),savingRef=useRef(false);
  useEffect(()=>{
    const controller=new AbortController();
    async function prepare(){
      setError("");start.current=performance.now();
      try{
        const response=await fetch("/api/game/roll",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({matchId,cosmetics:cosmetics.current}),signal:controller.signal});
        const payload=await response.json();
        if(!response.ok)throw new Error(payload.error||"No se pudo preparar la partida");
        if(!validateMatch(payload))throw new Error("El resultado recibido no es válido");
        if(!controller.signal.aborted)setMatch(payload);
      }catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:"Error de conexión");}
    }
    void prepare();return()=>controller.abort();
  },[matchId,attempt]);
  async function finish(){
    if(!match||savingRef.current)return;
    savingRef.current=true;setSaving(true);setCompleted(true);setError("");
    try{await onFinish(match,{duracion_ms:Math.round(performance.now()-start.current)});}
    catch(error){setError(error instanceof Error?error.message:"No se pudo confirmar el premio");}
    finally{savingRef.current=false;setSaving(false);}
  }
  return <div>
    {match?<ArenaReplay match={match} onComplete={()=>void finish()} onPhaseChange={onPhaseChange}/>:<p role="status">Preparando la partida confirmada…</p>}
    {saving&&<p role="status">Confirmando premio y saldo…</p>}
    {error&&<div role="alert" style={{padding:20,color:"#f0c9a7"}}><p>{error}. La partida conserva el mismo identificador.</p><button className="btn btn-secondary" disabled={saving} onClick={()=>completed?void finish():setAttempt(i=>i+1)}>Reintentar {completed?"confirmación":"carga"}</button></div>}
  </div>;
}
