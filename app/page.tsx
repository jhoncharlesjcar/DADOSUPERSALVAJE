
"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import CinematicIntro from "./_components/CinematicIntro";

function subscribeToSession(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}
function readIntroSeen() {
  try { return sessionStorage.getItem("intro_seen") === "1"; }
  catch { return true; }
}

export default function ModeSelector() {
  const reduceMotion = useReducedMotion();
  const introSeen = useSyncExternalStore(subscribeToSession, readIntroSeen, () => true);
  const appRef = useRef<HTMLDivElement>(null);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let particles: typeof import("@/lib/particleSystem") | null = null;
    if (!reduceMotion) import("@/lib/particleSystem").then(mod => {
      if (cancelled) return;
      particles = mod;
      if (appRef.current) mod.startAmbientParticles(appRef.current);
    });
    return () => { cancelled = true; particles?.stopAmbientParticles(); };
  }, [reduceMotion]);

  function handleIntroComplete() {
    try { sessionStorage.setItem('intro_seen', '1'); } catch { /* Storage may be disabled. */ }
    setShowIntro(false);
  }

  return (
    <div
      className="app-container mode-selector"
      ref={appRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        backgroundImage: 'url(/arena_wide.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundAttachment: 'fixed',
        position: 'relative',
      }}
    >
      {showIntro && !introSeen && !reduceMotion && <CinematicIntro onComplete={handleIntroComplete} />}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,5,10,0.68)', zIndex: 0, pointerEvents: 'none' }} />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.8, ease: "easeOut" }}
        style={{ textAlign: 'center', width: '100%', marginBottom: 'clamp(24px, 6vw, 60px)', position: 'relative', zIndex: 1 }}
      >
        <div style={{ padding: 15, background: 'rgba(212,175,55,0.05)', borderRadius: '50%', display: 'inline-block', border: '1px solid rgba(212,175,55,0.2)', marginBottom: 20, boxShadow: '0 0 40px rgba(212,175,55,0.1)', width: 120, height: 120 }}>
          <Image src="/logo.webp" alt="Dado Salvaje" width={120} height={120} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
        </div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 'clamp(28px, 7vw, 56px)', fontWeight: 900, color: 'var(--gold)', letterSpacing: 'clamp(1px, 1vw, 8px)', overflowWrap: 'anywhere', textShadow: '0 0 30px var(--gold-glow-strong)' }}>DADO SALVAJE</h1>
        <p style={{ color: 'var(--white-dim)', letterSpacing: 6, marginTop: 12, fontSize: 13, fontWeight: 600 }}>LA ARENA DECIDE</p>
      </motion.div>

      <div className="mode-selector-options">
        <Link href="/lobby" style={{ textDecoration: 'none', minWidth: 0, width: '100%' }}>
          <motion.div
            className="card"
            style={{ width: '100%', padding: 'clamp(24px, 5vw, 40px) clamp(16px, 4vw, 30px)', textAlign: 'center', cursor: 'pointer', border: '2px solid rgba(0, 214, 143, 0.4)' }}
            whileHover={reduceMotion ? undefined : { scale: 1.03, boxShadow: '0 0 50px rgba(0, 214, 143, 0.3)', borderColor: 'var(--neon-green)' }}
          >
            <div style={{ fontSize: 70, marginBottom: 20 }}>🌐</div>
            <h2 style={{ color: 'var(--neon-green)', fontFamily: 'Playfair Display, serif', fontSize: 32, letterSpacing: 2, marginBottom: 10 }}>MODO ONLINE</h2>
            <p style={{ color: 'var(--white-dim)', fontSize: 13 }}>Compite en duelos y batallas con saldo en soles, progreso e historial persistente.</p>
            <div className="btn" style={{ background: 'linear-gradient(135deg, rgba(0, 214, 143, 0.2), transparent)', color: 'var(--neon-green)', border: '1px solid var(--neon-green)', width: '100%', padding: '16px', marginTop: 30, letterSpacing: 3, fontWeight: 800 }}>
              JUGAR AHORA
            </div>
          </motion.div>
        </Link>

        <Link href="/manual" style={{ textDecoration: 'none', minWidth: 0, width: '100%' }}>
          <motion.div
            className="card"
            style={{ width: '100%', padding: 'clamp(24px, 5vw, 40px) clamp(16px, 4vw, 30px)', textAlign: 'center', cursor: 'pointer' }}
            whileHover={reduceMotion ? undefined : { scale: 1.03 }}
          >
            <div style={{ fontSize: 70, marginBottom: 20 }}>🎙️</div>
            <h2 style={{ color: 'var(--gold)', fontFamily: 'Playfair Display, serif', fontSize: 32, letterSpacing: 2, marginBottom: 10 }}>MODO MANUAL</h2>
            <p style={{ color: 'var(--white-dim)', fontSize: 13 }}>Consola protegida para operar partidas presenciales y transmisiones.</p>
            <div className="btn" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.1), transparent)', border: '1px solid var(--gold)', color: 'var(--gold)', width: '100%', padding: '16px', marginTop: 30, letterSpacing: 3, fontWeight: 800 }}>
              ENTRAR COMO OPERADOR
            </div>
          </motion.div>
        </Link>
      </div>
    </div>
  );
}
