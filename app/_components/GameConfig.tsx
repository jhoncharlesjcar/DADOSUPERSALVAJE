"use client";

import { formatSoles } from "@/lib/currency";

const MONTOS_LIST = [2, 5, 10, 20, 30, 40, 50, 100];

interface GameConfigProps {
  modoJuego: string;
  setModoJuego: (modo: string) => void;
  monto: number;
  setMonto: (monto: number) => void;
  disabled: boolean;
}

export default function GameConfig({ 
  modoJuego, 
  setModoJuego, 
  monto, 
  setMonto,
  disabled 
}: GameConfigProps) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-icon">⚔️</div>
        <div className="card-title">Configuración de Partida</div>
      </div>
      <div className="card-body">
        <label className="search-label" style={{ marginBottom: 8 }}>Modo de Juego</label>
        <div className="monto-selector" style={{ marginBottom: 18 }}>
          <button
            className={`monto-btn ${modoJuego === "versus" ? "active" : ""}`}
            onClick={() => setModoJuego("versus")}
            disabled={disabled}
          >
            ⚔️ Versus (1vs1)
          </button>
          <button
            className={`monto-btn ${modoJuego === "batalla" ? "active" : ""}`}
            onClick={() => setModoJuego("batalla")}
            disabled={disabled}
          >
            🔥 Batalla Salvaje
          </button>
        </div>

        <label className="search-label" style={{ marginBottom: 8 }}>Créditos por jugador</label>
        <div className="monto-selector">
          {MONTOS_LIST.map((m) => (
            <button
              key={m}
              className={`monto-btn ${monto === m ? "active" : ""}`}
              onClick={() => setMonto(m)}
              disabled={disabled}
            >
              {formatSoles(m)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
