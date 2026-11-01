import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { createManualEntry } from "@/lib/data/matches";
import { routeError } from "@/lib/data/http";
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body=await request.json();
    return NextResponse.json({ok:true,...await createManualEntry(body.dnis,body.monto,body.idempotencyKey)});
  } catch(error) { return routeError(error); }
}
