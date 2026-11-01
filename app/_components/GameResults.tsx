"use client";

import { useRef, useEffect, useState, useId } from "react";
import { GameResult, LevelUp } from "@/types";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { DADOS_DISPONIBLES } from "@/lib/dados";
import { MASCOT_CONFIG } from "./WinnerReveal";
import { formatSoles } from "@/lib/currency";
import MascotCelebration from "./MascotCelebration";
import { mascotModel } from "@/lib/mascots";

const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

interface GameResultsProps {
  resultado: GameResult | null;
  levelUp: LevelUp | null;
  onNewGame: () => void;
  onDismissLevelUp: () => void;
}

function LevelUpDialog({ levelUp, onDismiss }: { levelUp: LevelUp; onDismiss: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog ref={dialogRef} className="levelup-modal" aria-labelledby={titleId} aria-describedby={descriptionId}
      onClose={event => { if (!event.currentTarget.open) onDismiss(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
      }}>
      <div className="levelup-emoji" aria-hidden="true">{levelUp.emoji}</div>
      <h2 id={titleId} className="levelup-title">¡ASCENSO DE PODER!</h2>
      <div className="levelup-level">{levelUp.nombre}</div>
      <p id={descriptionId} className="levelup-points">NUEVO RANGO ALCANZADO CON {levelUp.puntosTotal} PUNTOS</p>
      <button className="btn btn-primary btn-lg btn-block levelup-continue" onClick={() => dialogRef.current?.close()}>CONTINUAR MI REINADO</button>
    </dialog>
  );
}

export default function GameResults({
  resultado,
  levelUp,
  onNewGame,
  onDismissLevelUp
}: GameResultsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageError, setImageError] = useState(false);
  const reduceMotion = useReducedMotion();

  const dadoConfig = DADOS_DISPONIBLES.find(d => d.id === resultado?.ganador.dadoId);
  const mascotConfig = resultado?.ganador.dadoId ? MASCOT_CONFIG[resultado.ganador.dadoId] : null;

  useEffect(() => {
    if (reduceMotion) return;
    let cancelled = false;
    import("@/lib/particleSystem").then(mod => {
      if (containerRef.current && !cancelled) {
        mod.victoryExplosion(containerRef.current, 50, 30);
        if (window.innerWidth >= 700) mod.coinShower(containerRef.current);
        mod.screenFlash(containerRef.current, "rgba(255,215,0,0.16)", 420);
      }
    });

    return () => { cancelled = true; };
  }, [reduceMotion]);

  useEffect(() => {
    import("@/lib/soundEngine").then(mod => {
      mod.playWinFanfare?.();
    });
  }, []);

  if (!resultado) return null;
  const sortedResults = [...resultado.resultados].sort((a, b) => Number(b.dni === resultado.ganador.dni) - Number(a.dni === resultado.ganador.dni));

  return (
    <>
      <div
        className="card results-container results-container-premium"
        ref={containerRef}
        style={{
          position: "relative",
          overflow: "hidden",
          border: '2px solid var(--gold)',
          backgroundImage: 'url(/arena_topdown.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Dark overlay para legibilidad */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,5,10,0.78)', zIndex: 0, pointerEvents: 'none' }} />
        <div className="card-body" style={{ position: 'relative', zIndex: 1 }}>
          {/* HUD corners */}
          <div className="hud-corner hud-corner-tl" />
          <div className="hud-corner hud-corner-tr" />
          <div className="hud-corner hud-corner-bl" />
          <div className="hud-corner hud-corner-br" />

          {/* HEADER */}
          <div className="results-header" style={{ marginBottom: '32px', textAlign: 'center' }}>
            <div style={{ fontSize: '72px', animation: 'float 1.8s ease-in-out infinite', filter: 'drop-shadow(0 0 20px rgba(212,175,55,0.8))' }}>👑</div>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(24px, 4vw, 42px)',
              fontWeight: 900,
              letterSpacing: 'clamp(1px, 1vw, 6px)',
              overflowWrap: 'anywhere',
              color: 'var(--gold)',
              textShadow: '0 0 40px rgba(212,175,55,0.8), 0 0 80px rgba(212,175,55,0.4)',
              marginTop: 8,
              animation: 'energyPulse 2.5s ease-in-out infinite',
            }}>¡VICTORIA SUPREMA!</div>
            <div style={{ width: '30%', height: 1, background: 'linear-gradient(90deg, transparent, var(--gold), transparent)', margin: '16px auto 0' }} />
          </div>

          {/* WINNER CARD */}
          <div style={{
            background: 'radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.12) 0%, rgba(0,0,0,0.4) 100%)',
            border: '1px solid rgba(212,175,55,0.5)',
            borderRadius: 16,
            padding: '20px 18px',
            marginBottom: 24,
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Glow top */}
            <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: 'linear-gradient(90deg,transparent,rgba(212,175,55,0.6),transparent)' }} />

            {/* Mascot Reveal Section */}
            <div style={{ position: 'relative', marginBottom: 24, width: '100%', display: 'flex', justifyContent: 'center' }}>
              <AnimatePresence>
                <motion.div
                  initial={reduceMotion ? false : { scale: 0.8, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={reduceMotion ? { duration: 0 } : {
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                    delay: 0.3
                  }}
                  style={{ position: 'relative', width: '100%', maxWidth: 520, minWidth: 0, display: 'block' }}
                >
                  <div style={{
                    position: 'absolute',
                    inset: -15,
                    background: `radial-gradient(circle, ${dadoConfig?.shadow || 'rgba(212,175,55,0.4)'} 0%, transparent 80%)`,
                    borderRadius: '16px',
                    filter: 'blur(30px)',
                    animation: 'pulse 2s infinite',
                    zIndex: 0
                  }} />

                  {resultado.ganador.dadoId && mascotModel(resultado.ganador.dadoId) ? (
                    <MascotCelebration key={resultado.ganador.dadoId} dadoId={resultado.ganador.dadoId} />
                  ) : !imageError && mascotConfig?.mascotImg ? (
                    <motion.img
                      src={mascotConfig.mascotImg}
                      alt={mascotConfig.nombre}
                      onError={() => setImageError(true)}
                      style={{
                        width: '100%',
                        height: 'auto',
                        aspectRatio: '1:1',
                        maxHeight: 520,
                        objectFit: 'cover',
                        objectPosition: 'center top',
                        borderRadius: 16,
                        position: 'relative',
                        zIndex: 2,
                        boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
                      }}
                       animate={reduceMotion ? { y: 0 } : { y: [0, -8, 0] }}
                       transition={reduceMotion ? { duration: 0 } : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      aspectRatio: '1 / 1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 120,
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: 16,
                      border: `2px dashed ${dadoConfig?.shadow || 'var(--gold)'}`,
                      color: dadoConfig?.dotColor || 'var(--gold)',
                      position: 'relative',
                      zIndex: 2,
                    }}>
                      🎲
                    </div>
                  )}

                  <motion.div
                    className="results-mascot-label"
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reduceMotion ? { duration: 0 } : { delay: 0.7 }}
                    style={{
                      position: 'relative',
                      margin: '12px auto 0',
                      maxWidth: '100%',
                      width: 'fit-content',
                      background: 'linear-gradient(135deg, #1A1A1A 0%, #050505 100%)',
                      border: `1px solid ${dadoConfig?.shadow || 'var(--gold)'}`,
                      boxShadow: `0 5px 15px rgba(0,0,0,0.9), 0 0 10px ${dadoConfig?.shadow || 'rgba(212,175,55,0.5)'}`,
                      padding: '8px 12px',
                      borderRadius: 20,
                      fontSize: 14,
                      fontWeight: 800,
                      color: 'var(--gold)',
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                      letterSpacing: 1,
                      zIndex: 3,
                    }}
                  >
                    {dadoConfig?.nombre || "MASCOTA DESCONOCIDA"}
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div style={{
              fontSize: 'clamp(16px, 2.5vw, 24px)',
              fontWeight: 900,
              color: 'var(--gold-light)',
              textTransform: 'uppercase',
              letterSpacing: 3,
              textShadow: '0 0 20px rgba(212,175,55,0.6)',
              fontFamily: "'Playfair Display', serif",
              marginBottom: 8,
            }}>{resultado.ganador.nombres}</div>

            <div style={{ fontSize: 13, color: 'var(--white-muted)', marginBottom: 20, fontFamily: "'Courier New', monospace", letterSpacing: 2 }}>
              DADO: {DICE_FACES[resultado.ganador.valor as number] || "🎲"}{' '}
              <span style={{ color: 'var(--gold)', fontWeight: 800 }}>{resultado.ganador.valor === 6 ? "SALVAJE" : resultado.ganador.valor}</span>
              {resultado.ganador.valor === 6 && (
                <span style={{ color: '#FF3B3B', marginLeft: 8, animation: 'strobeFlash 0.5s infinite', fontWeight: 900 }}>🔥 CRÍTICO</span>
              )}
            </div>

            {/* Prize */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, letterSpacing: 4, color: 'var(--white-muted)', marginBottom: 4, fontFamily: "'Courier New', monospace" }}>RECOMPENSA</div>
              <div style={{
                fontSize: 'clamp(32px, 5vw, 48px)',
                fontWeight: 900,
                color: 'var(--neon-green)',
                textShadow: '0 0 30px rgba(0,255,149,0.6), 0 0 60px rgba(0,255,149,0.3)',
                fontFamily: "'Playfair Display', serif",
                lineHeight: 1,
              }}>{formatSoles(resultado.premio)}</div>
            </div>

            {resultado.puntosGanados && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                marginTop: 16, padding: '6px 20px',
                background: 'rgba(212,175,55,0.08)',
                border: '1px solid rgba(212,175,55,0.25)',
                borderRadius: 4,
                fontFamily: "'Courier New', monospace",
                fontSize: 12, color: 'var(--gold)', letterSpacing: 2,
              }}>
                ⭐ +{resultado.puntosGanados} PTS &nbsp;·&nbsp; TOTAL: {resultado.puntosTotal}
              </div>
            )}
            {(resultado.rachaActual || 0) > 1 && (
              <div style={{ fontSize: 14, marginTop: 12, color: '#FF6B35', fontWeight: 800, letterSpacing: 2 }}>
                🔥 RACHA DE {resultado.rachaActual} VICTORIAS
              </div>
            )}
          </div>

          {/* Near Miss */}
          {resultado.nearMisses && resultado.nearMisses.length > 0 && (
            <div style={{
              padding: '12px 16px', borderRadius: 8,
              border: '1px solid rgba(255,59,59,0.25)',
              background: 'rgba(255,59,59,0.06)',
              marginBottom: 20, textAlign: 'center',
            }}>
              <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: 3, color: '#FF6B6B' }}>😱 ¡POR UN PELO!</div>
              <div style={{ fontSize: 11, color: 'var(--white-muted)', marginTop: 4 }}>
                {resultado.nearMisses.join(', ')} {resultado.nearMisses.length === 1 ? 'estuvo' : 'estuvieron'} a un punto de ganar.
              </div>
            </div>
          )}

          {/* Results Table */}
          <p style={{fontSize:12,opacity:0.7}}>Última tirada de cada jugador{resultado.rondas.length > 1 ? " (en rondas distintas)" : ""}.</p>
          <table className="results-table" tabIndex={0} aria-label="Última tirada de cada jugador" style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th style={{ fontFamily: "'Courier New', monospace", letterSpacing: 2, fontSize: 9 }}>POS</th>
                <th style={{ fontFamily: "'Courier New', monospace", letterSpacing: 2, fontSize: 9 }}>JUGADOR</th>
                <th style={{ fontFamily: "'Courier New', monospace", letterSpacing: 2, fontSize: 9 }}>DADO</th>
                <th style={{ fontFamily: "'Courier New', monospace", letterSpacing: 2, fontSize: 9 }}>ESTADO</th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((r) => (
                  <tr
                    key={r.dni}
                    className={r.dni === resultado.ganador.dni ? "winner-row" : ""}
                  >
                    <td style={{ fontFamily: "'Courier New', monospace" }}>{r.dni === resultado.ganador.dni ? "★" : "·"}</td>
                    <td style={{ fontWeight: r.dni === resultado.ganador.dni ? 800 : 500 }}>
                      {r.dni === resultado.ganador.dni && "👑 "}
                      {r.nombres}
                    </td>
                    <td>
                      <span className={`dice-value ${r.dni === resultado.ganador.dni ? "max" : ""}`}>
                        {r.valor}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: 0.5 }}>
                      {r.dni === resultado.ganador.dni ? (
                        <span style={{ color: 'var(--neon-green)' }}>GANADOR</span>
                      ) : (
                        <span style={{ color: '#e5e7eb' }}>DERROTA</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {resultado.rondas && resultado.rondas.length > 1 && (
            <div style={{
              marginBottom: 20, padding: '8px 16px',
              background: 'rgba(212,175,55,0.06)',
              border: '1px dashed rgba(212,175,55,0.25)',
              borderRadius: 6, textAlign: 'center',
              fontSize: 11, color: 'var(--gold-light)',
              fontWeight: 700, letterSpacing: 2,
              fontFamily: "'Courier New', monospace",
            }}>
              ⚡ VICTORIA POR DESEMPATE ({resultado.rondas.length - 1} RONDAS EXTRA)
              <details style={{marginTop:12,letterSpacing:0,textAlign:"left"}}><summary>Ver todas las tiradas</summary>{resultado.rondas.map((round,i)=><p key={i} style={{marginTop:10,lineHeight:1.8}}>Ronda {i+1}: {round.map(player=>`${player.nombres}: ${player.valor}`).join(" · ")}</p>)}</details>
            </div>
          )}

          <button
            className="btn btn-primary btn-lg btn-block"
            onClick={onNewGame}
            style={{
              padding: '18px',
              fontSize: '14px',
              letterSpacing: 4,
              fontFamily: "'Courier New', monospace",
              fontWeight: 900,
              background: 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.05) 100%)',
              border: '1px solid rgba(212,175,55,0.5)',
              clipPath: 'polygon(12px 0%, calc(100% - 12px) 0%, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0% calc(100% - 12px), 0% 12px)',
            }}
          >
            🔄 RECLAMAR Y NUEVA PARTIDA
          </button>
        </div>
      </div>

      {/* ===== LEVEL UP CELEBRATION ELITE 4.0 ===== */}
      {levelUp?.nombre && <LevelUpDialog levelUp={levelUp} onDismiss={onDismissLevelUp} />}
    </>
  );
}
