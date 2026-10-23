"use client";

/**
 * DADO SALVAJE — WinnerReveal
 * Pantalla épica de revelación de ganador con mascot del personaje
 */

import { useEffect, useState } from "react";
import { formatSoles } from "@/lib/currency";
import MascotCelebration from "./MascotCelebration";
import { mascotModel } from "@/lib/mascots";

// ===== MASCOT CONFIG por dadoId =====
export const MASCOT_CONFIG: Record<string, {
  nombre: string;
  mascotImg: string | null;
  emoji: string;
  color: string;
  glow: string;
  bgGradient: string;
  effect: string;
  battleCry: string;
}> = {
  amarillo: {
    nombre: "Pato Salvaje",
    mascotImg: "/mascots/pato.webp",
    emoji: "🦆",
    color: "#FFD700",
    glow: "#FFD700",
    bgGradient: "radial-gradient(ellipse at 30% 50%, rgba(255,215,0,0.25) 0%, rgba(20,15,0,0.95) 60%)",
    effect: "lightning",
    battleCry: "¡QUAAACK SALVAJE!",
  },
  rosado: {
    nombre: "Pantera Rosada",
    mascotImg: "/mascots/pantera.webp",
    emoji: "🐆",
    color: "#FF66B2",
    glow: "#FF66B2",
    bgGradient: "radial-gradient(ellipse at 30% 50%, rgba(255,102,178,0.3) 0%, rgba(15,0,10,0.95) 60%)",
    effect: "neon_wave",
    battleCry: "¡LA PANTERA DOMINA!",
  },
  rojo: {
    nombre: "Demonio Salvaje",
    mascotImg: "/mascots/demonio.webp",
    emoji: "😈",
    color: "#FF3B3B",
    glow: "#FF3B3B",
    bgGradient: "radial-gradient(ellipse at 30% 50%, rgba(255,59,59,0.3) 0%, rgba(20,0,0,0.95) 60%)",
    effect: "fire",
    battleCry: "¡EL INFIERNO DESATA!",
  },
  celeste: {
    nombre: "Titán del Océano",
    mascotImg: "/mascots/oceano.webp",
    emoji: "🌊",
    color: "#00BFFF",
    glow: "#00BFFF",
    bgGradient: "radial-gradient(ellipse at 30% 50%, rgba(0,191,255,0.25) 0%, rgba(0,5,20,0.95) 60%)",
    effect: "wave",
    battleCry: "¡EL OCÉANO RECLAMA!",
  },
  blanco: {
    nombre: "La Fantasma",
    mascotImg: "/mascots/fantasma.webp",
    emoji: "👻",
    color: "#FFFFFF",
    glow: "#FFFFFF",
    bgGradient: "radial-gradient(ellipse at 30% 50%, rgba(255,255,255,0.15) 0%, rgba(5,5,15,0.95) 60%)",
    effect: "ghost",
    battleCry: "¡BOO... VICTORIA!",
  },
  negro: {
    nombre: "La Sombra",
    mascotImg: "/mascots/sombra.webp",
    emoji: "🌑",
    color: "#9B59B6",
    glow: "#6B00FF",
    bgGradient: "radial-gradient(ellipse at 30% 50%, rgba(107,0,255,0.3) 0%, rgba(3,0,10,0.98) 60%)",
    effect: "vortex",
    battleCry: "¡LA OSCURIDAD REINA!",
  },
  verde: {
    nombre: "El Rey Salvaje",
    mascotImg: "/mascots/rey_salvaje.webp",
    emoji: "🐆",
    color: "#00E676",
    glow: "#00E676",
    bgGradient: "radial-gradient(ellipse at 30% 50%, rgba(0,230,118,0.25) 0%, rgba(0,10,5,0.95) 60%)",
    effect: "jungle",
    battleCry: "¡EL REY HA HABLADO!",
  },
  guinda: {
    nombre: "Emperador del Viento",
    mascotImg: "/mascots/emperador_viento.webp",
    emoji: "🌪️",
    color: "#A80038",
    glow: "#A80038",
    bgGradient: "radial-gradient(ellipse at 30% 50%, rgba(168,0,56,0.3) 0%, rgba(10,0,5,0.95) 60%)",
    effect: "wind",
    battleCry: "¡EL VIENTO DECIDE!",
  },
  naranja: {
    nombre: "Bestia de Fuego",
    mascotImg: "/mascots/bestia_fuego.webp",
    emoji: "🔥",
    color: "#FF9100",
    glow: "#FF9100",
    bgGradient: "radial-gradient(ellipse at 30% 50%, rgba(255,145,0,0.3) 0%, rgba(15,5,0,0.95) 60%)",
    effect: "explosion",
    battleCry: "¡BOOM SALVAJE!",
  },
  azul: {
    nombre: "El Poseidón",
    mascotImg: "/mascots/poseidon.webp",
    emoji: "🔱",
    color: "#2962FF",
    glow: "#2962FF",
    bgGradient: "radial-gradient(ellipse at 30% 50%, rgba(41,98,255,0.3) 0%, rgba(0,0,15,0.95) 60%)",
    effect: "lightning",
    battleCry: "¡POSEIDÓN TRUENA!",
  },
};

interface WinnerRevealProps {
  dadoId: string;
  playerName: string;
  valor: number;
  prize: number;
  diceImg: string;
  points?: number;
  streak?: number;
  onDismiss: () => void;
}

const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

// Pre-computed particle values (module-level = runs once at import, outside render)
const PARTICLES = Array.from({ length: 20 }, () => ({
  w: 3 + Math.random() * 4,
  h: 3 + Math.random() * 4,
  x: Math.random() * 100,
  y: Math.random() * 100,
  op: 0.4 + Math.random() * 0.4,
  dur: 2 + Math.random() * 3,
  delay: Math.random() * 2,
}));

export default function WinnerReveal({
  dadoId,
  playerName,
  valor,
  prize,
  diceImg,
  points,
  streak,
  onDismiss,
}: WinnerRevealProps) {
  const [visible, setVisible] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const config = MASCOT_CONFIG[dadoId] || MASCOT_CONFIG.rojo;

  useEffect(() => {
    // Stagger entrance
    const t1 = setTimeout(() => setVisible(true), 50);
    const t2 = setTimeout(() => setShowStats(true), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const isSalvaje = valor === 6;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: config.bgGradient,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        overflow: "hidden",
      }}
      onClick={onDismiss}
    >
      {/* Animated background particles - CSS only */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {PARTICLES.map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: p.w,
              height: p.h,
              borderRadius: "50%",
              background: config.glow,
              left: `${p.x}%`,
              top: `${p.y}%`,
              opacity: p.op,
              animation: `float ${p.dur}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
              boxShadow: `0 0 8px ${config.glow}`,
            }}
          />
        ))}
        {/* Huge glow orb */}
        <div style={{
          position: "absolute",
          left: "10%", top: "5%",
          width: 500, height: 600,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${config.glow}20 0%, transparent 70%)`,
          filter: "blur(40px)",
          animation: "energyPulse 2s ease-in-out infinite",
        }} />
      </div>

      {/* Cinematic bar top */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 40, background: "#000", zIndex: 2 }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, background: "#000", zIndex: 2 }} />

      {/* Main layout */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "clamp(20px, 5vw, 80px)",
        width: "100%",
        maxWidth: 1100,
        padding: "0 40px",
        position: "relative", zIndex: 1,
        flexWrap: "wrap",
      }}>

        {/* LEFT: Mascot */}
        <div style={{
          flex: "0 0 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateX(0) scale(1)" : "translateX(-120px) scale(0.7)",
          transition: "all 0.8s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          {/* Character image or big emoji */}
          <div style={{
            position: "relative",
            marginBottom: 16,
          }}>
            {mascotModel(dadoId) ? (
              <div style={{ width: "clamp(220px, 35vw, 400px)" }}><MascotCelebration key={dadoId} dadoId={dadoId} /></div>
            ) : config.mascotImg ? (
              <img
                src={config.mascotImg}
                alt={config.nombre}
                style={{
                  width: "clamp(160px, 25vw, 320px)",
                  height: "clamp(200px, 30vw, 420px)",
                  objectFit: "cover",
                  objectPosition: "center top",
                  borderRadius: 8,
                  filter: `drop-shadow(0 0 40px ${config.glow}) drop-shadow(0 0 80px ${config.glow}50)`,
                  animation: "winExplosion 0.6s cubic-bezier(0.34,1.56,0.64,1)",
                }}
              />
            ) : (
              <div style={{
                width: "clamp(140px, 20vw, 240px)",
                height: "clamp(140px, 20vw, 240px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "clamp(80px, 12vw, 160px)",
                filter: `drop-shadow(0 0 30px ${config.glow})`,
                animation: "float 2s ease-in-out infinite",
              }}>
                {config.emoji}
              </div>
            )}

            {/* Dice in hand */}
            <div style={{
              position: "absolute",
              bottom: -10,
              right: -10,
              animation: isSalvaje ? "winnerPulse 0.8s infinite" : "energyPulse 1.5s infinite",
            }}>
              <img
                src={diceImg}
                alt="dado"
                style={{
                  width: 80, height: 80,
                  objectFit: "contain",
                  filter: `drop-shadow(0 0 20px ${config.glow}) drop-shadow(0 0 40px ${config.glow})`,
                }}
              />
              {isSalvaje && (
                <div style={{
                  position: "absolute", top: -8, right: -8,
                  background: "#FF3B3B",
                  color: "#FFF",
                  fontSize: 9, fontWeight: 900,
                  letterSpacing: 1,
                  padding: "2px 6px",
                  borderRadius: 2,
                  fontFamily: "'Courier New', monospace",
                  animation: "strobeFlash 0.5s infinite",
                }}>SALVAJE</div>
              )}
            </div>
          </div>

          {/* Battle cry */}
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(11px, 1.8vw, 16px)",
            color: config.color,
            letterSpacing: 3,
            textAlign: "center",
            fontWeight: 900,
            textShadow: `0 0 20px ${config.glow}`,
            textTransform: "uppercase",
            animation: "goldPulse 1.5s ease-in-out infinite",
          }}>
            {config.battleCry}
          </div>
        </div>

        {/* RIGHT: Stats panel */}
        <div style={{
          flex: "1 1 280px",
          maxWidth: 480,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateX(0)" : "translateX(120px)",
          transition: "all 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.15s",
        }}>

          {/* Character name */}
          <div style={{
            fontSize: "clamp(10px, 1.2vw, 12px)",
            letterSpacing: 5,
            color: "rgba(255,255,255,0.4)",
            fontFamily: "'Courier New', monospace",
            marginBottom: 6,
            textTransform: "uppercase",
          }}>
            {config.nombre}
          </div>

          {/* Player name */}
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(28px, 5vw, 64px)",
            fontWeight: 900,
            color: config.color,
            textShadow: `0 0 30px ${config.glow}80, 0 0 60px ${config.glow}40`,
            lineHeight: 1.1,
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: 2,
          }}>
            {playerName}
          </div>

          {/* Separator */}
          <div style={{
            width: showStats ? "100%" : 0,
            height: 1,
            background: `linear-gradient(90deg, ${config.glow}, transparent)`,
            transition: "width 0.8s ease",
            marginBottom: 24,
          }} />

          {/* Stats grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            opacity: showStats ? 1 : 0,
            transform: showStats ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.5s ease 0.4s",
          }}>
            {/* Dice value */}
            <StatBox
              label="DADO"
              value={valor === 6 ? "🔥 SALVAJE" : `${DICE_FACES[valor]} ${valor}`}
              glow={isSalvaje ? "#FF3B3B" : config.glow}
              big
            />
            {/* Prize */}
            <StatBox
              label="PREMIO"
              value={formatSoles(prize)}
              glow="#00E676"
              big
            />
            {points !== undefined && (
              <StatBox label="PUNTOS GANADOS" value={`+${points} PTS`} glow={config.glow} />
            )}
            {streak !== undefined && streak > 1 && (
              <StatBox label="RACHA" value={`🔥 ${streak} VICTORIAS`} glow="#FF6B35" />
            )}
          </div>

          {/* SALVAJE special effect */}
          {isSalvaje && (
            <div style={{
              marginTop: 20,
              padding: "10px 20px",
              background: "rgba(255,59,59,0.1)",
              border: "1px solid rgba(255,59,59,0.5)",
              borderRadius: 4,
              textAlign: "center",
              fontFamily: "'Courier New', monospace",
              fontSize: 11,
              letterSpacing: 3,
              color: "#FF3B3B",
              animation: "strobeFlash 0.8s infinite",
              fontWeight: 900,
              opacity: showStats ? 1 : 0,
              transition: "opacity 0.4s ease 0.8s",
            }}>
              ⚡ DADO CRÍTICO — MÁXIMO PODER ⚡
            </div>
          )}

          {/* Dismiss hint */}
          <div style={{
            marginTop: 32,
            fontSize: 9,
            letterSpacing: 4,
            color: "rgba(255,255,255,0.15)",
            fontFamily: "'Courier New', monospace",
            opacity: showStats ? 1 : 0,
            transition: "opacity 0.4s ease 1.2s",
          }}>
            CLICK PARA CONTINUAR ▶
          </div>
        </div>
      </div>

      {/* Effect overlay specific to dice type */}
      <EffectOverlay effect={config.effect} color={config.glow} />
    </div>
  );
}

function StatBox({ label, value, glow, big = false }: { label: string; value: string; glow: string; big?: boolean }) {
  return (
    <div style={{
      background: "rgba(0,0,0,0.5)",
      border: `1px solid ${glow}30`,
      borderRadius: 6,
      padding: big ? "16px 12px" : "12px",
      backdropFilter: "blur(10px)",
    }}>
      <div style={{
        fontSize: 8, letterSpacing: 3, color: "rgba(255,255,255,0.3)",
        fontFamily: "'Courier New', monospace", marginBottom: 4, textTransform: "uppercase",
      }}>
        {label}
      </div>
      <div style={{
        fontSize: big ? "clamp(16px, 2.5vw, 24px)" : "clamp(13px, 2vw, 18px)",
        fontWeight: 900,
        color: glow,
        textShadow: `0 0 15px ${glow}80`,
        fontFamily: big ? "'Playfair Display', serif" : "'Courier New', monospace",
        letterSpacing: 1,
      }}>
        {value}
      </div>
    </div>
  );
}

// Per-dice special visual effect
function EffectOverlay({ effect, color }: { effect: string; color: string }) {
  if (effect === "lightning") {
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${10 + i * 15}%`,
            top: 0, bottom: 0,
            width: 1,
            background: `linear-gradient(180deg, transparent 0%, ${color}80 40%, ${color} 50%, ${color}80 60%, transparent 100%)`,
            animation: `hudBlink ${0.3 + i * 0.1}s ease-in-out infinite`,
            animationDelay: `${i * 0.07}s`,
            opacity: 0.3,
          }} />
        ))}
      </div>
    );
  }
  if (effect === "fire") {
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: "40%",
          background: `linear-gradient(0deg, ${color}30 0%, transparent 100%)`,
          animation: "energyPulse 1s ease-in-out infinite",
        }} />
      </div>
    );
  }
  if (effect === "neon_wave") {
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: 0, right: 0,
            top: `${20 + i * 20}%`,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
            animation: `scanline ${1 + i * 0.3}s linear infinite`,
            animationDelay: `${i * 0.2}s`,
          }} />
        ))}
      </div>
    );
  }
  if (effect === "ghost") {
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 70%)",
          animation: "energyPulse 3s ease-in-out infinite",
        }} />
      </div>
    );
  }
  return null;
}
