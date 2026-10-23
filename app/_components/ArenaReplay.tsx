"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ArenaMatch } from "@/lib/arena/types";
import type { Quality } from "@/lib/arena/scene";
import type { DicePhase } from "@/types";
import styles from "./arena.module.css";

const Scene = dynamic(() => import("./ThreeJsDiceEmbed"), { ssr: false, loading: () => <div className={styles.loading}>Preparando la mesa…</div> });
const phases: Record<DicePhase,string> = {idle:"Preparando la mesa",cup_entry:"El cubilete entra a la arena",cup_shake:"Agitando los dados",launching:"Lanzamiento",settling:"Los dados están rodando",winner_reveal:"Dados en reposo"};
const colors: Record<string,string> = {rojo:"#c94c46",rosado:"#d16c97",amarillo:"#d8bc64",celeste:"#50a8bf",blanco:"#eee8d5",negro:"#71808a",verde:"#49a57a",guinda:"#a35e77",naranja:"#da9456",azul:"#6689df"};

export default function ArenaReplay({match,onComplete,onPhaseChange}: {match:ArenaMatch;onComplete?:()=>void;onPhaseChange?:(phase:DicePhase)=>void}) {
  const [roundIndex,setRoundIndex]=useState(0),[quality,setQuality]=useState<Quality>("medium");
  const [phase,setPhase]=useState<DicePhase>("idle"),[paused,setPaused]=useState(false),[skip,setSkip]=useState(false);
  const [settled,setSettled]=useState(false),[failed,setFailed]=useState(false),[sound,setSound]=useState(false),[run,setRun]=useState(0);
  const audio=useRef<AudioContext|null>(null), notified=useRef(false);
  const callbacks=useRef({onComplete,onPhaseChange});
  useEffect(()=>{callbacks.current={onComplete,onPhaseChange};});
  useEffect(()=>()=>{void audio.current?.close();},[]);
  const round=match.rounds[roundIndex],last=roundIndex===match.rounds.length-1;
  const players=useMemo(()=>round.rolls.map(roll=>match.players.find(player=>player.id===roll.playerId)!),[match.players,round]);
  useEffect(()=>{
    if(!settled||paused)return;
    if(last) {if(!notified.current){notified.current=true;callbacks.current.onComplete?.();} return;}
    const timer=setTimeout(()=>{setRoundIndex(i=>i+1);setSettled(false);setSkip(false);setPhase("idle");},2200);
    return()=>clearTimeout(timer);
  },[settled,last,paused]);
  function impact(strength:number) {
    if(!sound||!audio.current||audio.current.state!=="running")return;
    const ctx=audio.current,osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type="triangle";osc.frequency.setValueAtTime(180+strength*12,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(65,ctx.currentTime+0.07);
    gain.gain.setValueAtTime(Math.min(strength/12,1)*0.14,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.09);
    osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+0.1);
    osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  function toggleSound() {
    if(!sound){try{audio.current??=new AudioContext();void audio.current.resume();}catch{return;}}
    setSound(!sound);
  }
  const winner=match.players.find(player=>player.id===match.winnerId)!;
  return <section className={styles.arena} aria-label="Reproducción de la partida">
    <header className={styles.header}><div><span className={styles.eyebrow}>DADO SALVAJE · LA ARENA</span><h2>{roundIndex===0?"La suerte está echada":`Desempate ${roundIndex}`}</h2></div><span className={styles.round}>RONDA {roundIndex+1} / {match.rounds.length}</span></header>
    <div className={styles.viewport}>
      {!failed ? <Scene key={`${run}-${roundIndex}`} round={round} players={players} seed={`${match.id}:${roundIndex}`} quality={quality} paused={paused} skip={skip} onComplete={()=>setSettled(true)} onError={()=>setFailed(true)} onPhase={value=>{setPhase(value);callbacks.current.onPhaseChange?.(value);}} onImpact={impact}/> : <div className={styles.fallback}><h3>La vista 3D no está disponible</h3><p>La partida sigue guardada. Puedes consultar su resultado.</p><button onClick={()=>{setSettled(true);setPaused(false);}}>Mostrar esta ronda</button><button onClick={()=>{setFailed(false);setRun(i=>i+1);}}>Reintentar vista 3D</button></div>}
      <div className={styles.status} role="status">{settled ? last ? `${winner.name} gana la partida` : `Empate · ${round.leaders.length} jugadores pasan al desempate` : paused?"Reproducción en pausa":phases[phase]}</div>
    </div>
    <div className={styles.players} data-count={players.length} data-many={players.length>4}>{players.map(player=><div key={player.id} className={styles.player}><i style={{background:colors[player.dadoId]||colors.rojo}}/><span>{player.name}</span><strong>{settled?round.rolls.find(roll=>roll.playerId===player.id)?.value:"—"}</strong></div>)}</div>
    <footer className={styles.controls}>
      <div><button disabled={settled&&last} onClick={()=>setPaused(!paused)}>{paused?"Continuar":"Pausar"}</button><button aria-pressed={sound} onClick={toggleSound}>{sound?"Sonido activado":"Activar sonido"}</button></div>
      <label>Calidad <select aria-label="Calidad gráfica" value={quality} onChange={event=>{setQuality(event.target.value as Quality);setSettled(false);setSkip(false);setPhase("idle");}}><option value="low">Ligera</option><option value="medium">Equilibrada</option><option value="high">Alta</option></select></label>
      {settled&&last?<button onClick={()=>{setRoundIndex(0);setSettled(false);setSkip(false);setPaused(false);setRun(i=>i+1);}}>Repetir escena</button>:<button onClick={()=>{setSkip(true);setPaused(false);}}>Omitir animación</button>}
    </footer>
    {settled&&last&&<details className={styles.history}><summary>Ver todas las tiradas</summary>{match.rounds.map((r,i)=><p key={i}><b>Ronda {i+1}:</b> {r.rolls.map(roll=>`${match.players.find(p=>p.id===roll.playerId)!.name}: ${roll.value}`).join(" · ")}</p>)}</details>}
  </section>;
}
