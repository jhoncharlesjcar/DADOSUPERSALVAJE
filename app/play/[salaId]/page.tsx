"use client";

import { motion, useReducedMotion } from "framer-motion";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ArenaReplay from "@/app/_components/ArenaReplay";
import type { ArenaMatch } from "@/lib/arena/types";
import { formatSoles } from "@/lib/currency";
import MascotCelebration from "@/app/_components/MascotCelebration";

type RoomData = {
  replay: ArenaMatch | null;
  room: { id: string; mode: string; stake: number; status: string; players: Array<{ name: string; isMe: boolean; confirmed: boolean }> };
  result: null | {
    winner: { seat: number; name: string; value: number; isMe: boolean };
    rolls: Array<{ seat: number; name: string; value: number; isMe: boolean }>;
    prize: number;
    pool: number;
    tiebreakRounds: number;
  };
};

export default function OnlineGameRoom({ params }: { params: Promise<{ salaId: string }> }) {
  const { salaId } = use(params);
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [data, setData] = useState<RoomData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);

  const loadRoom = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/game/room?id=${encodeURIComponent(salaId)}`, { cache: "no-store" });
      const payload = await response.json();
      if (response.status === 401) {
        router.replace("/lobby");
        return;
      }
      if (!response.ok) throw new Error(payload.error || "No pudimos cargar esta sala.");
      setData(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No pudimos cargar esta sala.");
    } finally {
      setLoading(false);
    }
  }, [router, salaId]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadRoom(); }, 0);
    return () => clearTimeout(timer);
  }, [loadRoom]);

  useEffect(() => {
    if (!data || data.result || ["anulada", "en_disputa"].includes(data.room.status)) return;
    const timer = setInterval(() => { void loadRoom(); }, 2000);
    return () => clearInterval(timer);
  }, [data, loadRoom]);

  async function confirmEntry() {
    try {
      const response = await fetch("/api/game/room", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:salaId,action:"confirm"})});
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo confirmar");
      await loadRoom();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo confirmar"); }
  }

  async function returnToLobby() {
    if (data?.result) {
      await fetch(`/api/game/room?id=${encodeURIComponent(salaId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: salaId, action: "view" }),
      }).catch(() => null);
    }
    router.push("/lobby");
  }

  if (loading) {
    return <main className="game-stage" aria-live="polite"><div className="game-loader"><span className="game-die">⚄</span><p>Preparando la arena…</p></div></main>;
  }

  if (error || !data) {
    return (
      <main className="game-stage"><section className="game-result-card game-error-card">
        <span className="game-result-icon" aria-hidden="true">!</span><h1>No pudimos abrir la partida</h1>
        <p>{error || "La sala ya no está disponible."}</p>
        <div className="game-actions"><button className="btn btn-primary" onClick={() => void loadRoom()}>REINTENTAR</button><button className="btn btn-secondary" onClick={() => router.push("/lobby")}>IR AL LOBBY</button></div>
      </section></main>
    );
  }

  if (!data.result) {
    return (
      <main className="game-stage"><section className="game-result-card">
        <span className="game-result-icon" aria-hidden="true">⌛</span><p className="game-eyebrow">SALA #{data.room.id}</p>
        <h1>{data.room.status === "confirmando" ? "Confirma tu entrada" : data.room.status === "anulada" ? "Partida anulada" : data.room.status === "en_disputa" ? "Partida en revisión" : "Esperando el resultado"}</h1><p>La apuesta se bloquea cuando todos confirman. Entrada: {formatSoles(data.room.stake)}.</p>
        {data.room.status === "confirmando" && !data.room.players.find(p=>p.isMe)?.confirmed && <button className="btn btn-primary" onClick={()=>void confirmEntry()}>CONFIRMAR ENTRADA</button>}
        <div className="game-actions"><button className="btn btn-primary" onClick={() => void loadRoom()}>ACTUALIZAR</button><button className="btn btn-secondary" onClick={() => router.push("/lobby")}>VOLVER</button></div>
      </section></main>
    );
  }

  const { result, room } = data;
  const winnerMascot = data.replay?.players.find(player => player.id === data.replay?.winnerId)?.dadoId;
  const sortedRolls = [...result.rolls].sort((a, b) => Number(b.seat === result.winner.seat) - Number(a.seat === result.winner.seat));

  return (
    <main className="game-stage">
      <header className="game-header"><p className="game-eyebrow">SALA #{room.id} · {room.mode.toUpperCase()}</p><h1>DADO SALVAJE</h1><p>{room.players.length} jugadores · entrada {formatSoles(room.stake)}</p></header>
      {data.replay && <div style={{width:"100%",maxWidth:1100}}><ArenaReplay key={data.replay.id} match={data.replay} onComplete={()=>setRevealed(true)}/></div>}
      {(revealed || !data.replay) && (
        <motion.section className={`game-result-card ${result.winner.isMe ? "is-winner" : "is-defeat"}`} initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: reduceMotion ? 0 : 0.5 }}>
          <span className="game-result-icon" aria-hidden="true">{result.winner.isMe ? "🏆" : "◆"}</span>
          <p className="game-eyebrow">RESULTADO FINAL</p><h2>{result.winner.isMe ? "¡Victoria salvaje!" : `${result.winner.name} gana la ronda`}</h2>
          {winnerMascot && <MascotCelebration key={`${data.replay?.id}-${winnerMascot}`} dadoId={winnerMascot} />}
          <p className="game-prize">{result.winner.isMe ? `Ganaste ${formatSoles(result.prize)}` : `Premio de la sala: ${formatSoles(result.prize)}`}</p>
          {result.tiebreakRounds > 0 && <p className="game-tiebreak">Se resolvió tras {result.tiebreakRounds} desempate{result.tiebreakRounds === 1 ? "" : "s"}.</p>}
          <p>Última tirada de cada jugador{result.tiebreakRounds > 0 ? " (en rondas distintas)" : ""}.</p>
          <div className="game-scoreboard" aria-label="Resultados de la partida">
            {sortedRolls.map((roll, index) => <div className={`game-score-row ${roll.isMe ? "is-me" : ""}`} key={`${roll.name}-${index}`}><span><small>{roll.seat === result.winner.seat ? "★" : "·"}</small>{roll.isMe ? "Tú" : roll.name}</span><strong aria-label={`Resultado ${roll.value}`}>{roll.value}</strong></div>)}
          </div>
          <div className="game-summary"><span>Pozo <strong>{formatSoles(result.pool)}</strong></span><span>Entrada <strong>{formatSoles(room.stake)}</strong></span></div>
          <button className="btn btn-primary game-return" onClick={() => void returnToLobby()}>VOLVER AL LOBBY</button>
          <p className="virtual-credit-note">El resultado y el movimiento quedan registrados automáticamente.</p>
        </motion.section>
      )}
    </main>
  );
}
