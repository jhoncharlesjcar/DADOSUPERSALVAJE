
"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import CinematicIntro from "./_components/CinematicIntro";

export default function ModeSelector() {
  const appRef = useRef<HTMLDivElement>(null);
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    let particles: typeof import("@/lib/particleSystem") | null = null;
    const seen = sessionStorage.getItem('intro_seen');
    if (seen) setShowIntro(false);
    import("@/lib/particleSystem").then(mod => {
      particles = mod;
      if (appRef.current) mod.startAmbientParticles(appRef.current);
    });
    return () => particles?.stopAmbientParticles();
  }, []);

  function handleIntroComplete() {
    sessionStorage.setItem('intro_seen', '1');
    setShowIntro(false);
  }

  return (
    <div
      className="app-container"
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
      {showIntro && <CinematicIntro onComplete={handleIntroComplete} />}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,5,10,0.68)', zIndex: 0, pointerEvents: 'none' }} />

      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ textAlign: 'center', marginBottom: 60, position: 'relative', zIndex: 1 }}
      >
        <div style={{ padding: 15, background: 'rgba(212,175,55,0.05)', borderRadius: '50%', display: 'inline-block', border: '1px solid rgba(212,175,55,0.2)', marginBottom: 20, boxShadow: '0 0 40px rgba(212,175,55,0.1)', width: 120, height: 120 }}>
          <Image src="/logo.webp" alt="Dado Salvaje" width={120} height={120} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
        </div>
        <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 56, fontWeight: 900, color: 'var(--gold)', letterSpacing: 8, textShadow: '0 0 30px var(--gold-glow-strong)' }}>DADO SALVAJE</h1>
        <p style={{ color: 'var(--white-dim)', letterSpacing: 6, marginTop: 12, fontSize: 13, fontWeight: 600 }}>LA ARENA DECIDE</p>
      </motion.div>

      <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <Link href="/lobby" style={{ textDecoration: 'none' }}>
          <motion.div
            className="card"
            style={{ width: 340, padding: '40px 30px', textAlign: 'center', cursor: 'pointer', border: '2px solid rgba(0, 214, 143, 0.4)' }}
            whileHover={{ scale: 1.05, boxShadow: '0 0 50px rgba(0, 214, 143, 0.3)', borderColor: 'var(--neon-green)' }}
          >
            <div style={{ fontSize: 70, marginBottom: 20 }}>🌐</div>
            <h2 style={{ color: 'var(--neon-green)', fontFamily: 'Playfair Display, serif', fontSize: 32, letterSpacing: 2, marginBottom: 10 }}>MODO ONLINE</h2>
            <p style={{ color: 'var(--white-dim)', fontSize: 13 }}>Compite en duelos y batallas con saldo en soles, progreso e historial persistente.</p>
            <div className="btn" style={{ background: 'linear-gradient(135deg, rgba(0, 214, 143, 0.2), transparent)', color: 'var(--neon-green)', border: '1px solid var(--neon-green)', width: '100%', padding: '16px', marginTop: 30, letterSpacing: 3, fontWeight: 800 }}>
              JUGAR AHORA
            </div>
          </motion.div>
        </Link>

        <Link href="/manual" style={{ textDecoration: 'none' }}>
          <motion.div
            className="card"
            style={{ width: 340, padding: '40px 30px', textAlign: 'center', cursor: 'pointer' }}
            whileHover={{ scale: 1.05 }}
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
