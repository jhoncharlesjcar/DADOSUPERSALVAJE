import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getDatabase } from "@/lib/data/database";
import { routeError } from "@/lib/data/http";
/** Historical raw records have no fabricated fairness proof and never enter modern accounting. */
export async function GET(request:Request) {
  try {
    await requireAdmin();
    const params=new URL(request.url).searchParams,table=params.get("table") || "partidas",offset=Number(params.get("offset") || "0");
    if(!["partidas","transacciones","online_partidas"].includes(table) || !Number.isSafeInteger(offset) || offset<0) throw new Error("Consulta inválida");
    const rows=(await getDatabase().query("SELECT importacion_id,tabla,fila,datos FROM archivo_legacy WHERE tabla=$1 ORDER BY importacion_id,fila LIMIT 100 OFFSET $2",[table,offset])).rows;
    return NextResponse.json({rows,nextOffset:rows.length===100?offset+100:null},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { return routeError(error); }
}
