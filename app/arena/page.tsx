"use client";

import { useState } from "react";
import Link from "next/link";
import ArenaReplay from "../_components/ArenaReplay";
import { DADOS_DISPONIBLES } from "@/lib/dados";
import type { ArenaMatch } from "@/lib/arena/types";

function demo(count: number, tie: boolean): ArenaMatch {
  const players = Array.from({ length: count }, (_, i) => ({id:`demo-${i}`,name:["Valentina","Mateo","Camila","Diego","Lucía","Bruno","Alma","Leo","Sofía","Nicolás"][i],dadoId:DADOS_DISPONIBLES[i].id}));
  const rolls=players.map((p,i)=>({playerId:p.id,value:i===0?6:i===1&&tie?6:Math.max(1,5-i%5)}));
  return {id:`demo-${count}-${tie}`,players,rounds:tie?[{rolls,leaders:[players[0].id,players[1].id]},{rolls:[{playerId:players[0].id,value:2},{playerId:players[1].id,value:4}],leaders:[players[1].id]}]:[{rolls,leaders:[players[0].id]}],winnerId:players[tie?1:0].id};
}
const examples = [demo(2,false),demo(10,false),demo(3,true)];
export default function ArenaDemo(){
  const [selected,setSelected]=useState(0);
  return <main style={{maxWidth:1140,margin:"0 auto",padding:"40px 18px 70px"}}>
    <header style={{display:"flex",justifyContent:"space-between",gap:20,alignItems:"center",marginBottom:24,flexWrap:"wrap"}}><div><p style={{color:"#bca77a",fontSize:11,letterSpacing:2}}>VISTA PREVIA · SIN APUESTAS</p><h1 style={{fontSize:26,marginTop:8}}>La nueva arena</h1></div><Link href="/" style={{color:"#bca77a"}}>Volver al inicio</Link></header>
    <div style={{display:"flex",gap:10,marginBottom:22,flexWrap:"wrap"}}>{["Duelo · 2 jugadores","Batalla · 10 jugadores","Desempate · 3 jugadores"].map((label,i)=><button key={label} className={`btn ${selected===i?"btn-primary":"btn-secondary"}`} aria-pressed={selected===i} onClick={()=>setSelected(i)}>{label}</button>)}</div>
    <ArenaReplay key={selected} match={examples[selected]}/>
    <p style={{color:"#9babb2",fontSize:12,marginTop:20,lineHeight:1.7}}>Partidas de demostración con resultados fijos. Esta pantalla no cobra entradas ni modifica saldos. Usa «Repetir escena» para volver a ver el mismo lanzamiento.</p>
  </main>;
}
