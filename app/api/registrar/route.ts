import { Validators, registrarJugadorSeguro, getDB } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";
import { NextResponse, NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const dni = String(body.dni || "").trim();
    const nombres = String(body.nombres || "").trim();
    const celular = String(body.celular || "").trim();
    const codigoYapeo = String(body.codigo_yapeo || "").trim();
    const monto = Number(body.monto_yapeo || 0);

    if (!Validators.dni(dni)) {
      return NextResponse.json({ error: "DNI debe tener 8 dígitos numéricos" }, { status: 400 });
    }
    if (nombres.length < 2 || nombres.length > 100 || celular.length > 30 || codigoYapeo.length > 100) {
      return NextResponse.json({ error: "Datos de jugador inválidos" }, { status: 400 });
    }

    const tieneDeposito = codigoYapeo.length > 0;
    if (tieneDeposito && (!Number.isFinite(monto) || monto <= 0 || monto > 10000 || !Number.isInteger(monto * 100))) {
      return NextResponse.json({ error: "Monto en soles inválido" }, { status: 400 });
    }

    const db = getDB();
    const wallet = db.transaction(() => {
      registrarJugadorSeguro(dni, nombres, celular, codigoYapeo);

      if (tieneDeposito) {
        const referencia = `creditos:${codigoYapeo}`;
        const transaction = db.prepare(`
          INSERT OR IGNORE INTO transacciones (dni, operacion, tipo, monto, referencia)
          VALUES (?, ?, 'ingreso', ?, ?)
        `).run(dni, `Asignación virtual ${codigoYapeo}`, monto, referencia);

        if (transaction.changes === 1) {
          db.prepare("UPDATE wallet SET saldo_real = ? WHERE dni = ?").run(monto, dni);
          db.prepare("UPDATE jugadores SET monto_yapeo = ? WHERE dni = ?").run(monto, dni);
        } else {
          // La referencia ya existía: de todas formas reemplazamos el saldo
          db.prepare("UPDATE wallet SET saldo_real = ? WHERE dni = ?").run(monto, dni);
          db.prepare("UPDATE jugadores SET monto_yapeo = ? WHERE dni = ?").run(monto, dni);
        }
      }

      return db.prepare("SELECT saldo_real FROM wallet WHERE dni = ?").get(dni) as { saldo_real: number };
    })();

    return NextResponse.json({ ok: true, saldo_real: wallet.saldo_real });
  } catch (error) {
    console.error("Error al registrar jugador:", error);
    const status = error instanceof Error && error.message === "No autorizado" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "No autorizado" : "Error al registrar jugador" }, { status });
  }
}
