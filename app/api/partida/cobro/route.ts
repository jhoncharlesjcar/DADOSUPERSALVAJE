import { getDB, Validators } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { NextResponse, NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const { dnis, monto, idempotencyKey } = await request.json();
    const uniqueDnis = Array.isArray(dnis) ? [...new Set(dnis.map(String))] : [];

    if (
      !Array.isArray(dnis) || dnis.length < 2 || dnis.length > 10 || uniqueDnis.length !== dnis.length ||
      !uniqueDnis.every(Validators.dni) || !Validators.monto(Number(monto)) ||
      typeof idempotencyKey !== "string" || !/^[a-zA-Z0-9_-]{16,100}$/.test(idempotencyKey)
    ) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const db = getDB();
    const result = db.transaction(() => {
      const references = uniqueDnis.map(dni => `manual:${idempotencyKey}:stake:${dni}`);
      const prefix = `manual:${idempotencyKey}:stake:`;
      const existing = db.prepare("SELECT referencia, monto FROM transacciones WHERE substr(referencia, 1, ?) = ? AND tipo = 'egreso'")
        .all(prefix.length, prefix) as Array<{ referencia: string; monto: number }>;
      if (existing.length) {
        if (existing.length !== references.length || existing.some(row => !references.includes(row.referencia) || row.monto !== Number(monto))) {
          throw new Error("Este identificador ya tiene otros participantes o monto");
        }
        return { replay: true };
      }

      const getPlayer = db.prepare(`
        SELECT j.nombres, w.saldo_real
        FROM jugadores j JOIN wallet w ON w.dni = j.dni
        WHERE j.dni = ?
      `);
      const chargeWallet = db.prepare("UPDATE wallet SET saldo_real = saldo_real - ? WHERE dni = ? AND saldo_real >= ?");
      const chargeLegacy = db.prepare("UPDATE jugadores SET monto_yapeo = (SELECT saldo_real FROM wallet WHERE dni = ?) WHERE dni = ?");
      const logCharge = db.prepare(`
        INSERT INTO transacciones (dni, operacion, tipo, monto, referencia)
        VALUES (?, 'Entrada virtual de partida manual', 'egreso', ?, ?)
      `);

      for (const dni of uniqueDnis) {
        const player = getPlayer.get(dni) as { nombres: string; saldo_real: number } | undefined;
        if (!player) throw new Error(`Jugador con DNI ${dni} no encontrado`);
        if (player.saldo_real < Number(monto)) {
          throw new Error(`Saldo insuficiente para ${player.nombres}`);
        }
      }

      for (const dni of uniqueDnis) {
        if (chargeWallet.run(monto, dni, monto).changes !== 1) throw new Error("El saldo cambió durante el cobro");
        chargeLegacy.run(dni, dni);
        logCharge.run(dni, monto, `manual:${idempotencyKey}:stake:${dni}`);
      }
      return { replay: false };
    }).immediate();

    const balances = db.prepare(`SELECT dni, saldo_real FROM wallet WHERE dni IN (${uniqueDnis.map(() => "?").join(",")})`).all(...uniqueDnis);
    return NextResponse.json({ ok: true, replay: result.replay, balances });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error interno del servidor";
    const status = message === "No autorizado" ? 401 : 400;
    return NextResponse.json({ error: status === 401 ? "No autorizado" : message }, { status });
  }
}
