import "server-only";
import { getDatabase } from "./data/database";
import { displaySoles, splitPot } from "./data/money";

export function walletIsDemo() { return process.env.DINERO_REAL_HABILITADO !== "true"; }
export interface WalletInfo {
  id: string; dni: string; demo: boolean; disponible_centimos: string; bloqueado_centimos: string; bono_centimos: string;
  saldo_real: number; saldo_bono: number; moneda_ingame: number; version: number;
}
export async function getWallet(dni: string): Promise<WalletInfo | null> {
  const result = await getDatabase().query<Omit<WalletInfo,"saldo_real"|"saldo_bono">>(`SELECT b.id,u.dni,b.demo,
    b.disponible_centimos::text,b.bloqueado_centimos::text,b.bono_centimos::text,b.moneda_ingame,b.version
    FROM billeteras b JOIN usuarios u ON u.id=b.usuario_id WHERE u.dni=$1 AND b.demo=$2`,[dni,walletIsDemo()]);
  const row = result.rows[0];
  return row ? {...row,saldo_real:displaySoles(row.disponible_centimos),saldo_bono:displaySoles(row.bono_centimos)} : null;
}
export async function inicializarWallet(dni: string) {
  await getDatabase().query(`INSERT INTO billeteras(usuario_id,demo) SELECT u.id,d.demo FROM usuarios u
    CROSS JOIN (VALUES(true),(false)) d(demo) WHERE u.dni=$1 ON CONFLICT(usuario_id,demo) DO NOTHING`,[dni]);
}
export function calcularDistribucion(pozoCentimos: bigint, ganadores = 1) {
  if(typeof pozoCentimos !== "bigint") throw new Error("Pozo inválido");
  const split = splitPot(pozoCentimos,ganadores);
  return {premioJugador:split.prize,gananciaRanking:split.ranking,gananciaCasa:split.house,premioPorGanador:split.each};
}
