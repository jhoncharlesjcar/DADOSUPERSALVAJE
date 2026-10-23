"use client";

import { useState, useEffect, useRef } from "react";

interface CinematicIntroProps {
  onComplete: () => void;
}

// ====== DADOS disponibles (imagen + color glow) ======
const DICE_INTRO = [
  { src: "/dados/rojo.webp",    glow: "#FF3B3B", x: 18, y: 55, rot: -25, delay: 0.0 },
  { src: "/dados/azul.webp",    glow: "#2962FF", x: 30, y: 60, rot: 15,  delay: 0.08 },
  { src: "/dados/negro.webp",   glow: "#8B00FF", x: 43, y: 58, rot: 5,   delay: 0.16 },
  { src: "/dados/blanco.webp",  glow: "#FFFFFF", x: 55, y: 62, rot: -10, delay: 0.24 },
  { src: "/dados/verde.webp",   glow: "#00E676", x: 67, y: 56, rot: 20,  delay: 0.32 },
  { src: "/dados/amarillo.webp",glow: "#FFD700", x: 78, y: 60, rot: -30, delay: 0.40 },
  { src: "/dados/rosado.webp",  glow: "#FF66B2", x: 24, y: 72, rot: 35,  delay: 0.48 },
  { src: "/dados/guinda.webp",  glow: "#A80038", x: 36, y: 68, rot: -18, delay: 0.56 },
  { src: "/dados/naranja.webp", glow: "#FF9100", x: 62, y: 70, rot: 12,  delay: 0.64 },
  { src: "/dados/celeste.webp", glow: "#00BFFF", x: 73, y: 66, rot: -22, delay: 0.72 },
];

// The winning dice (center, prominent)
const WINNER_DICE = { src: "/dados/rojo.webp", glow: "#FF3B3B" };

type Scene = "black" | "arena" | "cup_entry" | "cup_shake" | "dice_roll" | "dice_land" | "winner" | "title" | "flash" | "done";

export default function CinematicIntro({ onComplete }: CinematicIntroProps) {
  const [scene, setScene] = useState<Scene>("black");
  const [skipped, setSkipped] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    if (skipped) { onComplete(); return; }

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    audioCtxRef.current = ctx;

    runSequence(ctx);
    startParticles();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      ctx.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipped]);

  async function runSequence(ctx: AudioContext) {
    // SCENE 1 — Arena fade in
    await sleep(300);
    setScene("arena");
    playDeepBoom(ctx);
    await sleep(2000);

    // SCENE 2 — Cup entry
    setScene("cup_entry");
    playSwoosh(ctx);
    await sleep(1800);

    // SCENE 3 — Cup shake
    setScene("cup_shake");
    playShake(ctx);
    await sleep(1400);

    // SCENE 4 — Dice roll
    setScene("dice_roll");
    playRoll(ctx);
    await sleep(2200);

    // SCENE 5 — Dice land
    setScene("dice_land");
    playImpact(ctx);
    await sleep(1200);

    // SCENE 6 — Winner reveal
    setScene("winner");
    playWinner(ctx);
    await sleep(2000);

    // SCENE 7 — Title
    setScene("title");
    playFanfare(ctx);
    await sleep(2400);

    // SCENE 8 — Flash
    setScene("flash");
    await sleep(300);

    setScene("done");
    onComplete();
  }

  // ===== CANVAS PARTICLES =====
  type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number; };

  function startParticles() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#D4AF37", "#F5E6A3", "#D4AF37", "#FF3B3B", "#2962FF", "#00E676", "#FF66B2", "#FF9100", "#00BFFF"];

    function spawnParticle() {
      const color = colors[Math.floor(Math.random() * colors.length)];
      particlesRef.current.push({
        x: Math.random() * canvas!.width,
        y: canvas!.height + 10,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -(Math.random() * 2 + 0.5),
        life: 0,
        maxLife: 80 + Math.random() * 120,
        color,
        size: Math.random() * 3 + 1,
      });
    }

    let frameCount = 0;
    function loop() {
      frameCount++;
      ctx2d!.clearRect(0, 0, canvas!.width, canvas!.height);

      if (frameCount % 3 === 0) spawnParticle();

      particlesRef.current = particlesRef.current.filter(p => p.life < p.maxLife);
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        const alpha = 1 - p.life / p.maxLife;
        ctx2d!.save();
        ctx2d!.globalAlpha = alpha * 0.7;
        ctx2d!.fillStyle = p.color;
        ctx2d!.shadowColor = p.color;
        ctx2d!.shadowBlur = 8;
        ctx2d!.beginPath();
        ctx2d!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx2d!.fill();
        ctx2d!.restore();
      }

      animFrameRef.current = requestAnimationFrame(loop);
    }
    loop();
  }

  // ===== AUDIO SYNTHESIS =====
  function playDeepBoom(ctx: AudioContext) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine"; osc.frequency.setValueAtTime(50, t); osc.frequency.exponentialRampToValueAtTime(20, t + 2);
    g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(0.7, t + 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
    osc.connect(g); g.connect(ctx.destination); osc.start(t); osc.stop(t + 2.5);

    // Riser
    const riser = ctx.createOscillator(); const gr = ctx.createGain();
    riser.type = "sawtooth"; riser.frequency.setValueAtTime(60, t + 0.5); riser.frequency.exponentialRampToValueAtTime(1200, t + 2.5);
    gr.gain.setValueAtTime(0.001, t + 0.5); gr.gain.linearRampToValueAtTime(0.04, t + 2.2); gr.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(200, t + 0.5); f.frequency.exponentialRampToValueAtTime(5000, t + 2.5);
    riser.connect(f); f.connect(gr); gr.connect(ctx.destination); riser.start(t + 0.5); riser.stop(t + 2.7);
  }

  function playSwoosh(ctx: AudioContext) {
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const fl = ctx.createBiquadFilter(); fl.type = "bandpass"; fl.frequency.setValueAtTime(3000, t); fl.frequency.exponentialRampToValueAtTime(200, t + 0.5);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    src.connect(fl); fl.connect(g); g.connect(ctx.destination); src.start(t);
  }

  function playShake(ctx: AudioContext) {
    for (let i = 0; i < 8; i++) {
      const t = ctx.currentTime + i * 0.15;
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / d.length);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const fl = ctx.createBiquadFilter(); fl.type = "bandpass";
      fl.frequency.value = 400 + Math.random() * 600;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.3 + i * 0.04, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      src.connect(fl); fl.connect(g); g.connect(ctx.destination); src.start(t);
    }
  }

  function playRoll(ctx: AudioContext) {
    for (let i = 0; i < 20; i++) {
      const t = ctx.currentTime + i * 0.1;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / d.length);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const fl = ctx.createBiquadFilter(); fl.type = "bandpass"; fl.frequency.value = 300 + Math.random() * 400;
      const g = ctx.createGain(); const vol = Math.min(0.08 + i * 0.012, 0.35);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      src.connect(fl); fl.connect(g); g.connect(ctx.destination); src.start(t);
    }
  }

  function playImpact(ctx: AudioContext) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = "sine"; osc.frequency.setValueAtTime(150, t); osc.frequency.exponentialRampToValueAtTime(30, t + 0.4);
    g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g); g.connect(ctx.destination); osc.start(t); osc.stop(t + 0.5);

    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.1), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.6, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(g2); g2.connect(ctx.destination); src.start(t);
  }

  function playWinner(ctx: AudioContext) {
    const t = ctx.currentTime;
    [261.63, 329.63, 392, 523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = freq;
      g.gain.setValueAtTime(0.001, t + i * 0.05);
      g.gain.linearRampToValueAtTime(0.12, t + i * 0.05 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.6);
      osc.connect(g); g.connect(ctx.destination); osc.start(t + i * 0.05); osc.stop(t + 1);
    });
  }

  function playFanfare(ctx: AudioContext) {
    const t = ctx.currentTime;
    const melody = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1046.50, 1318.51, 2093.00];
    melody.forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = i > 4 ? "triangle" : "sine"; osc.frequency.value = freq;
      const start = t + i * 0.12;
      g.gain.setValueAtTime(0.001, start);
      g.gain.linearRampToValueAtTime(0.14, start + 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.connect(g); g.connect(ctx.destination); osc.start(start); osc.stop(start + 0.5);
    });
    // Deep boom
    const boom = ctx.createOscillator(); const gb = ctx.createGain();
    boom.type = "sine"; boom.frequency.setValueAtTime(80, t); boom.frequency.exponentialRampToValueAtTime(30, t + 1);
    gb.gain.setValueAtTime(0.5, t); gb.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    boom.connect(gb); gb.connect(ctx.destination); boom.start(t); boom.stop(t + 1.2);
  }

  if (scene === "done") return null;

  const isArena = !["black"].includes(scene);
  const isCupVisible = ["cup_entry","cup_shake","dice_roll"].includes(scene);
  const isDiceVisible = ["dice_roll","dice_land","winner","title"].includes(scene);
  const isWinner = ["winner","title"].includes(scene);
  const isTitleVisible = scene === "title";
  const isFlash = scene === "flash";

  return (
    <div
      onClick={() => { setSkipped(true); }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") setSkipped(true);
      }}
      role="button"
      tabIndex={0}
      aria-label="Saltar introducción"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: isFlash ? "white" : "black",
        overflow: "hidden", cursor: "pointer",
        transition: isFlash ? "background 0.05s" : "background 1s ease",
      }}
    >
      {/* Cinematic bars */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "clamp(36px, 7vh, 72px)", background: "#000", zIndex: 20 }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "clamp(36px, 7vh, 72px)", background: "#000", zIndex: 20 }} />

      {/* Particle canvas */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }} />

      {/* Arena background */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        backgroundImage: "url(/arena_interior.webp)",
        backgroundSize: "cover", backgroundPosition: "center",
        opacity: isArena ? 1 : 0,
        transition: "opacity 1.8s ease",
        filter: "brightness(0.5) contrast(1.2)",
      }} />
      {/* Cinematic scene image layer — 3 escenas AAA según fase */}
      {/* Escena: Lanzamiento de copa */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 3,
        backgroundImage: "url(/scene_pour.webp)",
        backgroundSize: "cover", backgroundPosition: "center",
        opacity: scene === "dice_roll" ? 1 : 0,
        transition: "opacity 0.7s ease",
        filter: "brightness(0.9)",
      }} />
      {/* Escena: Dados esparcidos */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 3,
        backgroundImage: "url(/scene_scattered.webp)",
        backgroundSize: "cover", backgroundPosition: "center",
        opacity: scene === "dice_land" ? 1 : 0,
        transition: "opacity 0.6s ease",
        filter: "brightness(0.9)",
      }} />
      {/* Escena: Ganador con explosión */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 3,
        backgroundImage: "url(/scene_winner.webp)",
        backgroundSize: "cover", backgroundPosition: "center",
        opacity: scene === "winner" ? 1 : scene === "title" ? 0.55 : 0,
        transition: "opacity 0.8s ease",
        filter: scene === "title" ? "brightness(0.4) saturate(0.5)" : "brightness(1)",
      }} />

      <div style={{
        position: "absolute", inset: 0, zIndex: 2,
        background: "radial-gradient(ellipse at 50% 60%, transparent 25%, rgba(0,0,0,0.9) 80%)",
        pointerEvents: "none",
      }} />

      {/* Golden energy lines */}
      {isArena && (
        <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none", overflow: "hidden" }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{
              position: "absolute",
              left: 0, right: 0,
              top: `${20 + i * 15}%`,
              height: 1,
              background: `linear-gradient(90deg, transparent 0%, rgba(212,175,55,${0.04 + i * 0.02}) 30%, rgba(212,175,55,${0.08 + i * 0.03}) 50%, rgba(212,175,55,${0.04 + i * 0.02}) 70%, transparent 100%)`,
              animation: `scanline ${3 + i * 0.7}s linear infinite`,
              animationDelay: `${i * 0.4}s`,
            }} />
          ))}
        </div>
      )}

      {/* ===== SCENE 2-3: DICE CUP ===== */}
      <div style={{
        position: "absolute", zIndex: 10,
        left: "50%", top: 0,
        transform: `translateX(-50%) translateY(${
          scene === "cup_entry" ? "10%" : scene === "cup_shake" ? "8%" : scene === "dice_roll" ? "-30%" : "-100%"
        }) rotate(${scene === "dice_roll" ? "-120deg" : "0deg"})`,
        opacity: isCupVisible ? 1 : 0,
        transition: scene === "cup_entry"
          ? "transform 1.2s cubic-bezier(0.34,1.2,0.64,1), opacity 0.5s ease"
          : scene === "dice_roll"
          ? "transform 0.5s ease-in, opacity 0.4s ease"
          : "transform 0.1s ease",
        animation: scene === "cup_shake" ? "shakeCup3D 0.22s infinite" : "none",
        width: 200,
      }}>
        <img
          src="/cup.webp"
          alt="Copa"
          style={{
            width: "100%",
            filter: scene === "cup_shake"
              ? "drop-shadow(0 0 40px rgba(212,175,55,1)) brightness(1.3)"
              : "drop-shadow(0 0 20px rgba(212,175,55,0.7))",
            transition: "filter 0.3s ease",
          }}
        />
      </div>

      {/* ===== SCENE 3-5: DICE ===== */}
      {isDiceVisible && (
        <div style={{ position: "absolute", inset: 0, zIndex: 8, pointerEvents: "none" }}>
          {DICE_INTRO.map((d, i) => {
            const isThisWinner = i === 0;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${d.x}%`,
                  top: `${d.y}%`,
                  transform: `rotate(${isWinner && isThisWinner ? 0 : d.rot}deg) scale(${isWinner && !isThisWinner ? 0.4 : isWinner && isThisWinner ? 1.5 : 1})`,
                  opacity: scene === "dice_roll"
                    ? (0.5 + i * 0.05)
                    : isWinner && !isThisWinner ? 0.08 : 1,
                  transition: `all ${0.6 + d.delay}s cubic-bezier(0.34,1.56,0.64,1)`,
                  transitionDelay: `${d.delay}s`,
                  zIndex: isWinner && isThisWinner ? 15 : 8,
                }}
              >
                {/* Dice glow halo */}
                <div style={{
                  position: "absolute", inset: -8,
                  borderRadius: 12,
                  background: `radial-gradient(ellipse, ${d.glow}40 0%, transparent 70%)`,
                  animation: isWinner && isThisWinner ? "energyPulse 0.8s ease-in-out infinite" : "none",
                  filter: `blur(4px)`,
                }} />
                <img
                  src={d.src}
                  alt="dado"
                  style={{
                    width: isWinner && isThisWinner ? 110 : 72,
                    height: isWinner && isThisWinner ? 110 : 72,
                    objectFit: "contain",
                    display: "block",
                    filter: isWinner && isThisWinner
                      ? `drop-shadow(0 0 30px ${d.glow}) drop-shadow(0 0 60px ${d.glow}) brightness(1.3)`
                      : `drop-shadow(0 0 8px ${d.glow}80) brightness(${scene === "dice_roll" ? 0.8 : 1})`,
                    transition: "all 0.8s ease",
                    animation: scene === "dice_roll" ? `diceRollAnim${i % 4} 0.3s linear infinite` : "none",
                  }}
                />
              </div>
            );
          })}

          {/* Winner aura burst */}
          {isWinner && (
            <div style={{
              position: "absolute",
              left: `${DICE_INTRO[0].x - 5}%`,
              top: `${DICE_INTRO[0].y - 10}%`,
              width: 200, height: 200,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${DICE_INTRO[0].glow}50 0%, transparent 70%)`,
              animation: "winnerPulse 1s ease-in-out infinite",
              zIndex: 7,
              pointerEvents: "none",
              filter: "blur(8px)",
            }} />
          )}
        </div>
      )}

      {/* ===== SCENE 5: TITLE REVEAL ===== */}
      <div style={{
        position: "absolute", zIndex: 15,
        inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        paddingBottom: "8vh",
        pointerEvents: "none",
      }}>
        {/* Logo */}
        <div style={{
          opacity: isTitleVisible ? 1 : 0,
          transform: isTitleVisible ? "scale(1) translateY(0)" : "scale(0.3) translateY(60px)",
          transition: "all 0.8s cubic-bezier(0.34,1.56,0.64,1)",
          marginBottom: 24,
        }}>
          <div style={{
            width: 100, height: 100, borderRadius: "50%", overflow: "hidden",
            border: "3px solid #D4AF37",
            boxShadow: "0 0 60px rgba(212,175,55,0.9), 0 0 120px rgba(212,175,55,0.5)",
          }}>
            <img src="/logo.webp" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>

        {/* Main title */}
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "clamp(36px, 7vw, 88px)",
          fontWeight: 900,
          color: "#D4AF37",
          letterSpacing: "clamp(6px, 2vw, 22px)",
          textShadow: "0 0 40px rgba(212,175,55,1), 0 0 80px rgba(212,175,55,0.6), 0 0 160px rgba(212,175,55,0.3)",
          opacity: isTitleVisible ? 1 : 0,
          transform: isTitleVisible ? "scaleX(1) translateY(0)" : "scaleX(0.5) translateY(40px)",
          transition: "all 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.1s",
          textTransform: "uppercase",
          textAlign: "center",
          lineHeight: 1,
          marginBottom: 12,
        }}>
          DADO SALVAJE
        </div>

        {/* Separator */}
        <div style={{
          width: isTitleVisible ? "min(500px, 60vw)" : 0,
          height: 1,
          background: "linear-gradient(90deg, transparent, #D4AF37, transparent)",
          transition: "width 0.8s ease 0.3s",
          marginBottom: 16,
        }} />

        {/* Subtitle */}
        <div style={{
          fontFamily: "'Courier New', monospace",
          color: "rgba(245,230,163,0.8)",
          letterSpacing: "clamp(3px, 1.5vw, 10px)",
          fontSize: "clamp(9px, 1.2vw, 13px)",
          fontWeight: 700,
          opacity: isTitleVisible ? 1 : 0,
          transition: "opacity 0.6s ease 0.5s",
          textAlign: "center",
          marginBottom: 32,
        }}>
          LA ARENA DECIDE
        </div>

        {/* CTA Buttons */}
        {isTitleVisible && (
        <div style={{
          display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center",
          opacity: 1,
          animation: "winExplosion 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.7s both",
        }}>
          {[
            { label: "🌐 MODO ONLINE",    color: "#00FF95", border: "#00FF95" },
            { label: "🎙️ MODO MANUAL",    color: "#D4AF37", border: "#D4AF37" },
            { label: "🏆 RANKING",         color: "#F5E6A3", border: "#D4AF37" },
          ].map((btn, i) => (
            <div
              key={i}
              style={{
                padding: "10px 28px",
                border: `1px solid ${btn.border}55`,
                borderRadius: 2,
                background: `rgba(0,0,0,0.6)`,
                color: btn.color,
                fontSize: 11,
                fontFamily: "'Courier New', monospace",
                letterSpacing: 3,
                fontWeight: 800,
                textTransform: "uppercase",
                boxShadow: `0 0 12px ${btn.border}30`,
                clipPath: "polygon(8px 0%, calc(100% - 8px) 0%, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0% calc(100% - 8px), 0% 8px)",
                animation: `winExplosion 0.4s ease ${0.8 + i * 0.1}s both`,
              }}
            >
              {btn.label}
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Skip tip */}
      <div style={{
        position: "absolute", bottom: "clamp(44px, 9vh, 88px)", right: 40, zIndex: 20,
        color: "rgba(255,255,255,0.2)", fontSize: 10,
        letterSpacing: 3, fontFamily: "'Courier New', monospace",
        opacity: isArena && !isTitleVisible ? 1 : 0,
        transition: "opacity 1s ease 1s",
      }}>
        CLICK PARA SALTAR ▶
      </div>

      {/* Scene label (console style) */}
      {isArena && !isTitleVisible && (
        <div style={{
          position: "absolute", top: "clamp(44px, 9vh, 88px)", left: 32, zIndex: 20,
          color: "rgba(212,175,55,0.3)", fontSize: 9,
          fontFamily: "'Courier New', monospace", letterSpacing: 3,
        }}>
          DADO SALVAJE™ · {new Date().getFullYear()}
        </div>
      )}

      <style>{`
        @keyframes diceRollAnim0 { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes diceRollAnim1 { 0%{transform:rotate(0deg)} 100%{transform:rotate(-360deg)} }
        @keyframes diceRollAnim2 { 0%{transform:rotate(0deg)} 100%{transform:rotate(540deg)} }
        @keyframes diceRollAnim3 { 0%{transform:rotate(0deg)} 100%{transform:rotate(-540deg)} }
      `}</style>
    </div>
  );
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
