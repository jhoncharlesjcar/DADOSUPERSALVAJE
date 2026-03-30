"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { resolverGanador } from "@/lib/dados";
import { obtenerNivel, obtenerProgresoNivel, NIVELES } from "@/lib/cofres";

const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const MONTOS = [5, 10, 20, 50, 100];

export default function PanelPrincipal() {
  // Search
  const [dni, setDni] = useState("");
  const [jugador, setJugador] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [noEncontrado, setNoEncontrado] = useState(false);

  // Register
  const [showRegistro, setShowRegistro] = useState(false);
  const [regForm, setRegForm] = useState({
    nombres: "",
    celular: "",
    codigo_yapeo: "",
  });

  // Room
  const [jugadores, setJugadores] = useState([]);
  const [monto, setMonto] = useState(10);

  // Game phases
  const [fase, setFase] = useState("idle"); // idle | countdown | rolling | result
  const [countdown, setCountdown] = useState(0);
  const [resultado, setResultado] = useState(null);

  // Ranking
  const [ranking, setRanking] = useState([]);

  // History
  const [historial, setHistorial] = useState([]);

  // Toasts
  const [toasts, setToasts] = useState([]);

  // Audio
  const audioCtxRef = useRef(null);

  const addToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  // Sync live state to overlay
  const syncOverlay = useCallback(async (updates) => {
    try {
      await fetch("/api/estado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    } catch {
      // silently fail
    }
  }, []);

  // Load history + ranking
  useEffect(() => {
    fetch("/api/partida")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setHistorial(data);
      })
      .catch(() => {});

    fetch("/api/ranking")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRanking(data);
      })
      .catch(() => {});
  }, [resultado]);

  // Sync when players change
  useEffect(() => {
    const pozo = jugadores.length * monto;
    syncOverlay({
      jugadores: jugadores.map((j) => ({
        dni: j.dni,
        nombres: j.nombres,
        puntos: j.puntos || 0,
      })),
      monto,
      pozo,
      fase: jugadores.length > 0 ? "esperando" : "esperando",
    });
  }, [jugadores, monto, syncOverlay]);

  // Sound effects
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

      if (type === "countdown") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === "go") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(1320, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === "roll") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(500, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === "win") {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.type = "sine";
          o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
          g.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.12);
          g.gain.exponentialRampToValueAtTime(
            0.01,
            ctx.currentTime + i * 0.12 + 0.2
          );
          o.start(ctx.currentTime + i * 0.12);
          o.stop(ctx.currentTime + i * 0.12 + 0.2);
        });
      }
    } catch {
      // Audio not available
    }
  }

  // Search player
  async function buscarJugador() {
    if (!dni.trim()) return;
    setBuscando(true);
    setJugador(null);
    setNoEncontrado(false);
    setShowRegistro(false);

    try {
      const res = await fetch(`/api/jugador?dni=${dni.trim()}`);
      const data = await res.json();
      if (data) {
        setJugador(data);
        addToast(`Jugador encontrado: ${data.nombres}`);
      } else {
        setNoEncontrado(true);
        setShowRegistro(true);
        setRegForm((prev) => ({ ...prev, nombres: "" }));
      }
    } catch {
      addToast("Error al buscar jugador", "error");
    }
    setBuscando(false);
  }

  // Register player
  async function registrarJugador() {
    if (!regForm.nombres.trim()) {
      addToast("Ingresa el nombre del jugador", "error");
      return;
    }

    try {
      const res = await fetch("/api/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dni: dni.trim(), ...regForm }),
      });
      const data = await res.json();
      if (data.ok) {
        const nuevoJugador = { dni: dni.trim(), ...regForm, puntos: 0 };
        setJugador(nuevoJugador);
        setShowRegistro(false);
        addToast("Jugador registrado exitosamente");
      }
    } catch {
      addToast("Error al registrar jugador", "error");
    }
  }

  // Add to room
  function agregarJugador() {
    if (!jugador) return;
    if (jugadores.find((j) => j.dni === jugador.dni)) {
      addToast("Este jugador ya está en la sala", "error");
      return;
    }
    setJugadores([...jugadores, { ...jugador }]);
    setJugador(null);
    setDni("");
    setNoEncontrado(false);
    setShowRegistro(false);
    addToast(`${jugador.nombres} agregado a la sala`);
  }

  // Remove from room
  function removerJugador(index) {
    setJugadores(jugadores.filter((_, i) => i !== index));
  }

  // ========= LAUNCH WITH COUNTDOWN =========
  async function lanzarDados() {
    if (jugadores.length < 2) {
      addToast("Necesitas al menos 2 jugadores", "error");
      return;
    }

    // — PHASE: Countdown 3...2...1
    setFase("countdown");
    setResultado(null);
    const pozo = jugadores.length * monto;

    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      playSound("countdown");
      await syncOverlay({ fase: "countdown", countdown: i, pozo });
      await new Promise((r) => setTimeout(r, 1000));
    }

    // — PHASE: Rolling
    setFase("rolling");
    setCountdown(0);
    playSound("go");
    await syncOverlay({ fase: "lanzando", countdown: 0 });

    // Rolling animation duration
    playSound("roll");
    await new Promise((r) => setTimeout(r, 2500));

    // — PHASE: Result
    const res = resolverGanador(jugadores);
    const premio = pozo * 0.8;

    const resultadoFinal = {
      ...res,
      premio,
      pozo,
      monto,
    };

    setResultado(resultadoFinal);
    setFase("result");
    playSound("win");

    // Sync to overlay
    await syncOverlay({
      fase: "resultado",
      ganador: {
        dni: res.ganador.dni,
        nombres: res.ganador.nombres,
        valor: res.ganador.valor,
      },
      resultado: {
        premio,
        pozo,
        resultados: res.resultados.map((r) => ({
          dni: r.dni,
          nombres: r.nombres,
          valor: r.valor,
        })),
      },
    });

    // Save game to DB
    try {
      await fetch("/api/partida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modo: "normal",
          monto,
          pozo,
          ganador_dni: res.ganador.dni,
          ganador_nombre: res.ganador.nombres,
          premio,
          jugadores: jugadores.map((j) => ({
            dni: j.dni,
            nombres: j.nombres,
          })),
          resultados: res.resultados.map((r) => ({
            nombres: r.nombres,
            valor: r.valor,
          })),
        }),
      });
    } catch {
      // silently fail
    }
  }

  // New game
  function nuevaPartida() {
    setJugadores([]);
    setResultado(null);
    setFase("idle");
    setCountdown(0);
    setJugador(null);
    setDni("");
    syncOverlay({
      jugadores: [],
      pozo: 0,
      ganador: null,
      resultado: null,
      fase: "esperando",
      countdown: 0,
    });
  }

  const pozo = jugadores.length * monto;

  return (
    <div className="app-container">
      {/* ===== HEADER ===== */}
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">🎲</div>
          <div>
            <div className="header-title">DADO SALVAJE</div>
            <div className="header-subtitle">Panel de Control</div>
          </div>
        </div>
        <div className="header-stats">
          <div className="header-stat">
            <div className="header-stat-value">{jugadores.length}</div>
            <div className="header-stat-label">En Sala</div>
          </div>
          <div className="header-stat">
            <div className="header-stat-value">S/ {pozo}</div>
            <div className="header-stat-label">Pozo</div>
          </div>
          <div className="header-stat">
            <div className="header-stat-value">{historial.length}</div>
            <div className="header-stat-label">Partidas</div>
          </div>
          <a
            href="/overlay"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
          >
            📺 Overlay
          </a>
        </div>
      </header>

      {/* ===== MAIN ===== */}
      <main className="main-content main-content-3col">
        {/* ===== LEFT PANEL ===== */}
        <div className="search-section">
          {/* Search Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-header-icon">🔍</div>
              <div className="card-title">Buscar Jugador</div>
            </div>
            <div className="card-body">
              <div className="search-group">
                <label className="search-label" htmlFor="dni-search">
                  DNI del Jugador
                </label>
                <div className="search-input-wrapper">
                  <input
                    id="dni-search"
                    className="input-field"
                    type="text"
                    placeholder="Ingresa el DNI..."
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && buscarJugador()}
                    maxLength={8}
                    disabled={fase !== "idle"}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={buscarJugador}
                    disabled={buscando || !dni.trim() || fase !== "idle"}
                  >
                    {buscando ? "..." : "Buscar"}
                  </button>
                </div>
              </div>

              {/* Player Found */}
              {jugador && (
                <div className="player-found" style={{ marginTop: 16 }}>
                  <div className="player-found-header">
                    <div className="player-found-name">{jugador.nombres}</div>
                    {jugador.puntos > 0 && (
                      <NivelBadge puntos={jugador.puntos} />
                    )}
                  </div>
                  <div className="player-found-info">
                    DNI: {jugador.dni}
                    {jugador.celular && ` · Tel: ${jugador.celular}`}
                    {jugador.puntos > 0 && ` · ⭐ ${jugador.puntos} pts`}
                  </div>
                  {jugador.puntos > 0 && (
                    <ProgresoNivel puntos={jugador.puntos} />
                  )}
                  <div className="player-found-actions">
                    <button
                      className="btn btn-success btn-sm"
                      onClick={agregarJugador}
                    >
                      ✚ Agregar a Sala
                    </button>
                  </div>
                </div>
              )}

              {/* Not Found — Register */}
              {noEncontrado && showRegistro && (
                <div className="register-form" style={{ marginTop: 16 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--warning)",
                      marginBottom: 4,
                    }}
                  >
                    ⚠️ Jugador no encontrado. Regístralo:
                  </div>
                  <input
                    className="input-field input-field-sm"
                    type="text"
                    placeholder="Nombres completos"
                    value={regForm.nombres}
                    onChange={(e) =>
                      setRegForm({ ...regForm, nombres: e.target.value })
                    }
                  />
                  <div className="form-row">
                    <input
                      className="input-field input-field-sm"
                      type="text"
                      placeholder="Celular"
                      value={regForm.celular}
                      onChange={(e) =>
                        setRegForm({ ...regForm, celular: e.target.value })
                      }
                    />
                    <input
                      className="input-field input-field-sm"
                      type="text"
                      placeholder="Código Yapeo"
                      value={regForm.codigo_yapeo}
                      onChange={(e) =>
                        setRegForm({
                          ...regForm,
                          codigo_yapeo: e.target.value,
                        })
                      }
                    />
                  </div>
                  <button
                    className="btn btn-primary btn-block"
                    onClick={registrarJugador}
                  >
                    Registrar Jugador
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Monto Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-header-icon">💰</div>
              <div className="card-title">Monto por Jugador</div>
            </div>
            <div className="card-body">
              <div className="monto-selector">
                {MONTOS.map((m) => (
                  <button
                    key={m}
                    className={`monto-btn ${monto === m ? "active" : ""}`}
                    onClick={() => setMonto(m)}
                    disabled={fase !== "idle"}
                  >
                    S/ {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Recent History */}
          <div className="card">
            <div className="card-header">
              <div className="card-header-icon">📋</div>
              <div className="card-title">Últimas Partidas</div>
            </div>
            <div className="card-body">
              {historial.length === 0 ? (
                <div className="sala-empty">
                  <div className="sala-empty-text">Sin partidas aún</div>
                </div>
              ) : (
                <div className="history-list">
                  {historial.slice(0, 8).map((h) => (
                    <div className="history-item" key={h.id}>
                      <div>
                        <div className="history-winner">
                          🏆 {h.ganador_nombre}
                        </div>
                        <div className="history-date">
                          {new Date(h.fecha).toLocaleString("es-PE", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <div className="history-prize">
                        S/ {Number(h.premio).toFixed(0)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== CENTER PANEL — Game ===== */}
        <div className="right-panel">
          {/* Room Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-header-icon">👥</div>
              <div className="card-title">Jugadores en Sala</div>
              <span
                className="badge badge-count"
                style={{ marginLeft: "auto" }}
              >
                {jugadores.length} jugadores
              </span>
            </div>
            <div className="card-body">
              {jugadores.length === 0 ? (
                <div className="sala-empty">
                  <div className="sala-empty-icon">🎯</div>
                  <div className="sala-empty-text">
                    Busca jugadores por DNI y agrégalos a la sala
                  </div>
                </div>
              ) : (
                <>
                  {/* Game Settings */}
                  <div className="game-settings">
                    <div className="game-setting">
                      <div className="game-setting-label">Jugadores</div>
                      <div className="game-setting-value">
                        {jugadores.length}
                      </div>
                    </div>
                    <div className="game-setting">
                      <div className="game-setting-label">Monto c/u</div>
                      <div className="game-setting-value">S/ {monto}</div>
                    </div>
                    <div className="game-setting">
                      <div className="game-setting-label">Pozo Total</div>
                      <div className="game-setting-value pozo">S/ {pozo}</div>
                    </div>
                    <div className="game-setting">
                      <div className="game-setting-label">Premio (80%)</div>
                      <div className="game-setting-value pozo">
                        S/ {(pozo * 0.8).toFixed(0)}
                      </div>
                    </div>
                  </div>

                  {/* Player List */}
                  <div className="sala-list">
                    {jugadores.map((j, i) => {
                      const nivel = obtenerNivel(j.puntos || 0);
                      return (
                        <div
                          className="sala-player"
                          key={j.dni}
                          style={{ animationDelay: `${i * 0.05}s` }}
                        >
                          <div className="sala-player-info">
                            <div
                              className="sala-player-avatar"
                              style={{
                                background: `linear-gradient(135deg, ${nivel.color}, ${nivel.color}cc)`,
                              }}
                            >
                              {j.nombres?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div>
                              <div className="sala-player-name">
                                {j.nombres}
                              </div>
                              <div className="sala-player-dni">
                                DNI: {j.dni}
                                <span
                                  className="nivel-tag"
                                  style={{
                                    color: nivel.color,
                                    marginLeft: 8,
                                  }}
                                >
                                  {nivel.emoji} {nivel.nombre}
                                </span>
                              </div>
                            </div>
                          </div>
                          {fase === "idle" && (
                            <button
                              className="sala-player-remove"
                              onClick={() => removerJugador(i)}
                              title="Remover"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ===== GAME ACTION AREA ===== */}
          {jugadores.length >= 2 && fase === "idle" && (
            <div className="card">
              <div className="card-body dice-area">
                <button
                  className="btn btn-dice"
                  onClick={lanzarDados}
                >
                  🎲 LANZAR DADOS
                </button>
              </div>
            </div>
          )}

          {/* Countdown */}
          {fase === "countdown" && (
            <div className="card card-countdown">
              <div className="card-body dice-area">
                <div className="countdown-display" key={countdown}>
                  <div className="countdown-number">{countdown}</div>
                  <div className="countdown-text">PREPARADOS...</div>
                </div>
              </div>
            </div>
          )}

          {/* Rolling */}
          {fase === "rolling" && (
            <div className="card">
              <div className="card-body dice-area">
                <div className="rolling-label">🎲 LANZANDO DADOS...</div>
                <div className="dice-rolling">
                  {jugadores.map((j, i) => (
                    <div key={j.dni} className="dice-slot">
                      <div className="dice rolling">
                        {DICE_FACES[Math.floor(Math.random() * 6) + 1]}
                      </div>
                      <div className="dice-player-name">
                        {j.nombres?.split(" ")[0]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {fase === "result" && resultado && (
            <div className="card results-container">
              <div className="card-body">
                <div className="results-header">
                  <div className="results-crown">👑</div>
                  <div className="results-title">¡TENEMOS GANADOR!</div>
                </div>

                <div className="winner-card">
                  <div className="winner-name">
                    {resultado.ganador.nombres}
                  </div>
                  <div
                    style={{ fontSize: 14, color: "var(--text-secondary)" }}
                  >
                    DNI: {resultado.ganador.dni} · Dado:{" "}
                    {DICE_FACES[resultado.ganador.valor]}{" "}
                    {resultado.ganador.valor}
                  </div>
                  <div className="winner-prize">
                    S/ {resultado.premio.toFixed(2)}
                  </div>
                  <div className="winner-prize-label">
                    PREMIO • Pozo: S/ {resultado.pozo} (80%)
                  </div>
                </div>

                {/* Results Table */}
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Jugador</th>
                      <th>Dado</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.resultados
                      .sort((a, b) => b.valor - a.valor)
                      .map((r, i) => (
                        <tr
                          key={r.dni}
                          className={
                            r.dni === resultado.ganador.dni ? "winner-row" : ""
                          }
                        >
                          <td>{i + 1}</td>
                          <td>
                            {r.dni === resultado.ganador.dni && "🏆 "}
                            {r.nombres}
                          </td>
                          <td>
                            <span
                              className={`dice-value ${
                                r.valor ===
                                Math.max(
                                  ...resultado.resultados.map((x) => x.valor)
                                )
                                  ? "max"
                                  : ""
                              }`}
                            >
                              {r.valor}
                            </span>
                          </td>
                          <td>{DICE_FACES[r.valor]}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                {resultado.rondas.length > 1 && (
                  <div className="desempate-notice">
                    ⚡ Hubo {resultado.rondas.length - 1} ronda(s) de
                    desempate
                  </div>
                )}

                <div style={{ marginTop: 24, textAlign: "center" }}>
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={nuevaPartida}
                  >
                    🔄 Nueva Partida
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===== RIGHT PANEL — Ranking ===== */}
        <div className="ranking-panel">
          <div className="card">
            <div className="card-header">
              <div className="card-header-icon">🏆</div>
              <div className="card-title">Ranking Global</div>
            </div>
            <div className="card-body">
              {ranking.length === 0 ? (
                <div className="sala-empty">
                  <div className="sala-empty-text">
                    Sin ranking aún
                  </div>
                </div>
              ) : (
                <div className="ranking-list">
                  {ranking.slice(0, 10).map((r, i) => {
                    const nivel = obtenerNivel(r.puntos);
                    return (
                      <div className="ranking-item" key={r.dni}>
                        <div
                          className={`ranking-pos ${
                            i < 3 ? `pos-${i + 1}` : ""
                          }`}
                        >
                          {i < 3
                            ? ["🥇", "🥈", "🥉"][i]
                            : i + 1}
                        </div>
                        <div className="ranking-info">
                          <div className="ranking-name">{r.nombres}</div>
                          <div className="ranking-level">
                            <span style={{ color: nivel.color }}>
                              {nivel.emoji} {nivel.nombre}
                            </span>
                            <span className="ranking-stats">
                              {r.partidas_ganadas}W / {r.partidas_jugadas}P
                            </span>
                          </div>
                        </div>
                        <div className="ranking-points">{r.puntos} pts</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Niveles reference */}
          <div className="card">
            <div className="card-header">
              <div className="card-header-icon">🎁</div>
              <div className="card-title">Cofres / Niveles</div>
            </div>
            <div className="card-body">
              <div className="niveles-list">
                {NIVELES.slice(1).map((n) => (
                  <div className="nivel-item" key={n.nombre}>
                    <span className="nivel-emoji">{n.emoji}</span>
                    <span
                      className="nivel-nombre"
                      style={{ color: n.color }}
                    >
                      {n.nombre}
                    </span>
                    <span className="nivel-puntos">{n.puntos} pts</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ===== TOASTS ===== */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === "success" ? "✅" : "❌"} {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

// ========= SUB-COMPONENTS =========

function NivelBadge({ puntos }) {
  const nivel = obtenerNivel(puntos);
  return (
    <span
      className="nivel-badge-inline"
      style={{
        background: `${nivel.color}18`,
        color: nivel.color,
        border: `1px solid ${nivel.color}40`,
      }}
    >
      {nivel.emoji} {nivel.nombre}
    </span>
  );
}

function ProgresoNivel({ puntos }) {
  const { nivel, siguiente, progreso, puntosParaSiguiente } =
    obtenerProgresoNivel(puntos);

  if (!siguiente) {
    return (
      <div className="progreso-nivel">
        <div className="progreso-label">
          <span>🎲 ¡NIVEL MÁXIMO!</span>
        </div>
        <div className="progreso-bar">
          <div
            className="progreso-fill max"
            style={{ width: "100%" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="progreso-nivel">
      <div className="progreso-label">
        <span style={{ color: nivel.color }}>
          {nivel.emoji} {nivel.nombre}
        </span>
        <span style={{ color: siguiente.color }}>
          → {siguiente.emoji} {siguiente.nombre}
        </span>
      </div>
      <div className="progreso-bar">
        <div
          className="progreso-fill"
          style={{
            width: `${progreso}%`,
            background: `linear-gradient(90deg, ${nivel.color}, ${siguiente.color})`,
          }}
        />
      </div>
      <div className="progreso-text">
        Faltan {puntosParaSiguiente} pts
      </div>
    </div>
  );
}
