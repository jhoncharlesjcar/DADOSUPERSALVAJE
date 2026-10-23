"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { formatSoles } from "@/lib/currency";

export default function WalletCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const [wallet, setWallet] = useState<any>(null);
  const [failedAt, setFailedAt] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/wallet", { cache: "no-store" })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "No se pudo cargar la billetera");
        return data;
      })
      .then(data => setWallet(data))
      .catch(() => setFailedAt(refreshKey));
  }, [refreshKey]);

  if (failedAt === refreshKey) return <div className="card" role="alert" style={{ color: '#ffd4d6', padding: 20 }}>No pudimos cargar tu saldo. Actualiza la página para reintentar.</div>;
  if (!wallet) return <div style={{ color: 'var(--gold)', padding: 20 }}>Cargando saldo...</div>;

  return (
    <motion.div 
      className="card"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      style={{ overflow: 'visible' }}
    >
      <div className="card-header" style={{ background: 'linear-gradient(90deg, rgba(0, 214, 143, 0.1), transparent)'}}>
        <h3 className="card-title" style={{ color: 'var(--neon-green)', textShadow: '0 0 10px rgba(0,214,143,0.4)' }}>SALDO DE JUEGO</h3>
      </div>
      <div className="card-body">
        <div style={{ marginBottom: 25, position: 'relative' }}>
          <div style={{ fontSize: 10, color: 'var(--white-dim)', letterSpacing: 2 }}>SALDO DISPONIBLE</div>
          <div style={{ fontSize: 42, color: 'var(--neon-green)', fontFamily: 'Playfair Display, serif', fontWeight: 900, textShadow: '0 0 20px rgba(0,214,143,0.3)', marginTop: 5 }}>
            {formatSoles(wallet.creditos || 0)}
          </div>
          <motion.div 
            style={{ position: 'absolute', top: -10, right: -10, width: 60, height: 60, background: 'var(--neon-green)', filter: 'blur(40px)', zIndex: -1, opacity: 0.4 }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </div>
        
        <div style={{ padding: 18, background: 'rgba(0,0,0,0.6)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--white-dim)', fontWeight: 500 }}>Moneda In-Game:</span>
            <span style={{ color: 'var(--gold)', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              {wallet.gemas || 0} <span style={{ fontSize: 12, filter: 'drop-shadow(0 0 4px var(--gold))' }}>💎</span>
            </span>
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--white-dim)', fontWeight: 500 }}>Bono Congelado:</span>
            <span style={{ color: 'var(--white-soft)', fontWeight: 600, fontSize: 14 }}>{formatSoles(wallet.creditos_bono || 0)}</span>
          </div>
        </div>

        <p style={{ marginTop: 18, color: 'var(--white-muted)', fontSize: 11, lineHeight: 1.5 }}>
          Saldo disponible para participar en las salas de Dado Salvaje.
        </p>
      </div>
    </motion.div>
  );
}
