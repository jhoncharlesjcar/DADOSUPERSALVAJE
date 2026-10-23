import { resolveArena } from "./resolveArena";
import { latestRolls } from "./arena/types";
import { DADOS_DISPONIBLES } from "./dados";
import { getDB, Validators } from "./db";
import { distribuirPremio } from "./wallet";
import { GameEngine } from "./gameEngine";

export interface MatchmakingEntry {
  id: number;
  dni: string;
  modo: string;
  monto: number;
  estado: string;
  joined_at: string;
}

const PLAYERS_BY_MODE: Record<string, number> = { duelo: 2, batalla: 10 };

export function leaveQueue(dni: string) {
  if (!Validators.dni(dni)) return;
  getDB().prepare("DELETE FROM matchmaking_queue WHERE dni = ?").run(dni);
}

export function joinQueue(dni: string, modo: string, monto: number) {
  if (!Validators.dni(dni) || !(modo in PLAYERS_BY_MODE) || !Validators.monto(monto)) {
    throw new Error("Parámetros de matchmaking inválidos");
  }

  const db = getDB();
  return db.transaction(() => {
    const player = db.prepare(`
      SELECT j.dni, w.saldo_real FROM jugadores j
      JOIN wallet w ON w.dni = j.dni WHERE j.dni = ?
    `).get(dni) as { dni: string; saldo_real: number } | undefined;
    if (!player) throw new Error("Jugador no registrado");
    if (player.saldo_real < monto) throw new Error("Saldo insuficiente");

    db.prepare("DELETE FROM matchmaking_queue WHERE joined_at < datetime('now', '-15 minutes')").run();
    db.prepare(`
      INSERT INTO matchmaking_queue (dni, modo, monto, estado, joined_at)
      VALUES (?, ?, ?, 'esperando', CURRENT_TIMESTAMP)
      ON CONFLICT(dni) DO UPDATE SET modo = excluded.modo, monto = excluded.monto,
        estado = 'esperando', joined_at = CURRENT_TIMESTAMP
    `).run(dni, modo, monto);

    return checkMatchmaking(modo, monto);
  }).immediate();
}

export function checkMatchmaking(modo: string, monto: number): number | null {
  const db = getDB();
  const requiredPlayers = PLAYERS_BY_MODE[modo];
  if (!requiredPlayers) throw new Error("Modo no permitido");

  return db.transaction(() => {
    const waiting = db.prepare(`
      SELECT q.* FROM matchmaking_queue q
      JOIN wallet w ON w.dni = q.dni
      WHERE q.modo = ? AND q.monto = ? AND q.estado = 'esperando' AND w.saldo_real >= q.monto
      ORDER BY q.joined_at ASC LIMIT ?
    `).all(modo, monto, requiredPlayers) as MatchmakingEntry[];
    if (waiting.length < requiredPlayers) return null;

    const dnis = waiting.map(entry => entry.dni);
    const placeholders = dnis.map(() => "?").join(",");

    const countCheck = db.prepare(
      `SELECT COUNT(*) AS total FROM matchmaking_queue WHERE dni IN (${placeholders}) AND estado = 'esperando'`
    ).get(...dnis) as { total: number };
    if (countCheck.total !== requiredPlayers) return null;

    const playerRows = db.prepare(`SELECT dni, nombres, puntos FROM jugadores WHERE dni IN (${placeholders})`).all(...dnis) as Array<{ dni: string; nombres: string; puntos: number }>;
    const byDni = new Map(playerRows.map(player => [player.dni, player]));

    const room = db.prepare(`
      INSERT INTO salas (modo, monto, estado, jugadores_json)
      VALUES (?, ?, 'finalizada', ?)
    `).run(modo, monto, JSON.stringify(dnis));
    const roomId = Number(room.lastInsertRowid);

    const charge = db.prepare("UPDATE wallet SET saldo_real = saldo_real - ? WHERE dni = ? AND saldo_real >= ?");
    const syncLegacy = db.prepare("UPDATE jugadores SET monto_yapeo = (SELECT saldo_real FROM wallet WHERE dni = ?) WHERE dni = ?");
    const log = db.prepare(`INSERT INTO transacciones (dni, operacion, tipo, monto, referencia) VALUES (?, ?, ?, ?, ?)`);
    for (const playerDni of dnis) {
      if (charge.run(monto, playerDni, monto).changes !== 1) throw new Error("Saldo insuficiente durante el emparejamiento");
      syncLegacy.run(playerDni, playerDni);
      log.run(playerDni, `Entrada virtual sala #${roomId}`, "egreso", monto, `online:${roomId}:stake:${playerDni}`);
    }

    const replay = resolveArena(`online:${roomId}`, dnis.map((dni, i) => ({
      id: dni, name: byDni.get(dni)?.nombres || "Jugador", dadoId: DADOS_DISPONIBLES[i].id,
    })));
    const winnerDni = replay.winnerId;
    const totalRounds = replay.rounds.length;
    const resultados = latestRolls(replay).map(roll => ({
      dni: roll.playerId, nombres: byDni.get(roll.playerId)?.nombres || "Jugador", valor: roll.value,
    }));
    const winner = resultados.find(result => result.dni === winnerDni)!;
    const pozo = monto * dnis.length;
    const { premioJugador } = distribuirPremio(winner.dni, pozo);
    log.run(winner.dni, `Premio online sala #${roomId}`, "ingreso", premioJugador, `online:${roomId}:payout`);

    db.prepare(`
      INSERT INTO online_partidas (sala_id, ganador_json, resultados_json, replay_json, estado)
      VALUES (?, ?, ?, ?, 'completada')
    `).run(roomId, JSON.stringify(winner), JSON.stringify(resultados), JSON.stringify(replay));

    db.prepare(`
      INSERT INTO partidas
        (external_id, modo, monto, pozo, ganador_dni, ganador_nombre, premio, jugadores_json, resultados_json, hubo_empate, rondas_empate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `online:${roomId}`, `online-${modo}`, monto, pozo, winner.dni, winner.nombres, premioJugador,
      JSON.stringify(playerRows), JSON.stringify(resultados), totalRounds > 1 ? 1 : 0, totalRounds - 1
    );

    db.prepare(`UPDATE jugadores SET partidas_jugadas = partidas_jugadas + 1 WHERE dni IN (${placeholders})`).run(...dnis);
    const winnerPlayer = byDni.get(winner.dni);
    const points = GameEngine.calculateEvolution(winner.dni, pozo, winnerPlayer?.puntos || 0, dnis.length).puntosGanados;
    db.prepare(`UPDATE jugadores SET puntos = puntos + ?, partidas_ganadas = partidas_ganadas + 1,
      total_ganado = total_ganado + ?, racha_actual = racha_actual + 1,
      mejor_racha = MAX(mejor_racha, racha_actual + 1) WHERE dni = ?`
    ).run(points, premioJugador, winner.dni);
    const losers = dnis.filter(playerDni => playerDni !== winner.dni);
    if (losers.length) db.prepare(`UPDATE jugadores SET racha_actual = 0 WHERE dni IN (${losers.map(() => "?").join(",")})`).run(...losers);

    db.prepare(`DELETE FROM matchmaking_queue WHERE dni IN (${placeholders})`).run(...dnis);
    return roomId;
  }).immediate();
}

export function getMatchStatus(dni: string) {
  if (!Validators.dni(dni)) throw new Error("DNI inválido");
  const db = getDB();
  if (db.prepare("SELECT 1 FROM matchmaking_queue WHERE dni = ?").get(dni)) return { status: "buscando" };

  const rooms = db.prepare(`
    SELECT s.* FROM salas s
    WHERE s.creada >= datetime('now', '-30 minutes')
      AND NOT EXISTS (
        SELECT 1 FROM online_room_views v WHERE v.sala_id = s.id AND v.dni = ?
      )
    ORDER BY s.id DESC LIMIT 100
  `).all(dni) as Array<{ id: number; modo: string; jugadores_json: string }>;
  const room = rooms.find(candidate => {
    try { return (JSON.parse(candidate.jugadores_json) as string[]).includes(dni); }
    catch { return false; }
  });
  return room ? { status: "encontrada", salaId: room.id, modo: room.modo } : { status: "inactivo" };
}
