"use client";

import { obtenerNivel, NIVELES } from "@/lib/cofres";
import { Player } from "@/types";

type RankedPlayer = Player & { rank?: number };

interface RankingPanelProps {
  ranking: RankedPlayer[];
}

export default function RankingPanel({ ranking }: RankingPanelProps) {
  return (
    <div className="ranking-panel">
      <div className="card" style={{ border: '1px solid var(--gold-glow)' }}>
        <div className="card-header">
          <div className="card-header-icon">🏆</div>
          <div className="card-title">HALL OF FAME</div>
        </div>
        <div className="card-body" style={{ padding: '15px' }}>
          {ranking.length === 0 ? (
            <div className="sala-empty">
              <div className="sala-empty-text">PREPARANDO TRONO...</div>
            </div>
          ) : (
            <div className="ranking-list" style={{ gap: '8px' }}>
              {ranking.slice(0, 10).map((r, i) => {
                const nivel = obtenerNivel(r.puntos);
                const winRate = (r.partidas_jugadas ?? 0) > 0
                  ? Math.round(((r.partidas_ganadas ?? 0) / (r.partidas_jugadas ?? 1)) * 100)
                  : 0;
                
                const isTop3 = i < 3;
                
                return (
                  <div 
                    className="ranking-item" 
                    key={r.dni || `rank-${r.rank ?? i}`}
                    style={{ 
                        background: isTop3 ? 'rgba(212, 175, 55, 0.08)' : 'var(--black-deep)',
                        border: isTop3 ? '1px solid var(--gold-glow)' : '1px solid var(--black-border)',
                        padding: isTop3 ? '12px' : '8px 12px'
                    }}
                  >
                    <div className={`ranking-pos ${isTop3 ? `pos-${i + 1}` : ""}`} style={{ fontSize: isTop3 ? '20px' : '14px', fontWeight: 900 }}>
                      {i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </div>
                    <div className="ranking-info">
                      <div className="ranking-name" style={{ fontSize: isTop3 ? '14px' : '12px', fontWeight: 700 }}>
                        {r.nombres}
                        {(r.racha_actual ?? 0) > 2 && (
                          <span className="streak-tag" style={{ marginLeft: '8px' }}>🔥 {r.racha_actual}</span>
                        )}
                      </div>
                      <div className="ranking-level" style={{ opacity: 0.8 }}>
                        <span style={{ color: nivel.color || 'var(--gold)', fontWeight: 700 }}>
                          {nivel.nombre}
                        </span>
                        <span className="ranking-stats" style={{ marginLeft: '10px', fontSize: '9px' }}>
                          {r.partidas_ganadas}W • {winRate}% WR
                        </span>
                      </div>
                    </div>
                    <div className="ranking-points" style={{ color: isTop3 ? 'var(--gold-light)' : 'var(--gold)', textShadow: isTop3 ? '0 0 10px var(--gold-glow)' : 'none' }}>
                        {r.puntos} <span style={{ fontSize: '9px', opacity: 0.6 }}>PTS</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Niveles reference - Battle Pass style */}
      <div className="card" style={{ background: 'linear-gradient(180deg, var(--black-card), #050505) !important' }}>
        <div className="card-header">
          <div className="card-header-icon">💎</div>
          <div className="card-title">SISTEMA DE RANGOS</div>
        </div>
        <div className="card-body" style={{ padding: '15px' }}>
          <div className="niveles-list" style={{ gap: '6px' }}>
            {NIVELES.slice(1, 8).map((n) => (
              <div 
                className="nivel-item" 
                key={n.nombre}
                style={{ 
                    background: 'rgba(255,255,255,0.02)', 
                    border: '1px solid rgba(255,255,255,0.05)',
                    padding: '10px'
                }}
              >
                <span className="nivel-emoji" style={{ fontSize: '20px' }}>{n.emoji}</span>
                <div style={{ flex: 1, marginLeft: '10px' }}>
                    <div className="nivel-nombre" style={{ color: n.color, letterSpacing: '1px', fontSize: '11px' }}>
                      {n.nombre}
                    </div>
                    {n.recompensa && (
                        <div style={{ fontSize: '9px', color: 'var(--neon-green)', fontWeight: 700, textTransform: 'uppercase' }}>
                          ⚡ RECOMPENSA: {n.recompensa.texto}
                        </div>
                    )}
                </div>
                <div className="nivel-puntos" style={{ fontWeight: 800, fontSize: '10px', color: 'var(--white-dim)' }}>
                    {n.puntos} PTS
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
