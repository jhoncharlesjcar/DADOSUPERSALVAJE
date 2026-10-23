import Database from "better-sqlite3";
import path from "path";

// Interfaces para tipado estricto
export interface Jugador {
  dni: string;
  nombres: string;
  celular?: string;
  codigo_yapeo?: string;
  monto_yapeo?: number;
  puntos: number;
  partidas_jugadas: number;
  partidas_ganadas: number;
  total_ganado: number;
  racha_actual: number;
  mejor_racha: number;
  titulo?: string;
  creado?: string;
}

export interface Partida {
  id?: number;
  modo: string;
  monto: number;
  pozo: number;
  ganador_dni: string;
  ganador_nombre: string;
  premio: number;
  jugadores_json: string;
  resultados_json: string;
  duracion_ms: number;
  hubo_empate: number;
  rondas_empate: number;
  fecha?: string;
}

import { Player, GameResult } from "@/types";

export interface LiveState {
  jugadores: Player[];
  monto: number;
  pozo: number;
  ganador: Player | null;
  resultado: GameResult | null;
  fase: string;
  countdown: number;
  ranking: Player[];
  updated_at: string;
}

export interface Transaccion {
  id: number;
  dni: string;
  nombres?: string;
  operacion: string;
  tipo: 'ingreso' | 'egreso';
  monto: number;
  fecha: string;
}

export interface EstadisticasGlobales {
  totalPartidas: number;
  totalDinero: string;
  totalJugadores: number;
  topGanador: { nombres: string; partidas_ganadas: number } | null;
  mejorRacha: { nombres: string; mejor_racha: number } | null;
  masJugadas: { nombres: string; partidas_jugadas: number } | null;
}

let db: Database.Database | null = null;

const DB_SCHEMA = `
    CREATE TABLE IF NOT EXISTS manual_rolls (
      match_id TEXT PRIMARY KEY,
      match_json TEXT NOT NULL,
      creada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS jugadores (
      dni TEXT PRIMARY KEY,
      nombres TEXT NOT NULL,
      celular TEXT,
      codigo_yapeo TEXT,
      monto_yapeo REAL DEFAULT 0,
      puntos INTEGER DEFAULT 0,
      partidas_jugadas INTEGER DEFAULT 0,
      partidas_ganadas INTEGER DEFAULT 0,
      total_ganado REAL DEFAULT 0,
      racha_actual INTEGER DEFAULT 0,
      mejor_racha INTEGER DEFAULT 0,
      titulo TEXT DEFAULT '',
      pin_hash TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      creado DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS partidas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      modo TEXT DEFAULT 'normal',
      monto INTEGER DEFAULT 10,
      pozo INTEGER DEFAULT 0,
      ganador_dni TEXT,
      ganador_nombre TEXT,
      premio REAL DEFAULT 0,
      jugadores_json TEXT,
      resultados_json TEXT,
      duracion_ms INTEGER DEFAULT 0,
      hubo_empate INTEGER DEFAULT 0,
      rondas_empate INTEGER DEFAULT 0,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS estado_live (
      id INTEGER PRIMARY KEY DEFAULT 1,
      jugadores_json TEXT DEFAULT '[]',
      monto INTEGER DEFAULT 10,
      pozo INTEGER DEFAULT 0,
      ganador_json TEXT DEFAULT 'null',
      resultado_json TEXT DEFAULT 'null',
      fase TEXT DEFAULT 'esperando',
      countdown INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transacciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dni TEXT NOT NULL,
      operacion TEXT,
      tipo TEXT, 
      monto REAL DEFAULT 0,
      referencia TEXT,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wallet (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dni TEXT NOT NULL UNIQUE,
      saldo_real REAL NOT NULL DEFAULT 0 CHECK (saldo_real >= 0),
      saldo_bono REAL NOT NULL DEFAULT 0 CHECK (saldo_bono >= 0),
      moneda_ingame INTEGER NOT NULL DEFAULT 0 CHECK (moneda_ingame >= 0),
      FOREIGN KEY (dni) REFERENCES jugadores(dni) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS matchmaking_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dni TEXT NOT NULL UNIQUE,
      modo TEXT NOT NULL CHECK (modo IN ('duelo', 'batalla')),
      monto INTEGER NOT NULL CHECK (monto IN (2, 5, 10, 20, 30, 40, 50, 100)),
      estado TEXT NOT NULL DEFAULT 'esperando',
      joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dni) REFERENCES jugadores(dni) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS salas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      modo TEXT NOT NULL,
      monto INTEGER NOT NULL,
      estado TEXT NOT NULL DEFAULT 'lista_para_iniciar',
      jugadores_json TEXT NOT NULL DEFAULT '[]',
      equipo_a_json TEXT,
      creada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS online_partidas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sala_id INTEGER NOT NULL UNIQUE,
      ganador_json TEXT NOT NULL,
      resultados_json TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'completada',
      creada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sala_id) REFERENCES salas(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS online_room_views (
      sala_id INTEGER NOT NULL,
      dni TEXT NOT NULL,
      viewed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (sala_id, dni),
      FOREIGN KEY (sala_id) REFERENCES salas(id) ON DELETE CASCADE,
      FOREIGN KEY (dni) REFERENCES jugadores(dni) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      lider_dni TEXT NOT NULL,
      miembros_json TEXT NOT NULL DEFAULT '[]',
      creado DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lider_dni) REFERENCES jugadores(dni) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rate_limit (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 1,
      reset_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_matchmaking_busqueda
      ON matchmaking_queue(modo, monto, estado, joined_at);
    CREATE INDEX IF NOT EXISTS idx_partidas_fecha ON partidas(fecha DESC);
    CREATE INDEX IF NOT EXISTS idx_rate_limit_reset ON rate_limit(reset_at);
`;

// Helper para manejo seguro de JSON
const JsonUtils = {
  parse: <T>(json: string, fallback: T): T => {
    try { return JSON.parse(json) || fallback; } 
    catch { return fallback; }
  },
  stringify: (obj: any): string => JSON.stringify(obj || {})
};

export function getDB(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH
      ? path.resolve(process.env.DATABASE_PATH)
      : path.join(process.cwd(), "database.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("wal_autocheckpoint = 100");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    initDB(db);
  }
  return db;
}

function initDB(db: Database.Database) {
  db.exec(DB_SCHEMA);

  // Migraciones Rápidas y Seed
  const row = db.prepare("SELECT id FROM estado_live WHERE id = 1").get();
  if (!row) db.prepare("INSERT INTO estado_live (id) VALUES (1)").run();

  // Asegurar columnas (envolviendo en try/catch silencioso para simplificar refactor)
  const safeAddColumn = (table: string, col: string, type: string) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch {}
  };

  safeAddColumn("jugadores", "racha_actual", "INTEGER DEFAULT 0");
  safeAddColumn("jugadores", "mejor_racha", "INTEGER DEFAULT 0");
  safeAddColumn("jugadores", "titulo", "TEXT DEFAULT ''");
  safeAddColumn("jugadores", "pin_hash", "TEXT");
  safeAddColumn("jugadores", "activo", "INTEGER NOT NULL DEFAULT 1");
  safeAddColumn("partidas", "duracion_ms", "INTEGER DEFAULT 0");
  safeAddColumn("partidas", "external_id", "TEXT");
  safeAddColumn("transacciones", "referencia", "TEXT");
  safeAddColumn("online_partidas", "replay_json", "TEXT");

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_partidas_external_id
      ON partidas(external_id) WHERE external_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_transacciones_referencia
      ON transacciones(referencia) WHERE referencia IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_matchmaking_dni ON matchmaking_queue(dni);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_online_partidas_sala ON online_partidas(sala_id);
    INSERT OR IGNORE INTO wallet (dni, saldo_real)
      SELECT dni, MAX(COALESCE(monto_yapeo, 0), 0) FROM jugadores;
  `);
  db.pragma("optimize");
}

// ========= VALIDATION & HELPERS =========

export const Validators = {
  dni: (dni: string) => /^\d{8}$/.test(dni?.trim() || ""),
  monto: (monto: number) => [2, 5, 10, 20, 30, 40, 50, 100].includes(Number(monto))
};

export const validarDNI = Validators.dni;

// ========= LIVE STATE =========

export function getLiveState(): LiveState | null {
  const db = getDB();
  const row = db.prepare("SELECT * FROM estado_live WHERE id = 1").get() as any;
  if (!row) return null;

  const ranking = db.prepare(`
    SELECT dni, nombres, puntos, partidas_ganadas, total_ganado, racha_actual, mejor_racha, titulo
    FROM jugadores WHERE puntos > 0 ORDER BY puntos DESC LIMIT 10
  `).all();

  return {
    jugadores: JsonUtils.parse(row.jugadores_json, []),
    monto: row.monto,
    pozo: row.pozo,
    ganador: JsonUtils.parse(row.ganador_json, null),
    resultado: JsonUtils.parse(row.resultado_json, null),
    fase: row.fase,
    countdown: row.countdown,
    ranking: ranking as Player[],
    updated_at: row.updated_at,
  };
}

export function updateLiveState(updates: Partial<Omit<LiveState, 'ranking' | 'updated_at'>>) {
  const db = getDB();
  const fields: string[] = [];
  const values: any[] = [];

  const mapField = (key: string, dbKey: string, isJson = false) => {
    if ((updates as any)[key] !== undefined) {
      fields.push(`${dbKey} = ?`);
      values.push(isJson ? JsonUtils.stringify((updates as any)[key]) : (updates as any)[key]);
    }
  };

  mapField('jugadores', 'jugadores_json', true);
  mapField('monto', 'monto');
  mapField('pozo', 'pozo');
  mapField('ganador', 'ganador_json', true);
  mapField('resultado', 'resultado_json', true);
  mapField('fase', 'fase');
  mapField('countdown', 'countdown');

  if (fields.length > 0) {
    values.push(1); // ID = 1
    db.prepare(`UPDATE estado_live SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
  }
}

// ========= PLAYER REGISTRATION (SAFE) =========

export function registrarJugadorSeguro(dni: string, nombres: string, celular?: string, codigoYapeo?: string, montoYapeo?: number | string) {
  const db = getDB();
  db.prepare(`
    INSERT INTO jugadores (dni, nombres, celular, codigo_yapeo, monto_yapeo)
    VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(dni) DO UPDATE SET
      nombres = excluded.nombres,
      celular = excluded.celular,
      codigo_yapeo = CASE
        WHEN excluded.codigo_yapeo != '' THEN excluded.codigo_yapeo
        ELSE jugadores.codigo_yapeo
      END
  `).run(dni, nombres, celular || "", codigoYapeo || "");
  db.prepare("INSERT OR IGNORE INTO wallet (dni) VALUES (?)").run(dni);
}

// ========= FINANCIAL AUDITING =========

export function registrarTransaccion(dni: string, operacion: string, tipo: 'ingreso' | 'egreso', monto: number, referencia?: string) {
  const db = getDB();
  db.prepare(`
    INSERT INTO transacciones (dni, operacion, tipo, monto, referencia)
    VALUES (?, ?, ?, ?, ?)
  `).run(dni, operacion, tipo, monto, referencia || null);
}

export function getReporteFinanciero() {
  const db = getDB();
  const ingresos = (db.prepare("SELECT SUM(monto) as total FROM transacciones WHERE tipo = 'ingreso'").get() as any)?.total || 0;
  const egresos = (db.prepare("SELECT SUM(monto) as total FROM transacciones WHERE tipo = 'egreso'").get() as any)?.total || 0;
  
  const history = db.prepare(`
    SELECT date(fecha) as dateStr, tipo, SUM(monto) as total 
    FROM transacciones 
    GROUP BY date(fecha), tipo 
    ORDER BY dateStr ASC
  `).all() as any[];

  return { ingresos, egresos, neta: ingresos - egresos, history };
}

export function getTodasTransacciones(): Transaccion[] {
  const db = getDB();
  return db.prepare("SELECT t.*, j.nombres FROM transacciones t LEFT JOIN jugadores j ON t.dni = j.dni ORDER BY t.fecha DESC LIMIT 500").all() as Transaccion[];
}

export function getTodosJugadores(): Jugador[] {
  const db = getDB();
  return db.prepare(`
    SELECT j.*, COALESCE(w.saldo_real, 0) AS saldo_real
    FROM jugadores j LEFT JOIN wallet w ON w.dni = j.dni
    ORDER BY j.puntos DESC, j.partidas_jugadas DESC
  `).all() as Jugador[];
}

// ========= STREAK TRACKING =========

export function actualizarRachaGanador(ganadorDni: string, jugadoresDnis: string[]) {
  const db = getDB();
  
  db.prepare(`
    UPDATE jugadores SET 
      racha_actual = racha_actual + 1,
      mejor_racha = MAX(mejor_racha, racha_actual + 1)
    WHERE dni = ?
  `).run(ganadorDni);

  const losers = jugadoresDnis.filter(d => d !== ganadorDni);
  if (losers.length > 0) {
    const placeholders = losers.map(() => "?").join(",");
    db.prepare(`UPDATE jugadores SET racha_actual = 0 WHERE dni IN (${placeholders})`).run(...losers);
  }
}

// ========= GLOBAL STATS =========

export function getEstadisticasGlobales(): EstadisticasGlobales {
  const db = getDB();
  
  const totalPartidas = (db.prepare("SELECT COUNT(*) as total FROM partidas").get() as any).total;
  const totalDinero = (db.prepare("SELECT COALESCE(SUM(premio), 0) as total FROM partidas").get() as any).total;
  const totalJugadores = (db.prepare("SELECT COUNT(*) as total FROM jugadores").get() as any).total;
  
  const topGanador = db.prepare(
    "SELECT nombres, partidas_ganadas FROM jugadores ORDER BY partidas_ganadas DESC LIMIT 1"
  ).get() as any;
  
  const mejorRacha = db.prepare(
    "SELECT nombres, mejor_racha FROM jugadores ORDER BY mejor_racha DESC LIMIT 1"
  ).get() as any;
  
  const masJugadas = db.prepare(
    "SELECT nombres, partidas_jugadas FROM jugadores ORDER BY partidas_jugadas DESC LIMIT 1"
  ).get() as any;

  return {
    totalPartidas,
    totalDinero: Number(totalDinero).toFixed(2),
    totalJugadores,
    topGanador: topGanador || null,
    mejorRacha: mejorRacha || null,
    masJugadas: masJugadas || null,
  };
}
