"use client";

import { useRef, useState } from "react";
import { updateBalance, deleteTransaction, setPlayerPin } from "./actions";
import Link from "next/link";
import { formatSoles } from "@/lib/currency";

interface AdminClientProps {
  initialJugadores: any[];
  reporte: any;
  transacciones: any[];
  stats: any;
}

export default function AdminClient({ initialJugadores, reporte, transacciones, stats }: AdminClientProps) {
  const [tab, setTab] = useState<"jugadores" | "finanzas" | "stats">("jugadores");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  type ModalActionType = 
    | { type: "ingreso" | "retiro" | "pin"; dni: string; nombres: string }
    | { type: "eliminar_transaccion"; id: number };

  const [modalAction, setModalAction] = useState<ModalActionType | null>(null);
  const [modalAmount, setModalAmount] = useState("");

  const filteredJugadores = initialJugadores.filter(j => 
    j.nombres.toLowerCase().includes(searchTerm.toLowerCase()) || 
    j.dni.includes(searchTerm)
  );

  const [toastMessage, setToastMessage] = useState("");
  const pendingAdjustment = useRef<{ fingerprint: string; key: string } | null>(null);

  const handleUpdateBalance = async (dni: string, amount: number, isAdd: boolean) => {
    const fingerprint = JSON.stringify([dni, amount, isAdd]);
    if (pendingAdjustment.current?.fingerprint !== fingerprint) {
      pendingAdjustment.current = { fingerprint, key: crypto.randomUUID() };
    }
    setLoading(true);
    const res = await updateBalance(dni, amount, isAdd, pendingAdjustment.current.key);
    setLoading(false);
    
    if (res.success) {
      pendingAdjustment.current = null;
      setToastMessage("Operación exitosa");
      setTimeout(() => setToastMessage(""), 3000);
    } else {
      setToastMessage("Error: " + res.error);
      setTimeout(() => setToastMessage(""), 5000);
    }
  };

  return (
    <div>
      {/* TABS */}
      <div style={{ display: "flex", gap: 16, marginBottom: 30 }}>
        <TabButton active={tab === "jugadores"} onClick={() => setTab("jugadores")}>👥 Jugadores & Saldos</TabButton>
        <TabButton active={tab === "finanzas"} onClick={() => setTab("finanzas")}>📒 Registro de saldos</TabButton>
        <TabButton active={tab === "stats"} onClick={() => setTab("stats")}>📈 Estadísticas del juego</TabButton>
        <Link href="/manual" className="btn" style={{ marginLeft: "auto", padding: "12px 24px", background: "rgba(255,255,255,0.1)", borderRadius: 8, color: "white", textDecoration: "none" }}>Volver al Juego</Link>
      </div>

      {loading && <div style={{ marginBottom: 20, color: "var(--gold)" }}>Procesando transacción... actualizando panel...</div>}

      {/* JUGADORES */}
      {tab === "jugadores" && (
        <div className="card" style={{ padding: 24, background: "rgba(10,15,25,0.9)", border: "1px solid rgba(212,175,55,0.2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ color: "var(--gold-light)", margin: 0 }}>Gestión de Billeteras</h2>
            <input 
              type="text" 
              placeholder="Buscar por DNI o Nombre..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", color: "white" }}
            />
          </div>
          
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.4)", color: "var(--gold)", textAlign: "left" }}>
                <th style={{ padding: 12 }}>DNI</th>
                <th style={{ padding: 12 }}>Nombres</th>
                <th style={{ padding: 12 }}>Saldo actual</th>
                <th style={{ padding: 12 }}>Total ganado</th>
                <th style={{ padding: 12 }}>Puntos</th>
                <th style={{ padding: 12 }}>Acciones Rápidas</th>
              </tr>
            </thead>
            <tbody>
              {filteredJugadores.map(j => (
                <tr key={j.dni} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: 12, fontFamily: "monospace" }}>{j.dni}</td>
                  <td style={{ padding: 12, fontWeight: 600 }}>{j.nombres}</td>
                  <td style={{ padding: 12, color: "var(--neon-green)", fontWeight: 800 }}>{formatSoles(j.saldo_real || 0)}</td>
                  <td style={{ padding: 12 }}>{formatSoles(j.total_ganado || 0)}</td>
                  <td style={{ padding: 12, color: "var(--gold)" }}>{j.puntos} pts</td>
                  <td style={{ padding: 12 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button 
                        onClick={() => { setModalAction({ type: "ingreso", dni: j.dni, nombres: j.nombres }); }}
                        style={{ padding: "6px 12px", background: "rgba(0, 230, 118, 0.2)", border: "1px solid #00E676", color: "#00E676", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}
                      >
                        + Créditos
                      </button>
                      <button 
                        onClick={() => { setModalAction({ type: "retiro", dni: j.dni, nombres: j.nombres }); }}
                        style={{ padding: "6px 12px", background: "rgba(255, 59, 59, 0.2)", border: "1px solid #FF3B3B", color: "#FF3B3B", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}
                      >
                        - Créditos
                      </button>
                      <button
                        onClick={() => { setModalAction({ type: "pin", dni: j.dni, nombres: j.nombres }); setModalAmount(""); }}
                        style={{ padding: "6px 12px", background: "rgba(212,175,55,.15)", border: "1px solid var(--gold)", color: "var(--gold-light)", borderRadius: 4, cursor: "pointer", fontWeight: "bold" }}
                      >
                        Definir PIN
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredJugadores.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "gray" }}>No se encontraron jugadores.</td>
                </tr>
              )}
            </tbody>
          </table>
          
          {/* Custom Modal */}
          {modalAction && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
              <div style={{ background: "#111", padding: 30, borderRadius: 16, border: "1px solid var(--gold)", width: 400 }}>
                <h3 style={{ marginTop: 0, color: modalAction.type === "ingreso" ? "#00E676" : modalAction.type === "retiro" ? "#FF3B3B" : "white" }}>
                  {modalAction.type === "ingreso" ? "ASIGNAR SALDO" : modalAction.type === "retiro" ? "DESCONTAR SALDO" : modalAction.type === "pin" ? "DEFINIR PIN DE ACCESO" : "ELIMINAR TRANSACCIÓN"}
                </h3>
                {modalAction.type !== "eliminar_transaccion" && <p style={{ color: "gray", marginBottom: 20 }}>Jugador: <strong>{modalAction.nombres}</strong> ({modalAction.dni})</p>}
                {modalAction.type === "eliminar_transaccion" && <p style={{ color: "gray", marginBottom: 20 }}>¿Seguro que deseas eliminar este registro de auditoría permanentemente?</p>}
                
                {modalAction.type !== "eliminar_transaccion" && (
                  <input 
                    type={modalAction.type === "pin" ? "password" : "number"}
                    value={modalAmount}
                    onChange={(e) => setModalAmount(e.target.value)}
                    placeholder={modalAction.type === "pin" ? "PIN de 6 dígitos" : "Monto en soles"}
                    inputMode="numeric"
                    style={{ width: "100%", padding: 12, background: "rgba(255,255,255,0.1)", border: "none", color: "white", borderRadius: 8, marginBottom: 20 }}
                    autoFocus
                  />
                )}
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button 
                    onClick={() => { setModalAction(null); setModalAmount(""); }}
                    style={{ padding: "10px 20px", background: "transparent", color: "white", border: "1px solid gray", borderRadius: 8, cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={async () => {
                      if (modalAction.type === "eliminar_transaccion") {
                        await deleteTransaction((modalAction as any).id);
                        setModalAction(null);
                        setToastMessage("Transacción eliminada");
                        setTimeout(() => setToastMessage(""), 3000);
                        return;
                      }
                      if (modalAction.type === "pin") {
                        const result = await setPlayerPin(modalAction.dni, modalAmount);
                        setToastMessage(result.success ? "PIN actualizado" : `Error: ${result.error}`);
                        setTimeout(() => setToastMessage(""), 4000);
                        if (result.success) { setModalAction(null); setModalAmount(""); }
                        return;
                      }
                      
                      const amt = Number(modalAmount);
                      if (amt > 0) {
                        await handleUpdateBalance(modalAction.dni, amt, modalAction.type === "ingreso");
                        setModalAction(null);
                        setModalAmount("");
                      }
                    }}
                    style={{ padding: "10px 20px", background: modalAction.type === "ingreso" ? "#00E676" : "#FF3B3B", color: "black", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" }}
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FINANZAS */}
      {tab === "finanzas" && (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
          {/* Resumen */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: 24, background: "rgba(0, 230, 118, 0.1)", border: "1px solid #00E676", borderRadius: 12 }}>
              <h3 style={{ margin: "0 0 8px 0", color: "#00E676", fontSize: 14 }}>Créditos asignados</h3>
              <div style={{ fontSize: 32, fontWeight: 900, color: "white" }}>{formatSoles(reporte.ingresos)}</div>
            </div>
            <div style={{ padding: 24, background: "rgba(255, 59, 59, 0.1)", border: "1px solid #FF3B3B", borderRadius: 12 }}>
              <h3 style={{ margin: "0 0 8px 0", color: "#FF3B3B", fontSize: 14 }}>Créditos consumidos</h3>
              <div style={{ fontSize: 32, fontWeight: 900, color: "white" }}>{formatSoles(reporte.egresos)}</div>
            </div>
            <div style={{ padding: 24, background: "rgba(212, 175, 55, 0.1)", border: "1px solid var(--gold)", borderRadius: 12 }}>
              <h3 style={{ margin: "0 0 8px 0", color: "var(--gold)", fontSize: 14 }}>Balance virtual neto</h3>
              <div style={{ fontSize: 32, fontWeight: 900, color: "white" }}>{formatSoles(reporte.neta)}</div>
            </div>
          </div>

          {/* Historial */}
          <div className="card" style={{ padding: 24, background: "rgba(10,15,25,0.9)", border: "1px solid rgba(212,175,55,0.2)" }}>
            <h2 style={{ color: "var(--gold-light)", margin: "0 0 20px 0" }}>Registro de Transacciones</h2>
            <div style={{ maxHeight: 600, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.4)", color: "var(--gold)", textAlign: "left" }}>
                    <th style={{ padding: 12 }}>Fecha</th>
                    <th style={{ padding: 12 }}>DNI</th>
                    <th style={{ padding: 12 }}>Jugador</th>
                    <th style={{ padding: 12 }}>Operación</th>
                    <th style={{ padding: 12 }}>Monto</th>
                    <th style={{ padding: 12 }}>Auditoría</th>
                  </tr>
                </thead>
                <tbody>
                  {transacciones.map(t => (
                    <tr key={t.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: 12, color: "gray" }}>{new Date(t.fecha).toLocaleString()}</td>
                      <td style={{ padding: 12, fontFamily: "monospace" }}>{t.dni}</td>
                      <td style={{ padding: 12 }}>{t.nombres || "Desconocido"}</td>
                      <td style={{ padding: 12 }}>{t.operacion}</td>
                      <td style={{ padding: 12, fontWeight: 800, color: t.tipo === "ingreso" ? "#00E676" : "#FF3B3B" }}>
                        {t.tipo === "ingreso" ? "+" : "-"} {formatSoles(t.monto)}
                      </td>
                      <td style={{ padding: 12 }}>
                        <span title="Los movimientos financieros no se eliminan; se revierten con un asiento compensatorio." style={{ color: "gray" }}>
                          Inmutable
                        </span>
                      </td>
                    </tr>
                  ))}
                  {transacciones.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "gray" }}>No hay transacciones registradas.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ESTADÍSTICAS */}
      {tab === "stats" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 24 }}>
          <StatCard title="Partidas Jugadas" value={stats.totalPartidas} icon="🎲" />
          <StatCard title="Dinero repartido" value={formatSoles(stats.totalDinero)} icon="✦" />
          <StatCard title="Jugadores Registrados" value={stats.totalJugadores} icon="👥" />
          
          <div style={{ padding: 24, background: "rgba(212, 175, 55, 0.05)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 12, gridColumn: "1 / -1" }}>
            <h3 style={{ color: "var(--gold)", marginTop: 0, marginBottom: 20 }}>Récords del juego</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
              <div>
                <div style={{ color: "gray", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Mayor Ganador (Partidas)</div>
                <div style={{ fontSize: 20, fontWeight: "bold", marginTop: 8 }}>{stats.topGanador?.nombres || "-"}</div>
                <div style={{ color: "var(--neon-green)" }}>{stats.topGanador?.partidas_ganadas || 0} victorias</div>
              </div>
              <div>
                <div style={{ color: "gray", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Mejor Racha</div>
                <div style={{ fontSize: 20, fontWeight: "bold", marginTop: 8 }}>{stats.mejorRacha?.nombres || "-"}</div>
                <div style={{ color: "#FF6B35" }}>🔥 {stats.mejorRacha?.mejor_racha || 0} consecutivas</div>
              </div>
              <div>
                <div style={{ color: "gray", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Jugador más Activo</div>
                <div style={{ fontSize: 20, fontWeight: "bold", marginTop: 8 }}>{stats.masJugadas?.nombres || "-"}</div>
                <div style={{ color: "var(--gold-light)" }}>{stats.masJugadas?.partidas_jugadas || 0} partidas jugadas</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{ position: "fixed", bottom: 20, right: 20, background: toastMessage.includes("Error") ? "#FF3B3B" : "#00E676", color: "black", padding: "12px 24px", borderRadius: 8, fontWeight: "bold", zIndex: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}>
          {toastMessage}
        </div>
      )}
    </div>
  );
}

function TabButton({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      style={{
        padding: "16px 32px",
        background: active ? "var(--gold-gradient)" : "rgba(255,255,255,0.05)",
        color: active ? "black" : "white",
        border: "none",
        borderRadius: 8,
        fontWeight: active ? 900 : 500,
        cursor: "pointer",
        transition: "all 0.2s"
      }}
    >
      {children}
    </button>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string | number, icon: string }) {
  return (
    <div style={{ padding: 24, background: "rgba(10,15,25,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <div style={{ color: "gray", fontSize: 14, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 900, color: "white" }}>{value}</div>
    </div>
  );
}
