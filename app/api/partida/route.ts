import { getDB, actualizarRachaGanador, registrarTransaccion, getEstadisticasGlobales, Validators } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { GameEngine } from "@/lib/gameEngine";
import { distribuirPremio } from "@/lib/wallet";
import { readManualMatch } from "@/lib/manualArena";
import { latestRolls, validateMatch } from "@/lib/arena/types";
import { NextResponse, NextRequest } from "next/server";
import { Player, LevelUp } from "@/types";

function dashboardPayload(db: ReturnType<typeof getDB>) {
  return {
    ranking: db.prepare(`SELECT dni, nombres, puntos, partidas_ganadas, partidas_jugadas, total_ganado, racha_actual, mejor_racha, titulo FROM jugadores WHERE puntos > 0 ORDER BY puntos DESC LIMIT 20`).all(),
    stats: getEstadisticasGlobales(),
    historial: db.prepare("SELECT * FROM partidas ORDER BY fecha DESC LIMIT 20").all(),
  };
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const idempotencyKey = String(body.idempotencyKey || "");
    const match = readManualMatch(idempotencyKey);
    if (!match || !validateMatch(match)) return NextResponse.json({ error: "La partida no tiene una tirada confirmada" }, { status: 409 });
    const jugadores = match.players.map(p => ({ dni: p.id, nombres: p.name, dadoId: p.dadoId }));
    const dnis = jugadores.map(p => p.dni);
    const resultados = latestRolls(match).map(roll => ({ ...jugadores.find(p => p.dni === roll.playerId)!, valor: roll.value }));
    const winner = resultados.find(p => p.dni === match.winnerId)!;
    const db = getDB();
    const charges = dnis.map(dni => db.prepare("SELECT monto FROM transacciones WHERE referencia = ? AND tipo = 'egreso'")
      .get(`manual:${idempotencyKey}:stake:${dni}`) as { monto: number } | undefined);
    const monto = charges[0]?.monto || 0;
    if (!Validators.monto(monto) || charges.some(charge => charge?.monto !== monto)) throw new Error("Cobros de partida inconsistentes");
    const pozo = monto * jugadores.length;
    let levelUpInfo: LevelUp | null = null;

    const settlement = db.transaction(() => {
      const existing = db.prepare("SELECT id FROM partidas WHERE external_id = ?").get(idempotencyKey) as { id: number } | undefined;
      if (existing) return { id: existing.id, replay: true };

      const { premioJugador } = distribuirPremio(winner.dni, pozo);
      const insert = db.prepare(`
        INSERT INTO partidas
          (external_id, modo, monto, pozo, ganador_dni, ganador_nombre, premio, jugadores_json, resultados_json, duracion_ms, hubo_empate, rondas_empate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        idempotencyKey,
        String(body.modo || "normal").slice(0, 30),
        monto,
        pozo,
        winner.dni,
        winner.nombres,
        premioJugador,
        JSON.stringify(jugadores),
        JSON.stringify(resultados),
        Math.max(0, Math.min(Number(body.duracion_ms) || 0, 60 * 60 * 1000)),
        match.rounds.length > 1 ? 1 : 0,
        match.rounds.length - 1
      );

      const updatePlayed = db.prepare("UPDATE jugadores SET partidas_jugadas = partidas_jugadas + 1 WHERE dni = ?");
      for (const dni of dnis) {
        if (updatePlayed.run(dni).changes !== 1) throw new Error(`Jugador ${dni} no encontrado`);
      }

      const player = db.prepare("SELECT puntos FROM jugadores WHERE dni = ?").get(winner.dni) as Pick<Player, "puntos">;
      const evolution = GameEngine.calculateEvolution(winner.dni, pozo, player.puntos, jugadores.length);
      levelUpInfo = evolution.levelUp || {
        puntosGanados: evolution.puntosGanados,
        puntosTotal: player.puntos + evolution.puntosGanados,
        rachaActual: 1,
        puntosAntes: player.puntos,
        puntosNuevos: player.puntos + evolution.puntosGanados,
      };

      db.prepare(`
        UPDATE jugadores SET puntos = puntos + ?, partidas_ganadas = partidas_ganadas + 1,
          total_ganado = total_ganado + ? WHERE dni = ?
      `).run(evolution.puntosGanados, premioJugador, winner.dni);
      actualizarRachaGanador(winner.dni, dnis);
      const streak = db.prepare("SELECT racha_actual FROM jugadores WHERE dni = ?").get(winner.dni) as { racha_actual: number };
      if (levelUpInfo) levelUpInfo.rachaActual = streak.racha_actual;
      registrarTransaccion(winner.dni, `Premio partida manual #${insert.lastInsertRowid}`, "ingreso", premioJugador, `manual:${idempotencyKey}:payout`);

      return { id: Number(insert.lastInsertRowid), replay: false };
    }).immediate();

    const updatedBalances = db.prepare(`
      SELECT w.dni, w.saldo_real FROM wallet w WHERE w.dni IN (${dnis.map(() => "?").join(",")})
    `).all(...dnis);

    return NextResponse.json({
      ok: true,
      id: settlement.id,
      replay: settlement.replay,
      levelUp: settlement.replay ? null : levelUpInfo,
      updatedBalances,
      match,
      ...dashboardPayload(db),
    });
  } catch (error) {
    console.error("Error saving partida:", error);
    const message = error instanceof Error ? error.message : "Error al guardar partida";
    const status = message === "No autorizado" ? 401 : 400;
    return NextResponse.json({ error: status === 401 ? "No autorizado" : message }, { status });
  }
}

export async function GET() {
  try {
    await requireAdmin();
    const db = getDB();
    return NextResponse.json(db.prepare("SELECT * FROM partidas ORDER BY fecha DESC LIMIT 20").all());
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}
