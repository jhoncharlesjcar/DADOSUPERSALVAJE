"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { latestRolls, type ArenaMatch } from "@/lib/arena/types";
import PlayerSearch from "./PlayerSearch";
import { GamePhase } from "@/lib/gameEngine";
import GameConfig from "./GameConfig";
import GameRoom from "./GameRoom";
import GameHistory from "./GameHistory";
import GameResults from "./GameResults";
import RankingPanel from "./RankingPanel";
import DiceRoller from "./DiceRoller";
import { DicePhase, Player, GameResult, GameStats, Toast, LevelUp } from "@/types";
import { motion, useReducedMotion } from "framer-motion";
import { formatSoles } from "@/lib/currency";

export default function PanelPrincipal() {
  const reduceMotion = useReducedMotion();
  const [jugadores, setJugadores] = useState<Player[]>([]);
  const [monto, setMonto] = useState<number>(10);
  const [modoJuego, setModoJuego] = useState<string>("versus");

  // Game phases (Unified under GameEngine)
  const [fase, setFase] = useState<GamePhase>("espera");
  const [diceKey, setDiceKey] = useState<number>(0);
  const [resultado, setResultado] = useState<GameResult | null>(null);
  const [levelUp, setLevelUp] = useState<LevelUp | null>(null);
  const launchingRef = useRef(false);
  const [charging, setCharging] = useState(false);
  const [entryLocked, setEntryLocked] = useState(false);

  // Ranking & history
  const [ranking, setRanking] = useState<Player[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);

  // Stats
  const [stats, setStats] = useState<GameStats | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Ambient particles ref
  const appRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<any>(null);
  const roundIdRef = useRef<string>("");
  const [activeMatchId, setActiveMatchId] = useState("");

  const addToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Start ambient particles
  useEffect(() => {
    if (reduceMotion) return;
    let cancelled = false;
    import("@/lib/particleSystem").then(mod => {
      if (cancelled) return;
      particlesRef.current = mod;
      if (appRef.current) {
        mod.startAmbientParticles(appRef.current);
      }
    });
    return () => {
      cancelled = true;
      if (particlesRef.current) {
        particlesRef.current.stopAmbientParticles();
      }
    };
  }, [reduceMotion]);

  // Load history + ranking + stats on mount
  useEffect(() => {
    fetch("/api/partida").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setHistorial(data); }).catch(() => {});
    fetch("/api/ranking").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setRanking(data); }).catch(() => {});
    fetch("/api/estadisticas").then((r) => r.json()).then((data) => setStats(data)).catch(() => {});
  }, []);

  // Add player to room
  function handlePlayerAdd(player: Player) {
    if (entryLocked) return;
    if (jugadores.find((j) => j.dni === player.dni)) {
      addToast("Este jugador ya está en la sala", "error");
      return;
    }

    if (((player as any).saldo_real || 0) < monto) {
      addToast(`Saldo insuficiente. Necesita ${formatSoles(monto)} y tiene ${formatSoles(Number((player as any).saldo_real || 0))}`, "error");
      return;
    }

    if (modoJuego === "versus" && jugadores.length >= 2) {
      addToast("El modo Versus solo admite 2 jugadores", "error");
      return;
    }
    if (modoJuego === "batalla" && jugadores.length >= 10) {
      addToast("Límite máximo de 10 jugadores alcanzado", "error");
      return;
    }
    if (jugadores.find((j) => j.dadoId === player.dadoId)) {
      addToast("Ese color de dado ya fue elegido por otro jugador", "error");
      return;
    }

    setJugadores([...jugadores, player]);
    addToast(`${player.nombres} agregado a la sala`);
  }

  // Interceptar el cambio de monto para evitar inflar la apuesta con jugadores pobres
  const handleMontoChange = (newMonto: number) => {
    if (entryLocked) return;
    const sinSaldo = jugadores.find((j: any) => (j.saldo_real || 0) < newMonto);
    if (sinSaldo) {
      addToast(`No se puede subir a ${formatSoles(newMonto)}. ${sinSaldo.nombres} solo tiene ${formatSoles(Number((sinSaldo as any).saldo_real || 0))}`, "error");
      return;
    }
    setMonto(newMonto);
  };

  // Remove player
  function removerJugador(index: number) {
    if (entryLocked) return;
    setJugadores(jugadores.filter((_, i) => i !== index));
  }

  // ========= COBRO KILL-SWITCH =========
  const handleCobroInicial = async (): Promise<boolean> => {
    
    try {
      if (!roundIdRef.current) roundIdRef.current = crypto.randomUUID();
      const dnis = jugadores.map(j => j.dni);
      const res = await fetch("/api/partida/cobro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dnis, monto, idempotencyKey: roundIdRef.current })
      });
      const data = await res.json();
      if (data.ok) {
        // Descontamos visualmente de inmediato
        setJugadores(prev => prev.map(j => ({ ...j, saldo_real: data.balances.find((b: { dni: string; saldo_real: number }) => b.dni === j.dni)?.saldo_real ?? j.saldo_real })));
        return true;
      } else {
        setEntryLocked(false);
        roundIdRef.current = "";
        addToast(data.error || "Error al procesar el pase a la arena", "error");
        return false;
      }
    } catch (e) {
      addToast("Error de conexión al procesar el cobro", "error");
      return false;
    }
  };

  const iniciarMotor = async () => {
    // Para empezar a jugar, la sala debe estar llena o al menos tener jugadores (depende de modoJuego)
    if (launchingRef.current) return;
    if (jugadores.length < 2) {
      addToast("La sala está vacía. Agrega jugadores primero.", "error");
      return;
    }

    // 1. Efectuar el cobro
    launchingRef.current = true;
    setCharging(true);
    setEntryLocked(true);
    const cobroExitoso = await handleCobroInicial();
    launchingRef.current = false;
    setCharging(false);
    if (!cobroExitoso) return;
    setActiveMatchId(roundIdRef.current);

    // 2. Iniciar el motor gráfico (hace que DiceRoller se monte)
    setFase("arena");
  };

  // ========= DICE ROLLER CALLBACKS =========
  function handleDicePhaseChange(dicePhase: DicePhase) {
    const rollingPhases: DicePhase[] = ["cup_entry", "cup_shake", "launching", "settling"];
    if (rollingPhases.includes(dicePhase)) {
      setFase("rodando");
    } else if (dicePhase === "winner_reveal") {
      setFase("calculo");
    }
  }

  async function handleDiceFinish(match: ArenaMatch, meta: { duracion_ms: number }) {
    const saveRes = await fetch("/api/partida", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idempotencyKey: match.id, modo: modoJuego, duracion_ms: meta.duracion_ms }),
    });
    const saveData = await saveRes.json();
    if (!saveRes.ok || !saveData.ok) throw new Error(saveData.error || "No se pudo confirmar la partida");
    const player = (id: string): Player => ({
      ...jugadores.find(j => j.dni === id)!,
      dni: id, nombres: match.players.find(p => p.id === id)!.name,
      dadoId: match.players.find(p => p.id === id)!.dadoId,
    });
    const resultados = latestRolls(match).map(roll => ({ ...player(roll.playerId), valor: roll.value }));
    const resultadoFinal: GameResult = {
      ganador: resultados.find(p => p.dni === match.winnerId)!, resultados,
      rondas: match.rounds.map(round => round.rolls.map(roll => ({ ...player(roll.playerId), valor: roll.value }))),
      premio: jugadores.length * monto * 0.8, pozo: jugadores.length * monto, monto,
      puntosGanados: saveData.levelUp?.puntosGanados, puntosTotal: saveData.levelUp?.puntosTotal,
      rachaActual: saveData.levelUp?.rachaActual,
    };
    if (saveData.ranking) setRanking(saveData.ranking);
    if (saveData.stats) setStats(saveData.stats);
    if (saveData.historial) setHistorial(saveData.historial);
    if (saveData.updatedBalances) setJugadores(prev => prev.map(j => ({ ...j,
      saldo_real: saveData.updatedBalances.find((balance: { dni: string; saldo_real: number }) => balance.dni === j.dni)?.saldo_real ?? j.saldo_real,
    })));
    if (saveData.levelUp?.nombre) setLevelUp(saveData.levelUp);
    setResultado(resultadoFinal);
    setFase("premios");
  }

  // New game
  function nuevaPartida() {
    setEntryLocked(false);
    setJugadores([]);
    setResultado(null);
    setFase("espera");
    setDiceKey((k) => k + 1);
    setLevelUp(null);
    roundIdRef.current = "";
  }

  const currentPozoTotal = jugadores.length * monto;

  return (
    <div className="app-container" ref={appRef}>
      {/* ===== HEADER ===== */}
      <header className="header">
        <div className="header-brand" style={{ gap: "16px", alignItems: "center" }}>
          <div style={{ 
            width: "60px", 
            height: "60px", 
            borderRadius: "12px", 
            overflow: "hidden", 
            border: "2px solid var(--gold)", 
            boxShadow: "0 0 15px rgba(212, 175, 55, 0.4)",
            flexShrink: 0
          }}>
            <img 
              src="/logo.webp" 
              alt="Dado Salvaje Logo" 
              style={{ width: "100%", height: "100%", objectFit: "cover" }} 
            />
          </div>
          <div>
            <div className="header-title" style={{ letterSpacing: '4px', fontSize: '1.2rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>DADO SALVAJE</div>
            <div className="header-subtitle" style={{ color: 'var(--gold-dark)', fontWeight: 600 }}>PREMIUM FANTASY GAME</div>
          </div>
        </div>
        <div className="header-stats">
          <div className="header-stat">
            <div className="header-stat-value" style={{ color: 'var(--white-soft)' }}>{jugadores.length}</div>
            <div className="header-stat-label">SALA</div>
          </div>
          <div className="header-stat" style={{ borderLeft: '1px solid rgba(212,175,55,0.2)', paddingLeft: '20px' }}>
            <div className="header-stat-value" style={{ color: 'var(--green-success)' }}>{formatSoles(currentPozoTotal)}</div>
            <div className="header-stat-label">POZO ACTUAL</div>
          </div>
          <div className="header-stat">
            <div className="header-stat-value">{stats?.totalPartidas || historial.length}</div>
            <div className="header-stat-label">Partidas</div>
          </div>
          {stats?.totalDinero && Number(stats.totalDinero) > 0 && (
            <div className="header-stat header-stat-premium">
              <div className="header-stat-value">{formatSoles(stats.totalDinero)}</div>
              <div className="header-stat-label">Repartido</div>
            </div>
          )}
          <a
            href="/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 16 }}
          >
            ⚙️ Panel Admin
          </a>
        </div>
      </header>

      {/* ===== MAIN ===== */}
      <main className="main-content main-content-3col">
        {/* ===== LEFT PANEL ===== */}
        <motion.div 
          className="search-section"
          initial={reduceMotion ? false : { opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
        >
          <PlayerSearch
            onPlayerAdd={handlePlayerAdd}
            jugadores={jugadores}
            disabled={entryLocked || charging || fase !== "espera"}
          />
          <GameConfig
            modoJuego={modoJuego}
            setModoJuego={setModoJuego}
            monto={monto}
            setMonto={handleMontoChange}
            disabled={entryLocked || charging || fase !== "espera"}
          />
          <GameHistory historial={historial} />
        </motion.div>

        {/* ===== CENTER PANEL — Game ===== */}
        <motion.div 
          className="right-panel"
          initial={reduceMotion ? false : { opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.6, delay: 0.2, ease: "easeOut" }}
        >
          <GameRoom
            jugadores={jugadores}
            monto={monto}
            fase={fase}
            onRemovePlayer={removerJugador}
            modoJuego={modoJuego}
            onPlayClick={iniciarMotor}
          />

          {charging && <p role="status">Confirmando entradas…</p>}

          {/* ===== DICE ROLLER ===== */}
          {(fase === "arena" || fase === "rodando" || fase === "calculo") && (
            <div className="card">
              <div className="card-body">
                <DiceRoller
                  key={diceKey}
                  jugadores={jugadores}
                  onFinish={handleDiceFinish}
                  onPhaseChange={handleDicePhaseChange}
                  matchId={activeMatchId}
                />
              </div>
            </div>
          )}

          {/* Results */}
          {fase === "premios" && resultado && (
            <GameResults
              resultado={resultado}
              levelUp={levelUp}
              onNewGame={nuevaPartida}
              onDismissLevelUp={() => setLevelUp(null)}
            />
          )}
        </motion.div>

        {/* ===== RIGHT PANEL — Ranking ===== */}
        <motion.div
          className="ranking-section"
          initial={reduceMotion ? false : { opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.6, delay: 0.4, ease: "easeOut" }}
        >
          <RankingPanel ranking={ranking} />
        </motion.div>
      </main>

      {/* ===== TOASTS ===== */}
      <div className="toast-container" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === "success" ? "✅" : "❌"} {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
