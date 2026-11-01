import { Validators, registrarJugadorEnTransaccion } from "@/lib/db";
import { getDatabase } from "@/lib/data/database";
import { adjustDemoBalance } from "@/lib/data/ledger";
import { solesToCents } from "@/lib/data/money";
import { getWallet, walletIsDemo } from "@/lib/wallet";
import { requireAdmin } from "@/lib/adminAuth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try { await requireAdmin(); } catch { return NextResponse.json({error:"No autorizado"},{status:401}); }
  try {
    const body=await request.json();
    const dni=String(body.dni || "").trim(),nombres=String(body.nombres || "").trim(),celular=String(body.celular || "").trim(),codigo=String(body.codigo_yapeo || "").trim();
    if(!Validators.dni(dni) || nombres.length<2 || nombres.length>100 || celular.length>30 || codigo.length>100) return NextResponse.json({error:"Datos de jugador inválidos"},{status:400});
    // The legacy operator form assigns demo credits only. A receipt is never evidence of a real payment.
    if(codigo && !walletIsDemo()) return NextResponse.json({error:"Las recargas reales requieren confirmación de la pasarela"},{status:403});
    const amount=codigo ? solesToCents(body.monto_yapeo) : 0n;
    if(codigo && amount<=0n) return NextResponse.json({error:"Monto inválido"},{status:400});
    await getDatabase().transaction(async client=>{
      const userId=await registrarJugadorEnTransaccion(client,dni,nombres,celular);
      if(amount>0n) await adjustDemoBalance(client,userId,amount,`creditos-demo:${codigo}`,"Asignación virtual del operador","admin");
    });
    const wallet=await getWallet(dni);
    return NextResponse.json({ok:true,saldo_real:wallet?.saldo_real ?? 0,disponible_centimos:wallet?.disponible_centimos ?? "0",demo:walletIsDemo()});
  } catch { return NextResponse.json({error:"No se pudo registrar el jugador o la referencia ya se utilizó con otros datos"},{status:400}); }
}
