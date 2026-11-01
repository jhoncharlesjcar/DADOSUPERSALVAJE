import { getRanking } from "@/lib/db";
import { NextResponse } from "next/server";
export const dynamic="force-dynamic";
export async function GET() {
  try { return NextResponse.json(await getRanking()); }
  catch { return NextResponse.json({error:"No se pudo consultar el ranking"},{status:503}); }
}
