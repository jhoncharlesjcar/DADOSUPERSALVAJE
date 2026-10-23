"use client";

import { useState, useEffect } from "react";
import { obtenerNivel, obtenerProgresoNivel } from "@/lib/cofres";
import { DADOS_DISPONIBLES } from "@/lib/dados";
import { Player } from "@/types";
import { formatSoles } from "@/lib/currency";

interface NivelBadgeProps {
  puntos: number;
}

// === HELPER: Forzar liberación de teclado Unity ===
const forceReleaseKeyboard = () => {
  if (typeof window !== "undefined") {
    try {
      if ((window as any).unityInstance?.Module?.canvas) {
        (window as any).unityInstance.Module.canvas.blur();
      }
      if (typeof (window as any).WebGLInput !== "undefined") {
        (window as any).WebGLInput.captureAllKeyboardInput = false;
      }
    } catch (e) {
      // ignore
    }
  }
};

// ========= NivelBadge =========
function NivelBadge({ puntos }: NivelBadgeProps) {
  const nivel = obtenerNivel(puntos);
  return (
    <span
      className="nivel-badge-inline"
      style={{
        background: `${nivel.color}18`,
        color: nivel.color,
        border: `1px solid ${nivel.color}40`,
      }}
    >
      {nivel.emoji} {nivel.nombre}
    </span>
  );
}

// ========= ProgresoNivel =========
function ProgresoNivel({ puntos }: NivelBadgeProps) {
  const { nivel, siguiente, progreso, puntosParaSiguiente } =
    obtenerProgresoNivel(puntos);

  if (!siguiente) {
    return (
      <div className="progreso-nivel">
        <div className="progreso-label">
          <span>🎲 ¡NIVEL MÁXIMO!</span>
        </div>
        <div className="progreso-bar">
          <div className="progreso-fill max" style={{ width: "100%" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="progreso-nivel">
      <div className="progreso-label">
        <span style={{ color: nivel.color }}>
          {nivel.emoji} {nivel.nombre}
        </span>
        <span style={{ color: siguiente.color }}>
          → {siguiente.emoji} {siguiente.nombre}
        </span>
      </div>
      <div className="progreso-bar">
        <div
          className="progreso-fill"
          style={{
            width: `${progreso}%`,
            background: `linear-gradient(90deg, ${nivel.color}, ${siguiente.color})`,
          }}
        />
      </div>
      <div className="progreso-text">
        Faltan {puntosParaSiguiente} pts
      </div>
    </div>
  );
}

interface PlayerSearchProps {
  onPlayerAdd: (player: Player) => void;
  jugadores: Player[];
  disabled: boolean;
}

// ========= MAIN COMPONENT =========
export default function PlayerSearch({
  onPlayerAdd,
  jugadores,
  disabled,
}: PlayerSearchProps) {
  const [dni, setDni] = useState("");
  const [jugador, setJugador] = useState<Player | null>(null);
  const [resultados, setResultados] = useState<Player[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [noEncontrado, setNoEncontrado] = useState(false);
  const [showRegistro, setShowRegistro] = useState(false);
  const [dadoSeleccionado, setDadoSeleccionado] = useState(DADOS_DISPONIBLES[0].id);
  const [regForm, setRegForm] = useState({
    nombres: "",
    celular: "",
    codigo_yapeo: "",
    monto_yapeo: "",
  });

  const seleccionarJugador = (jugadorSeleccionado: Player) => {
    setJugador(jugadorSeleccionado);
    setResultados([]);
    setRegForm({
      nombres: jugadorSeleccionado.nombres,
      celular: jugadorSeleccionado.celular || "",
      codigo_yapeo: "",
      monto_yapeo: "",
    });
    // Seleccionar automáticamente el primer dado disponible no ocupado en la sala
    const primerDisponible = DADOS_DISPONIBLES.find(d => !(jugadores || []).some(j => j.dadoId === d.id)) || DADOS_DISPONIBLES[0];
    setDadoSeleccionado(primerDisponible.id);
  };

  async function buscarJugador() {
    if (!dni.trim()) return;
    setBuscando(true);
    setJugador(null);
    setResultados([]);
    setNoEncontrado(false);
    setShowRegistro(false);

    try {
      const res = await fetch(`/api/jugador?q=${encodeURIComponent(dni.trim())}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        if (data.length === 1) {
          seleccionarJugador(data[0]);
        } else {
          setResultados(data);
        }
      } else {
        setNoEncontrado(true);
        setShowRegistro(true);
        // Si parece un DNI, pre-llenarlo
        const esDni = /^\d{8}$/.test(dni.trim());
        setRegForm((prev) => ({ 
          ...prev, 
          nombres: esDni ? "" : dni.trim(), 
          codigo_yapeo: "", 
          monto_yapeo: "" 
        }));
      }
    } catch {
      // handle error
    }
    setBuscando(false);
  }

  async function registrarJugador() {
    if (!regForm.nombres.trim()) return;

    try {
      const res = await fetch("/api/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dni: dni.trim(), ...regForm }),
      });
      const data = await res.json();
      if (data.ok) {
        const nuevoJugador: Player = { 
          dni: dni.trim(), 
          nombres: regForm.nombres, 
          celular: regForm.celular,
          puntos: 0,
          dadoId: "",
          dadoNombre: "",
          saldo_real: Number(data.saldo_real || 0) as any,
        };
        seleccionarJugador(nuevoJugador);
        setShowRegistro(false);
        setNoEncontrado(false);
      } else if (data.error) {
        alert(data.error);
      }
    } catch {
      alert("Error al registrar jugador");
    }
  }

  async function agregarJugador() {
    if (!jugador) return;

    let saldoFinal = Number((jugador as any).saldo_real ?? (jugador as any).monto_yapeo ?? 0);
    const tieneNuevoYape = Boolean(regForm.codigo_yapeo.trim() && regForm.monto_yapeo.trim());

    // Si se especificó un nuevo código y monto de Yape, actualizamos el saldo en DB
    if (tieneNuevoYape) {
      try {
        const res = await fetch("/api/registrar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            dni: jugador.dni, 
            nombres: jugador.nombres, 
            celular: regForm.celular, 
            codigo_yapeo: regForm.codigo_yapeo.trim(),
            monto_yapeo: regForm.monto_yapeo.trim()
          }),
        });
        const data = await res.json();
        if (!data.ok) {
          alert(data.error || "Error al actualizar saldo");
          return;
        }
        saldoFinal = Number(data.saldo_real || 0);
      } catch {
        alert("Error de conexión al actualizar saldo");
        return;
      }
    } else if (saldoFinal <= 0) {
      alert("⚠️ El jugador tiene S/ 0.00 de saldo. Ingresa el Código y Monto de Yape en la sección de recarga para asignarle saldo.");
      return;
    }

    const colorConfig = DADOS_DISPONIBLES.find(d => d.id === dadoSeleccionado) || DADOS_DISPONIBLES[0];
    onPlayerAdd({
      ...jugador,
      celular: regForm.celular || jugador.celular,
      dadoId: colorConfig.id,
      dadoNombre: colorConfig.nombre,
      saldo_real: saldoFinal,
    });
    setJugador(null);
    setDni("");
    setNoEncontrado(false);
    setShowRegistro(false);
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-icon">🔍</div>
        <div className="card-title">Buscar Jugador</div>
      </div>
      <div className="card-body">
        <div className="search-group">
          <label className="search-label" htmlFor="dni-search">
            DNI o Nombre del Jugador
          </label>
          <div className="search-input-wrapper">
            <input
              id="dni-search"
              className="input-field"
              type="text"
              placeholder="Ingresa DNI o nombre..."
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") buscarJugador();
              }}
              disabled={disabled}
            />
            <button
              className="btn btn-primary"
              onClick={buscarJugador}
              disabled={buscando || !dni.trim() || disabled}
            >
              {buscando ? "..." : "Buscar"}
            </button>
          </div>
        </div>

        {resultados.length > 0 && !jugador && (
          <div className="search-results" style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
              Múltiples resultados encontrados:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {resultados.map((res) => (
                <button
                  key={res.dni}
                  className="btn"
                  style={{
                    justifyContent: "flex-start",
                    background: "var(--black-elevated)",
                    border: "1px solid var(--border-color)",
                    padding: "8px 12px",
                    textAlign: "left"
                  }}
                  onClick={() => seleccionarJugador(res)}
                >
                  <div style={{ fontWeight: 600 }}>{res.nombres}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>DNI: {res.dni}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {jugador && (
          <div className="player-found" style={{ marginTop: 16 }}>
            <div className="player-found-header">
              <div className="player-found-name">{jugador.nombres}</div>
              {jugador.puntos > 0 && <NivelBadge puntos={jugador.puntos} />}
            </div>
            <div className="player-found-info">
              DNI: {jugador.dni}
              {jugador.celular && ` · Tel: ${jugador.celular}`}
              {(jugador as any).saldo_real !== undefined && ` · Saldo: ${formatSoles(Number((jugador as any).saldo_real))}`}
              {jugador.puntos > 0 && ` · ⭐ ${jugador.puntos} pts`}
              {(jugador.racha_actual || 0) > 0 && (
                <span className="streak-badge">🔥 Racha: {jugador.racha_actual}</span>
              )}
            </div>
            {jugador.puntos > 0 && <ProgresoNivel puntos={jugador.puntos} />}
            
            <div style={{ marginTop: 12, marginBottom: 12 }}>
              <label className="search-label" style={{ fontSize: 9 }}>Elige tu Dado</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {DADOS_DISPONIBLES.map(d => {
                  const isTaken = (jugadores || []).some(j => j.dadoId === d.id);
                  const isSelected = dadoSeleccionado === d.id;
                  return (
                    <button
                      key={d.id}
                      title={d.nombre + (isTaken ? ' (En uso)' : '')}
                      disabled={isTaken}
                      onClick={() => setDadoSeleccionado(d.id)}
                      style={{
                        padding: 0,
                        border: isSelected ? `2px solid var(--gold)` : '2px solid transparent',
                        borderRadius: 8,
                        overflow: 'hidden',
                        cursor: isTaken ? 'not-allowed' : 'pointer',
                        opacity: isTaken ? 0.35 : 1,
                        boxShadow: isSelected ? `0 0 14px ${d.shadow}` : 'none',
                        transition: 'all 0.2s ease',
                        background: 'transparent',
                        aspectRatio: '1',
                        width: '100%',
                      }}
                    >
                      <img
                        src={d.imagen}
                        alt={d.nombre}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </button>
                  );
                })}
              </div>
              {dadoSeleccionado && (
                <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 6, textAlign: 'center', fontWeight: 600 }}>
                  🎲 {DADOS_DISPONIBLES.find(d => d.id === dadoSeleccionado)?.nombre}
                </div>
              )}
            </div>

            {/* BOTÓN PRINCIPAL PROMINENTE: AGREGAR A LA SALA */}
            <div style={{ marginTop: 14, marginBottom: 12 }}>
              <button
                type="button"
                className="btn btn-success btn-block"
                style={{
                  width: "100%",
                  padding: "13px 16px",
                  fontSize: "14px",
                  fontWeight: 800,
                  letterSpacing: "0.5px",
                  background: "linear-gradient(135deg, #00E676 0%, #00B248 100%)",
                  color: "#051A0E",
                  border: "none",
                  borderRadius: "10px",
                  boxShadow: "0 4px 18px rgba(0, 230, 118, 0.4)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
                onClick={agregarJugador}
              >
                <span>✚ AGREGAR A LA SALA</span>
                <span style={{ background: "rgba(0,0,0,0.22)", color: "#000", padding: "2px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: 700 }}>
                  Saldo: {formatSoles(Number((jugador as any).saldo_real ?? (jugador as any).monto_yapeo ?? 0))}
                </span>
              </button>
            </div>

            {/* SECCIÓN OPCIONAL: RECARGAR / ASIGNAR SALDO */}
            <details style={{ marginTop: 8, marginBottom: 8, background: "rgba(255, 255, 255, 0.03)", borderRadius: "10px", padding: "10px 12px", border: "1px solid rgba(212, 175, 55, 0.2)" }}>
              <summary style={{ fontSize: "12px", color: "var(--gold)", cursor: "pointer", fontWeight: 600, userSelect: "none" }}>
                💳 ¿Recargar o cambiar saldo con Yape? (Opcional)
              </summary>
              <div className="register-form" style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: "8px" }}>
                <input
                  className="input-field input-field-sm"
                  type="text"
                  placeholder="Contacto celular (opcional)"
                  value={regForm.celular}
                  onChange={(e) => setRegForm({ ...regForm, celular: e.target.value })}
                />
                <div className="form-row">
                  <input
                    className="input-field input-field-sm"
                    type="text"
                    placeholder="Código de Yape"
                    value={regForm.codigo_yapeo}
                    onChange={(e) => setRegForm({ ...regForm, codigo_yapeo: e.target.value })}
                  />
                  <input
                    className="input-field input-field-sm"
                    type="text"
                    inputMode="decimal"
                    placeholder="Monto de Yape (S/)"
                    value={regForm.monto_yapeo}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      setRegForm({ ...regForm, monto_yapeo: val });
                    }}
                  />
                </div>
                <small style={{ color: "var(--white-dim)", fontSize: "10px", lineHeight: 1.3 }}>
                  💡 Si ingresas código y monto, el saldo se actualizará al hacer clic en &quot;Agregar a la Sala&quot;.
                </small>
              </div>
            </details>
          </div>
        )}

        {noEncontrado && showRegistro && (
          <div className="register-form" style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: "var(--warning)", marginBottom: 4 }}>
              ⚠️ Jugador no encontrado. Regístralo:
            </div>
            <input
              className="input-field input-field-sm"
              type="text"
              placeholder="Nombres completos"
              value={regForm.nombres}
              onChange={(e) => setRegForm({ ...regForm, nombres: e.target.value })}
            />
            <div className="form-row">
              <input
                className="input-field input-field-sm"
                type="text"
                placeholder="Contacto opcional"
                value={regForm.celular}
                onChange={(e) => setRegForm({ ...regForm, celular: e.target.value })}
              />
            </div>
            <div className="form-row">
              <input
                className="input-field input-field-sm"
                type="text"
                placeholder="Código de Yape (opcional)"
                value={regForm.codigo_yapeo}
                onChange={(e) => setRegForm({ ...regForm, codigo_yapeo: e.target.value })}
              />
              <input
                className="input-field input-field-sm"
                type="text"
                inputMode="decimal"
                placeholder="Monto de Yape"
                value={regForm.monto_yapeo}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '');
                  setRegForm({ ...regForm, monto_yapeo: val });
                }}
              />
            </div>
            <button className="btn btn-primary btn-block" onClick={registrarJugador}>
              Registrar Jugador
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
