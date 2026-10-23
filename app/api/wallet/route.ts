import { NextResponse } from "next/server";
import { getWallet } from "@/lib/wallet";
import { requirePlayer } from "@/lib/playerAuth";
import { isOnlineModeEnabled } from "@/lib/onlineMode";

export async function GET() {
  if (!isOnlineModeEnabled()) return NextResponse.json({ error: "Modo online temporalmente no disponible" }, { status: 503 });
  try {
    const dni = await requirePlayer();
    const wallet = getWallet(dni);
    if (!wallet) return NextResponse.json({ error: "Billetera no encontrada" }, { status: 404 });
    return NextResponse.json({
      creditos: wallet.saldo_real,
      creditos_bono: wallet.saldo_bono,
      gemas: wallet.moneda_ingame,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
}
