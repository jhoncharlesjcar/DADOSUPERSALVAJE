import "server-only";
import { NextResponse } from "next/server";
export function routeError(error: unknown) {
  const message=error instanceof Error ? error.message : "";
  if(message==="No autorizado") return NextResponse.json({error:message},{status:401});
  // PostgreSQL/network exceptions may include private row values or infrastructure details.
  if(error && typeof error==="object" && "code" in error || /DATABASE_URL|connect|ECONN|fetch failed/.test(message)) {
    return NextResponse.json({error:"Servicio de datos no disponible o solicitud en conflicto"},{status:503});
  }
  return NextResponse.json({error:message || "Solicitud inválida"},{status:message.startsWith("TODO(DECISIÓN)")?503:400});
}
