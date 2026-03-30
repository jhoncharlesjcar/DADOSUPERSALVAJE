import Database from "better-sqlite3";
import path from "path";

let db = null;

export function getDB() {
  if (!db) {
    const dbPath = path.join(process.cwd(), "database.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    initDB(db);
  }
  return db;
}

function initDB(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jugadores (
      dni TEXT PRIMARY KEY,
      nombres TEXT NOT NULL,
      celular TEXT,
      codigo_yapeo TEXT,
      puntos INTEGER DEFAULT 0,
      partidas_jugadas INTEGER DEFAULT 0,
      partidas_ganadas INTEGER DEFAULT 0,
      total_ganado REAL DEFAULT 0,
      creado DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
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
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
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
  `);

  // Ensure the single row exists
  const row = db.prepare("SELECT id FROM estado_live WHERE id = 1").get();
  if (!row) {
    db.prepare(
      "INSERT INTO estado_live (id) VALUES (1)"
    ).run();
  }
}

// ========= LIVE STATE HELPERS =========

export function getLiveState() {
  const db = getDB();
  const row = db.prepare("SELECT * FROM estado_live WHERE id = 1").get();
  if (!row) return null;

  // Get ranking
  const ranking = db
    .prepare(
      "SELECT dni, nombres, puntos, partidas_ganadas, partidas_jugadas, total_ganado FROM jugadores WHERE puntos > 0 ORDER BY puntos DESC LIMIT 10"
    )
    .all();

  return {
    jugadores: JSON.parse(row.jugadores_json || "[]"),
    monto: row.monto,
    pozo: row.pozo,
    ganador: JSON.parse(row.ganador_json || "null"),
    resultado: JSON.parse(row.resultado_json || "null"),
    fase: row.fase,
    countdown: row.countdown,
    ranking,
    updated_at: row.updated_at,
  };
}

export function updateLiveState(updates) {
  const db = getDB();
  const sets = [];
  const values = [];

  if (updates.jugadores !== undefined) {
    sets.push("jugadores_json = ?");
    values.push(JSON.stringify(updates.jugadores));
  }
  if (updates.monto !== undefined) {
    sets.push("monto = ?");
    values.push(updates.monto);
  }
  if (updates.pozo !== undefined) {
    sets.push("pozo = ?");
    values.push(updates.pozo);
  }
  if (updates.ganador !== undefined) {
    sets.push("ganador_json = ?");
    values.push(JSON.stringify(updates.ganador));
  }
  if (updates.resultado !== undefined) {
    sets.push("resultado_json = ?");
    values.push(JSON.stringify(updates.resultado));
  }
  if (updates.fase !== undefined) {
    sets.push("fase = ?");
    values.push(updates.fase);
  }
  if (updates.countdown !== undefined) {
    sets.push("countdown = ?");
    values.push(updates.countdown);
  }

  sets.push("updated_at = CURRENT_TIMESTAMP");

  if (sets.length > 0) {
    db.prepare(`UPDATE estado_live SET ${sets.join(", ")} WHERE id = 1`).run(
      ...values
    );
  }
}
