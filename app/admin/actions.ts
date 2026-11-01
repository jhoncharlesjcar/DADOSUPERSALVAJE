"use server";
import { getDatabase } from "@/lib/data/database";
import { adjustDemoBalance, audit } from "@/lib/data/ledger";
import { solesToCents } from "@/lib/data/money";
import { walletIsDemo } from "@/lib/wallet";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { hashPin,isValidPin } from "@/lib/playerAuth";

export async function updateBalance(dni: string,amount: number,isAdd: boolean,idempotencyKey: string) {
  try {
    await requireAdmin();
    if(!walletIsDemo()) throw new Error("Solo se permiten ajustes manuales de saldo demo");
    if(!/^\d{8}$/.test(dni) || !/^[a-zA-Z0-9_-]{16,100}$/.test(idempotencyKey)) throw new Error("Datos inválidos");
    const value=solesToCents(amount);
    if(value<=0n) throw new Error("Monto inválido");
    await getDatabase().transaction(async client=>{
      const user=(await client.query<{id:string}>("SELECT id FROM usuarios WHERE dni=$1",[dni])).rows[0];
      if(!user) throw new Error("Jugador no encontrado");
      await adjustDemoBalance(client,user.id,isAdd ? value : -value,`admin:${idempotencyKey}`,"Ajuste manual de saldo demo","admin");
    });
    revalidatePath("/admin");
    return {success:true};
  } catch(error) { return {success:false,error:error instanceof Error ? error.message : "No se pudo ajustar el saldo"}; }
}
export async function setPlayerPin(dni: string,pin: string) {
  try {
    await requireAdmin();
    if(!/^\d{8}$/.test(dni) || !isValidPin(pin)) throw new Error("DNI o PIN inválido");
    const pinHash=hashPin(pin);
    await getDatabase().transaction(async client=>{
      const result=await client.query<{id:string}>("UPDATE usuarios SET pin_hash=$1 WHERE dni=$2 RETURNING id",[pinHash,dni]);
      if(result.rowCount!==1) throw new Error("Jugador no encontrado");
      await audit(client,"admin","cambio_pin","usuario",result.rows[0].id);
    });
    revalidatePath("/admin");
    return {success:true};
  } catch(error) { return {success:false,error:error instanceof Error ? error.message : "No se pudo actualizar el PIN"}; }
}
export async function deleteTransaction(_id: number | string) {
  try {
    await requireAdmin();
    return {success:false,error:"El libro financiero es inmutable. Registra una operación de reversión."};
  } catch { return {success:false,error:"No autorizado"}; }
}
