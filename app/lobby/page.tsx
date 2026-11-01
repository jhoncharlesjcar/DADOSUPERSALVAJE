"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import WalletCard from "@/app/_components/WalletCard";
import { formatSoles } from "@/lib/currency";

type PlayerProfile = {
  nombres: string;
  puntos: number;
  partidas_jugadas: number;
  partidas_ganadas: number;
  racha_actual: number;
};

type MatchStatus = "inactivo" | "uniendo" | "buscando" | "encontrada" | "cancelando" | "error";
type HistoryMatch = { id: string; mode: string; stake: number; winnerName: string; prize: number; won: boolean; playedAt: string };

export default function LobbyOnline() {
  const router = useRouter();
  const appRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [dni, setDni] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState("");
  const [matchStatus, setMatchStatus] = useState<MatchStatus>("inactivo");
  const [matchError, setMatchError] = useState("");
  const [walletRefreshKey, setWalletRefreshKey] = useState(0);
  const [history, setHistory] = useState<HistoryMatch[]>([]);
  const [maximumRange, setMaximumRange] = useState(false);
  const [continueWaiting, setContinueWaiting] = useState(false);

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch("/api/player/me", { cache: "no-store" });
      if (!response.ok) {
        setProfile(null);
        return false;
      }
      const data = await response.json();
      setProfile(data.player);
      fetch("/api/player/history", { cache: "no-store" })
        .then(historyResponse => historyResponse.ok ? historyResponse.json() : { matches: [] })
        .then(historyData => setHistory(historyData.matches || []))
        .catch(() => setHistory([]));
      return true;
    } catch {
      setProfile(null);
      return false;
    } finally {
      setSessionLoading(false);
    }
  }, []);

  const readMatchStatus = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/matchmaking/status", { cache: "no-store", signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo consultar la cola");
    setMaximumRange(data.atMaximumRange === true);
    if (data.status === "encontrada") {
      setMatchStatus("encontrada");
      router.push(`/play/${data.salaId}`);
      return;
    }
    setMatchStatus(data.status === "buscando" ? "buscando" : "inactivo");
  }, [router]);

  useEffect(() => {
    let particles: typeof import("@/lib/particleSystem") | null = null;
    import("@/lib/particleSystem").then(mod => {
      particles = mod;
      if (appRef.current) mod.startAmbientParticles(appRef.current);
    });
    void loadSession();
    return () => particles?.stopAmbientParticles();
  }, [loadSession]);

  useEffect(() => {
    if (!profile) return;
    const controller = new AbortController();
    void readMatchStatus(controller.signal).catch(() => setMatchStatus("inactivo"));
    return () => controller.abort();
  }, [profile, readMatchStatus]);

  useEffect(() => {
    if (matchStatus !== "buscando") return;
    const controller = new AbortController();
    const interval = window.setInterval(() => {
      void readMatchStatus(controller.signal).catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMatchError("Perdimos conexión con la cola. Puedes cancelar o reintentar.");
        setMatchStatus("error");
      });
    }, 2500);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [matchStatus, readMatchStatus]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthPending(true);
    setAuthError("");
    try {
      const endpoint = authMode === "login" ? "/api/auth/player/login" : "/api/auth/player/register";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dni, pin, nombres: name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No pudimos completar el acceso");
      await loadSession();
      setPin("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "No pudimos completar el acceso");
    } finally {
      setAuthPending(false);
    }
  }

  async function joinQueue(modo: "duelo" | "batalla", monto: number) {
    setMatchStatus("uniendo");
    setContinueWaiting(false);
    setMatchError("");
    try {
      const response = await fetch("/api/matchmaking/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo, monto }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo entrar a la cola");
      setWalletRefreshKey(key => key + 1);
      if (data.matchedSala) {
        setMatchStatus("encontrada");
        router.push(`/play/${data.matchedSala}`);
      } else {
        setMatchStatus("buscando");
      }
    } catch (error) {
      setMatchError(error instanceof Error ? error.message : "No se pudo entrar a la cola");
      setMatchStatus("error");
    }
  }

  async function cancelQueue() {
    setMatchStatus("cancelando");
    try {
      const response = await fetch("/api/matchmaking/join", { method: "DELETE" });
      if (!response.ok) throw new Error();
      setMatchStatus("inactivo");
      setMatchError("");
    } catch {
      setMatchStatus("error");
      setMatchError("No pudimos cancelar la búsqueda. Intenta otra vez.");
    }
  }

  async function logout() {
    await fetch("/api/matchmaking/join", { method: "DELETE" }).catch(() => {});
    await fetch("/api/auth/player/logout", { method: "POST" }).catch(() => {});
    setProfile(null);
    setMatchStatus("inactivo");
    setDni("");
  }

  if (sessionLoading) {
    return <main className="app-container lobby-centered"><div className="lobby-loader" role="status">Preparando el lobby…</div></main>;
  }

  if (!profile) {
    return (
      <main className="app-container lobby-centered" ref={appRef}>
        <motion.form className="card lobby-auth-card" onSubmit={submitAuth} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          <div className="lobby-auth-icon" aria-hidden="true">🎲</div>
          <p className="eyebrow">DADO SALVAJE</p>
          <h1>{authMode === "login" ? "Ingreso al lobby" : "Crea tu jugador"}</h1>
          <p className="lobby-auth-copy">
            {authMode === "login" ? "Accede a tu saldo y partidas con tu DNI y PIN." : "Recibe un saldo inicial de S/ 100.00 para comenzar."}
          </p>

          {authMode === "register" && (
            <label>Nombre del jugador
              <input value={name} onChange={event => setName(event.target.value)} maxLength={80} autoComplete="name" required />
            </label>
          )}
          <label>DNI
            <input value={dni} onChange={event => setDni(event.target.value.replace(/\D/g, ""))} inputMode="numeric" autoComplete="username" minLength={8} maxLength={8} required />
          </label>
          <label>PIN de 6 dígitos
            <input value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ""))} type="password" inputMode="numeric" autoComplete={authMode === "login" ? "current-password" : "new-password"} minLength={6} maxLength={6} required />
          </label>
          {authError && <div className="form-error" role="alert">{authError}</div>}
          <button className="btn btn-primary" type="submit" disabled={authPending || dni.length !== 8 || pin.length !== 6 || (authMode === "register" && name.trim().length < 2)}>
            {authPending ? "PROCESANDO…" : authMode === "login" ? "ENTRAR AL LOBBY" : "CREAR JUGADOR"}
          </button>
          <button className="lobby-auth-switch" type="button" onClick={() => { setAuthMode(mode => mode === "login" ? "register" : "login"); setAuthError(""); }}>
            {authMode === "login" ? "¿Primera vez? Crear jugador" : "Ya tengo jugador"}
          </button>
          <p className="virtual-credit-note">Acceso personal protegido mediante PIN</p>
        </motion.form>
      </main>
    );
  }

  const queueActive = matchStatus === "buscando" || matchStatus === "uniendo" || matchStatus === "cancelando";
  return (
    <main className="app-container lobby-page" ref={appRef}>
      <div className="lobby-atmosphere" aria-hidden="true">
        <span className="lobby-aurora lobby-aurora-gold" />
        <span className="lobby-aurora lobby-aurora-green" />
        <span className="lobby-horizon" />
      </div>
      <div className="lobby-shell">
        <header className="lobby-header">
          <div className="lobby-identity">
            <Image className="lobby-mark" src="/logo.webp" alt="" width={58} height={58} priority />
            <div>
              <p className="eyebrow">DADO SALVAJE · EN LÍNEA</p>
              <h1>Hola, {profile.nombres.split(" ")[0]}</h1>
            </div>
          </div>
          <div className="lobby-session-actions">
            <span className="lobby-server-state"><i /> SERVIDOR ESTABLE</span>
            <button onClick={logout} className="btn btn-ghost">Cerrar sesión</button>
          </div>
        </header>

        <div className="virtual-credit-banner" role="note">
          Tu saldo y cada movimiento quedan registrados en el historial de la plataforma.
        </div>

        <div className="lobby-grid">
          <aside className="lobby-sidebar">
            <WalletCard refreshKey={walletRefreshKey} />
            <section className="card player-summary-card">
              <p className="eyebrow">TU PROGRESO</p>
              <dl>
                <div><dt>Partidas</dt><dd>{profile.partidas_jugadas || 0}</dd></div>
                <div><dt>Victorias</dt><dd>{profile.partidas_ganadas || 0}</dd></div>
                <div><dt>Racha</dt><dd>{profile.racha_actual || 0} 🔥</dd></div>
                <div><dt>Puntos</dt><dd>{profile.puntos || 0}</dd></div>
              </dl>
            </section>
            <section className="card player-history-card">
              <p className="eyebrow">PARTIDAS RECIENTES</p>
              {history.length === 0 ? <p className="history-empty">Aún no has jugado una partida online.</p> : (
                <div className="player-history-list">
                  {history.map(match => (
                    <div className="player-history-row" key={match.id}>
                      <span className={match.won ? "history-win" : "history-loss"}>{match.won ? "Victoria" : "Derrota"}</span>
                      <span>{match.mode === "batalla" ? "Batalla" : "Duelo"}</span>
                      <strong>{match.won ? `+${formatSoles(match.prize)}` : formatSoles(match.stake)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>

          <section className="arena-section" aria-labelledby="arena-heading">
            <div className="section-heading">
              <div><p className="eyebrow">ELIGE TU DESAFÍO</p><h2 id="arena-heading">Arenas disponibles</h2></div>
              <span className="status-chip">SERVIDOR ACTIVO</span>
            </div>

            {matchError && <div className="match-error" role="alert">{matchError}</div>}
            {queueActive && (
              <section className="card queue-card" aria-live="polite">
                <div className="queue-die" aria-hidden="true">🎲</div>
                <div>
                  <p className="eyebrow">MATCHMAKING</p>
                  <h3>{matchStatus === "cancelando" ? "Cancelando búsqueda…" : matchStatus === "uniendo" ? "Entrando a la cola…" : "Buscando rival compatible…"}</h3>
                  <p>Mantén esta pantalla abierta. Recuperaremos tu partida si pierdes conexión.</p>
                  {maximumRange && !continueWaiting && <p>Alcanzaste el rango máximo de búsqueda. Puedes seguir esperando o cancelar.</p>}
                </div>
                {maximumRange && !continueWaiting && <button className="btn btn-secondary" onClick={()=>setContinueWaiting(true)}>Seguir esperando</button>}
                <button className="btn btn-ghost" onClick={cancelQueue} disabled={matchStatus !== "buscando"}>Cancelar</button>
              </section>
            )}

            {!queueActive && (
              <div className="arena-grid">
                <article className="card arena-card arena-card-featured">
                  <span className="arena-ribbon">RECOMENDADO</span>
                  <div className="arena-card-media">
                    <Image src="/scene_winner.webp" alt="Arena de duelo" fill sizes="(max-width: 900px) 100vw, 38vw" />
                    <span className="arena-mode-sigil" aria-hidden="true">⚔</span>
                    <span className="arena-activity"><i /> DUELOS ABIERTOS</span>
                  </div>
                  <p className="eyebrow">2 JUGADORES</p>
                  <h3>Duelo salvaje</h3>
                  <p>Una tirada por jugador. El valor más alto conquista el premio.</p>
                  <dl><div><dt>Entrada</dt><dd>{formatSoles(10)}</dd></div><div><dt>Recompensa</dt><dd>{formatSoles(16)}</dd></div></dl>
                  <button className="btn btn-primary" onClick={() => joinQueue("duelo", 10)}>BUSCAR RIVAL</button>
                </article>

                <article className="card arena-card">
                  <div className="arena-card-media">
                    <Image src="/arena_topdown.webp" alt="Arena de batalla" fill sizes="(max-width: 900px) 100vw, 38vw" />
                    <span className="arena-mode-sigil arena-mode-sigil-battle" aria-hidden="true">✦</span>
                    <span className="arena-activity"><i /> BATALLA MASIVA</span>
                  </div>
                  <p className="eyebrow">10 JUGADORES</p>
                  <h3>Batalla salvaje</h3>
                  <p>Una arena masiva para jugadores que buscan el desafío más grande.</p>
                  <dl><div><dt>Entrada</dt><dd>{formatSoles(20)}</dd></div><div><dt>Recompensa</dt><dd>{formatSoles(160)}</dd></div></dl>
                  <button className="btn btn-secondary" onClick={() => joinQueue("batalla", 20)}>ENTRAR A BATALLA</button>
                </article>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
