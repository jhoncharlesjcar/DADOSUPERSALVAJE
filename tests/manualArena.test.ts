// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { validateMatch } from "../lib/arena/types";

vi.mock("../lib/adminAuth",()=>({requireAdmin:vi.fn().mockResolvedValue(undefined)}));
const databasePath=path.join(tmpdir(),`arena-test-${randomUUID()}.db`),matchId=randomUUID();
let database:typeof import("../lib/db");
let arena:typeof import("../lib/manualArena");
let charge:typeof import("../app/api/partida/cobro/route");
let settle:typeof import("../app/api/partida/route");
const request=(body:unknown)=>new NextRequest("http://localhost/api/partida",{method:"POST",body:JSON.stringify(body),headers:{"Content-Type":"application/json"}});
beforeAll(async()=>{
  process.env.DATABASE_PATH=databasePath;
  database=await import("../lib/db");arena=await import("../lib/manualArena");
  charge=await import("../app/api/partida/cobro/route");settle=await import("../app/api/partida/route");
  for(const [dni,name] of [["11112222","Ana"],["33334444","Luis"],["55556666","Eva"]]) {
    database.registrarJugadorSeguro(dni,name);
    database.getDB().prepare("UPDATE wallet SET saldo_real=50 WHERE dni=?").run(dni);
  }
});
afterAll(()=>{
  database?.getDB().close();delete process.env.DATABASE_PATH;
  for(const suffix of ["","-wal","-shm"])rmSync(databasePath+suffix,{force:true});
});
describe("preparación y liquidación manual",()=>{
  it("no genera resultados para partidas sin entradas",()=>{
    expect(()=>arena.prepareManualMatch(randomUUID())).toThrow("Participantes inválidos");
  });
  it("conserva el resultado y cobra una sola vez al reintentar",async()=>{
    const body={dnis:["11112222","33334444"],monto:10,idempotencyKey:matchId};
    expect((await charge.POST(request(body))).status).toBe(200);
    expect(await (await charge.POST(request(body))).json()).toMatchObject({replay:true});
    const match=arena.prepareManualMatch(matchId,{"11112222":"azul"});
    expect(validateMatch(match)).toBe(true);
    expect(arena.prepareManualMatch(matchId,{"11112222":"rojo"})).toEqual(match);
    expect(match.players[0].dadoId).toBe("azul");
    expect((await charge.POST(request({...body,monto:20}))).status).toBe(400);
    expect((await charge.POST(request({...body,dnis:[...body.dnis,"55556666"]}))).status).toBe(400);
    expect(database.getDB().prepare("SELECT saldo_real FROM wallet WHERE dni='11112222'").get()).toEqual({saldo_real:40});
  });
  it("ignora ganador/monto inventados y no repite premio ni estadísticas",async()=>{
    const match=arena.readManualMatch(matchId)!;
    const body={idempotencyKey:matchId,ganador_dni:"55556666",pozo:999999,monto:999999,resultados:[]};
    const response=await settle.POST(request(body));expect(response.status).toBe(200);
    const db=database.getDB();
    expect(db.prepare("SELECT ganador_dni,pozo,premio FROM partidas WHERE external_id=?").get(matchId)).toEqual({ganador_dni:match.winnerId,pozo:20,premio:16});
    expect(await (await settle.POST(request(body))).json()).toMatchObject({ok:true,replay:true});
    expect(db.prepare("SELECT COUNT(*) AS total FROM partidas").get()).toEqual({total:1});
    expect(db.prepare("SELECT SUM(saldo_real) AS total FROM wallet").get()).toEqual({total:146});
    expect(db.prepare("SELECT SUM(partidas_jugadas) AS total FROM jugadores").get()).toEqual({total:2});
  });
});
