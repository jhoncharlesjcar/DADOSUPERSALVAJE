"use server";

import { getDB } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { hashPin, isValidPin } from "@/lib/playerAuth";

export async function updateBalance(dni: string, amount: number, isAdd: boolean) {
  try {
    await requireAdmin();
    
    if (!amount || amount <= 0 || !Number.isInteger(amount * 100)) {
      throw new Error("Monto inválido");
    }

    const db = getDB();
    const operacion = isAdd ? "Asignación manual de saldo" : "Ajuste manual de saldo";
    const tipo = isAdd ? "ingreso" : "egreso";
    
    db.transaction(() => {
      const wallet = db.prepare("SELECT saldo_real FROM wallet WHERE dni = ?").get(dni) as { saldo_real: number } | undefined;
      if (!wallet) throw new Error("Jugador o billetera no encontrados");
      if (!isAdd && wallet.saldo_real < amount) throw new Error("Saldo insuficiente");

      const delta = isAdd ? amount : -amount;
      db.prepare("UPDATE wallet SET saldo_real = saldo_real + ? WHERE dni = ?").run(delta, dni);
      db.prepare("UPDATE jugadores SET monto_yapeo = monto_yapeo + ? WHERE dni = ?").run(delta, dni);
      
      db.prepare(`
        INSERT INTO transacciones (dni, operacion, tipo, monto)
        VALUES (?, ?, ?, ?)
      `).run(dni, operacion, tipo, amount);
    })();
  
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating balance:", error);
    return { success: false, error: error.message };
  }
}

export async function setPlayerPin(dni: string, pin: string) {
  try {
    await requireAdmin();
    if (!/^\d{8}$/.test(dni) || !isValidPin(pin)) throw new Error("DNI o PIN inválido");
    const result = getDB().prepare("UPDATE jugadores SET pin_hash = ? WHERE dni = ?").run(hashPin(pin), dni);
    if (result.changes !== 1) throw new Error("Jugador no encontrado");
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo actualizar el PIN" };
  }
}

export async function deleteTransaction(id: number) {
  try {
    await requireAdmin();

    return { success: false, error: "El libro financiero es inmutable. Registra una operación de reversión." };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
