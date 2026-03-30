"use client";

import { useState, useEffect, useRef } from "react";
import { obtenerNivel } from "@/lib/cofres";

const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const CONFETTI_COLORS = [
  "#ffd700", "#ff6b00", "#ff3d00", "#00e676", "#00bfff",
  "#9b59b6", "#ff1493", "#fff", "#ffaa00",
];

export default function OverlayClient() {
  const [data, setData] = useState(null);
  const [prevFase, setPrevFase] = useState("esperando");
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState([]);
  const [rollingDice, setRollingDice] = useState([]);
  const audioCtxRef = useRef(null);

  // Poll live state every 800ms
  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch("/api/estado");
        const json = await res.json();
        if (active && json) {
          setData((prev) => {
            // Check phase transitions
            if (prev && prev.fase !== json.fase) {
              handlePhaseChange(prev.fase, json.fase, json);
            }
            return json;
          });
        }
      } catch {
        // silently retry
      }
    }

    poll();
    const interval = setInterval(poll, 800);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Handle phase transitions
  function handlePhaseChange(oldFase, newFase, newData) {
    if (newFase === "resultado" && newData.ganador) {
      // Trigger confetti
      launchConfetti();
      // Play win sound
      playSound("win");
    }
    if (newFase === "countdown") {
      playSound("tick");
    }
    if (newFase === "lanzando") {
      playSound("roll");
    }
  }

  // Web Audio sounds
  function playSound(type) {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "win") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
        osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
      } else if (type === "tick") {
        osc.type = "square";
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === "roll") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {
      // Audio not supported
    }
  }

  // Confetti
  function launchConfetti() {
    const pieces = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
      size: 6 + Math.random() * 10,
      rotation: Math.random() * 360,
    }));
    setConfettiPieces(pieces);
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 5000);
  }

  if (!data) {
    return (
      <div className="overlay">
        <div className="ov-brand">
          <div className="ov-brand-logo">🎲</div>
          <div className="ov-brand-text">DADO SALVAJE</div>
        </div>
      </div>
    );
  }

  const fase = data.fase || "esperando";
  const jugadores = data.jugadores || [];
  const ranking = data.ranking || [];
  const ganador = data.ganador;
  const resultado = data.resultado;
  const pozo = data.pozo || 0;
  const monto = data.monto || 10;

  const faseLabels = {
    esperando: "⏳ Esperando jugadores",
    countdown: "🔥 ¡Preparados!",
    lanzando: "🎲 ¡Lanzando dados!",
    resultado: "🏆 ¡Tenemos ganador!",
  };

  return (
    <div className="overlay">
      {/* Brand */}
      <div className="ov-brand">
        <div className="ov-brand-logo">🎲</div>
        <div className="ov-brand-text">DADO SALVAJE</div>
      </div>

      {/* Fase indicator */}
      <div className={`ov-fase ${fase}`}>{faseLabels[fase] || fase}</div>

      {/* LEFT — Ranking */}
      {ranking.length > 0 && (
        <div className="ov-left">
          <div className="ov-panel">
            <div className="ov-panel-header">
              <span className="ov-panel-icon">🏆</span>
              <span className="ov-panel-title">Ranking</span>
            </div>
            <div className="ov-panel-body">
              <div className="ov-rank-list">
                {ranking.slice(0, 5).map((r, i) => {
                  const nivel = obtenerNivel(r.puntos);
                  return (
                    <div
                      className="ov-rank-item"
                      key={r.dni}
                      style={{ animationDelay: `${i * 0.1}s` }}
                    >
                      <div
                        className={`ov-rank-pos ${
                          i < 3 ? `pos-${i + 1}` : "pos-other"
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div className="ov-rank-info">
                        <div className="ov-rank-name">{r.nombres}</div>
                        <div className="ov-rank-level">
                          <span
                            className="ov-level-badge"
                            style={{
                              background: `${nivel.color}20`,
                              color: nivel.color,
                              border: `1px solid ${nivel.color}40`,
                            }}
                          >
                            {nivel.emoji} {nivel.nombre}
                          </span>
                        </div>
                      </div>
                      <div className="ov-rank-points">{r.puntos}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RIGHT — Last Winner */}
      {ganador && fase === "resultado" && resultado && (
        <div className="ov-right">
          <div className="ov-panel">
            <div className="ov-panel-header">
              <span className="ov-panel-icon">🔥</span>
              <span className="ov-panel-title">Último Ganador</span>
            </div>
            <div className="ov-winner-mini">
              <div className="ov-winner-mini-label">Ganador</div>
              <div className="ov-winner-mini-name">{ganador.nombres}</div>
              <div className="ov-winner-mini-prize">
                S/ {Number(resultado.premio || 0).toFixed(0)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM — Players + Pot */}
      {jugadores.length > 0 && fase !== "resultado" && (
        <div className="ov-bottom">
          <div className="ov-players-bar">
            {jugadores.map((j, i) => {
              const nivel = obtenerNivel(j.puntos || 0);
              return (
                <div
                  className="ov-player-chip"
                  key={j.dni || i}
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div
                    className="ov-player-avatar"
                    style={{
                      background: `linear-gradient(135deg, ${nivel.color}, ${nivel.color}cc)`,
                    }}
                  >
                    {j.nombres?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <div className="ov-player-name">{j.nombres}</div>
                    <div className="ov-player-monto">S/ {monto}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ov-pot">
            <div className="ov-pot-label">Pozo Total</div>
            <div className="ov-pot-value">S/ {pozo}</div>
          </div>
        </div>
      )}

      {/* CENTER — Countdown */}
      {fase === "countdown" && data.countdown > 0 && (
        <div className="ov-center" key={`cd-${data.countdown}`}>
          <div className="ov-countdown">
            <div className="ov-countdown-number">{data.countdown}</div>
            <div className="ov-countdown-text">Preparados</div>
          </div>
        </div>
      )}

      {/* CENTER — Rolling */}
      {fase === "lanzando" && (
        <div className="ov-center">
          <div className="ov-rolling">
            {jugadores.map((j, i) => (
              <div className="ov-dice-container" key={j.dni || i}>
                <div className="ov-dice rolling">
                  {DICE_FACES[Math.floor(Math.random() * 6) + 1]}
                </div>
                <div className="ov-dice-name">{j.nombres?.split(" ")[0]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CENTER — Winner Reveal */}
      {fase === "resultado" && ganador && resultado && (
        <div className="ov-center">
          <div className="ov-winner-reveal">
            <div className="ov-winner-crown">👑</div>
            <div className="ov-winner-title">¡Ganador!</div>
            <div className="ov-winner-name-big">{ganador.nombres}</div>
            <div className="ov-winner-prize-big">
              S/ {Number(resultado.premio || 0).toFixed(0)}
            </div>
            <div className="ov-winner-dice-result">
              Dado: {DICE_FACES[ganador.valor]} ({ganador.valor})
            </div>
          </div>
        </div>
      )}

      {/* Confetti */}
      {showConfetti && (
        <div className="ov-confetti">
          {confettiPieces.map((p) => (
            <div
              key={p.id}
              className="ov-confetti-piece"
              style={{
                left: `${p.left}%`,
                backgroundColor: p.color,
                width: `${p.size}px`,
                height: `${p.size}px`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
                transform: `rotate(${p.rotation}deg)`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
