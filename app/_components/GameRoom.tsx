"use client";

import { obtenerNivel } from "@/lib/cofres";
import { DADOS_DISPONIBLES } from "@/lib/dados";
import { Player } from "@/types";
import { formatSoles } from "@/lib/currency";

interface GameRoomProps {
  jugadores: Player[];
  monto: number;
  fase: string;
  onRemovePlayer: (index: number) => void;
  modoJuego: string;
  onPlayClick?: () => void;
}

export default function GameRoom({ jugadores, monto, fase, onRemovePlayer, modoJuego, onPlayClick }: GameRoomProps) {
  const pozo = jugadores.length * monto;
  
  const maxPlayers = modoJuego === "versus" ? 2 : 10;
  const missingPlayers = maxPlayers - jugadores.length;
  
  const getUrgencyClass = () => {
    if (missingPlayers === 0) return "urgencia-medium";
    if (missingPlayers === 1) return "urgencia-high";
    return "";
  };

  return (
    <div className={`card ${getUrgencyClass()}`}>
      <div className="card-header">
        <div className="card-header-icon">💎</div>
        <div className="card-title">SALA DE JUEGO LIVE</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "10px", alignItems: "center" }}>
          {missingPlayers > 0 && (
             <span className={`badge ${missingPlayers === 1 ? 'urgencia-high' : 'badge-count'}`}>
               {missingPlayers === 1 ? "🔥 ¡ÚLTIMO CUPO!" : `Faltan ${missingPlayers}`}
             </span>
          )}
          <span className="badge badge-count">
            {jugadores.length}/{maxPlayers}
          </span>
        </div>
      </div>
      <div className="card-body">
        {jugadores.length === 0 ? (
          <div className="sala-empty">
            <div className="sala-empty-icon" style={{ animation: 'energyPulse 2s infinite' }}>🎲</div>
            <div className="sala-empty-text" style={{ letterSpacing: '2px', fontWeight: 600 }}>
              ESPERANDO JUGADORES...
            </div>
          </div>
        ) : (
          <>
            <div className="game-settings">
              <div className="game-setting" style={{ borderLeft: '2px solid var(--gold)' }}>
                <div className="game-setting-label">Estado</div>
                <div className="game-setting-value" style={{ fontSize: '14px', color: missingPlayers === 0 ? 'var(--neon-green)' : 'var(--gold)'}}>
                  {missingPlayers === 0 ? '✅ LISTO' : '⏳ BUSCANDO'}
                </div>
              </div>
              <div className="game-setting">
                <div className="game-setting-label">Monto</div>
                <div className="game-setting-value">{formatSoles(monto)}</div>
              </div>
              <div className="game-setting">
                <div className="game-setting-label">Pozo</div>
                <div className="game-setting-value pozo" style={{ textShadow: '0 0 10px var(--neon-green-glow)' }}>{formatSoles(pozo)}</div>
              </div>
              <div className="game-setting" style={{ background: 'rgba(212, 175, 55, 0.05)' }}>
                <div className="game-setting-label">PREMIO</div>
                <div className="game-setting-value pozo">{formatSoles(pozo * 0.8)}</div>
              </div>
            </div>

            <div className="sala-list">
              {jugadores.map((j, i) => {
                const nivel = obtenerNivel(j.puntos || 0);
                return (
                  <div
                    className="sala-player"
                    key={j.dni}
                    style={{ animationDelay: `${i * 0.05}s`, borderLeft: `3px solid ${nivel.color || 'var(--gold)'}` }}
                  >
                    <div className="sala-player-info">
                      <div className="sala-player-avatar" style={{ 
                        background: 'transparent',
                        border: `2px solid ${nivel.color || 'var(--gold-dark)'}`,
                        padding: 0,
                        overflow: 'hidden',
                        width: 48,
                        height: 48,
                        flexShrink: 0,
                        boxShadow: `0 0 12px ${DADOS_DISPONIBLES.find(d => d.id === j.dadoId)?.shadow || 'rgba(212,175,55,0.3)'}`
                      }}>
                        {(() => {
                          const dado = DADOS_DISPONIBLES.find(d => d.id === j.dadoId);
                          return dado ? (
                            <img src={dado.imagen} alt={dado.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : <span style={{ fontSize: 24, lineHeight: '48px', display: 'block', textAlign: 'center' }}>{nivel.emoji || '🎲'}</span>;
                        })()}
                      </div>
                      <div>
                        <div className="sala-player-name" style={{ color: 'var(--white-soft)', fontSize: '14px' }}>
                          {j.nombres}
                        </div>
                        <div className="sala-player-dni" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                          <span className="dado-tag" style={{ color: "var(--gold-light)", fontWeight: 800 }}>
                            {j.dadoNombre}
                          </span>
                          <span className="nivel-tag" style={{ color: nivel.color, opacity: 0.9 }}>
                            • {nivel.nombre}
                          </span>
                          {(j as any).saldo_real !== undefined && (
                            <span className="badge" style={{ backgroundColor: 'rgba(0, 255, 128, 0.1)', color: 'var(--neon-green)', border: '1px solid var(--neon-green-glow)', fontSize: '0.75rem', padding: '2px 6px' }}>
                              {formatSoles(Number((j as any).saldo_real))}
                            </span>
                          )}
                          {(j.racha_actual || 0) > 1 && (
                            <span className="streak-tag">🔥 {j.racha_actual} RACHA</span>
                          )}
                        </div>
                        {/* HUD Credit Bar */}
                        {(j as any).saldo_real !== undefined && monto > 0 && (
                          <div style={{ marginTop: 6 }}>
                            <div className="credit-bar-wrapper">
                              <div
                                className={`credit-bar-fill ${Number((j as any).saldo_real) <= monto ? 'low' : ''}`}
                                style={{ width: `${Math.min(100, (Number((j as any).saldo_real) / Math.max(monto * 5, 1)) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {fase === "espera" && (
                      <button
                        className="sala-player-remove"
                        onClick={() => onRemovePlayer(i)}
                        title="Remover"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* BOTÓN MAESTRO DE INICIO (Solo visible en fase espera) */}
            {fase === "espera" && onPlayClick && jugadores.length >= 2 && (
               <button 
                 onClick={onPlayClick} 
                 className="btn btn-primary" 
                 style={{ 
                   marginTop: 24, 
                   fontSize: 18, 
                   width: "100%", 
                   padding: 16,
                   background: "linear-gradient(90deg, var(--gold-dark), var(--gold))",
                   color: "#000",
                   fontWeight: 800,
                   boxShadow: "0 0 20px rgba(212,175,55,0.4)"
                 }}
               >
                 🎮 JUGAR AHORA
               </button>
            )}
            
          </>
        )}
      </div>
    </div>
  );
}
