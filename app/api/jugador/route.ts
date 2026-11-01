import { buscarJugadores } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
export async function GET(request: Request) {
  try { await requireAdmin(); } catch { return NextResponse.json({error:"No autorizado"},{status:401}); }
  const q=new URL(request.url).searchParams.get("q")?.trim();
  if(!q || q.length>100) return NextResponse.json({error:"Búsqueda requerida"},{status:400});
  try { return NextResponse.json(await buscarJugadores(q),{headers:{"Cache-Control":"no-store"}}); }
  catch { return NextResponse.json({error:"No se pudo consultar jugadores"},{status:503}); }
}
