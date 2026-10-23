"use client";

import { formatSoles } from "@/lib/currency";

interface HistoryItem {
  id: number;
  ganador_nombre: string;
  modo: string;
  fecha: string;
  premio: number | string;
  pozo: number;
}

interface GameHistoryProps {
  historial: HistoryItem[];
}

export default function GameHistory({ historial }: GameHistoryProps) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-icon">📋</div>
        <div className="card-title">Últimas Partidas</div>
        <span className="badge badge-count" style={{ marginLeft: "auto" }}>
          {historial.length} total
        </span>
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
                  <div className="history-meta">
                    <span className="history-mode">{h.modo === "batalla" ? "🔥 Batalla" : "⚔️ Versus"}</span>
                    <span className="history-date">
                      {new Date(h.fecha).toLocaleString("es-PE", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                <div className="history-prize-col">
                  <div className="history-prize">{formatSoles(h.premio)}</div>
                  <div className="history-pozo">Pozo: {formatSoles(h.pozo)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
