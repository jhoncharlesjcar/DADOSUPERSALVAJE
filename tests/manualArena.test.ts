// @vitest-environment node
import { afterAll,beforeAll,describe,expect,it,vi } from "vitest";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { createTestDatabase } from "./helpers/postgres";
import { setTestDatabase } from "../lib/data/database";
import { adjustDemoBalance } from "../lib/data/ledger";
import { validateMatch } from "../lib/arena/types";
import { prepareManualMatch,readManualMatch } from "../lib/manualArena";
import { POST as charge } from "../app/api/partida/cobro/route";
import { POST as settle } from "../app/api/partida/route";
vi.mock("server-only",()=>({}));
vi.mock("../lib/adminAuth",()=>({requireAdmin:vi.fn().mockResolvedValue(undefined)}));
let db:Awaited<ReturnType<typeof createTestDatabase>>;
const matchId=randomUUID(),dnis=["11112222","33334444","55556666"];
const request=(body:unknown)=>new NextRequest("http://localhost/api/partida",{method:"POST",body:JSON.stringify(body),headers:{"Content-Type":"application/json"}});
beforeAll(async()=>{
  process.env.ELO_K="32"; process.env.DINERO_REAL_HABILITADO="false";
  db=await createTestDatabase();setTestDatabase(db);
  for(const [i,dni] of dnis.entries()) {
    const u=(await db.query<{id:string}>("INSERT INTO usuarios(dni,nombres) VALUES($1,$2) RETURNING id",[dni,["Ana","Luis","Eva"][i]])).rows[0];
    await db.query("INSERT INTO billeteras(usuario_id,demo) VALUES($1,true)",[u.id]);
    await db.transaction(c=>adjustDemoBalance(c,u.id,5000n,randomUUID(),"Fixture","test"));
  }
},30000);
afterAll(async()=>{setTestDatabase(undefined);await db?.close();delete process.env.ELO_K;delete process.env.DINERO_REAL_HABILITADO;});
describe("arena manual con PostgreSQL",()=>{
  it("rechaza preparar sin entradas",async()=>{await expect(prepareManualMatch(randomUUID())).rejects.toThrow("entradas");});
  it("bloquea una sola vez y reutiliza resultado verificable",async()=>{
    const body={dnis:dnis.slice(0,2),monto:10,idempotencyKey:matchId};
    const first=await charge(request(body));expect(await first.json()).toMatchObject({ok:true,replay:false,hash_semilla:expect.stringMatching(/^[a-f0-9]{64}$/)});
    expect(await (await charge(request(body))).json()).toMatchObject({replay:true});
    const match=await prepareManualMatch(matchId,{[dnis[0]]:"azul"});
    expect(validateMatch(match)).toBe(true);
    expect(await prepareManualMatch(matchId,{[dnis[0]]:"rojo"})).toEqual(match);
    expect(match.players[0].dadoId).toBe("azul");
    expect((await charge(request({...body,monto:20}))).status).toBe(400);
    expect((await charge(request({...body,dnis}))).status).toBe(400);
    expect((await db.query("SELECT disponible_centimos::text,bloqueado_centimos::text FROM billeteras b JOIN usuarios u ON u.id=b.usuario_id WHERE dni=$1",[dnis[0]])).rows[0]).toEqual({disponible_centimos:"4000",bloqueado_centimos:"1000"});
  });
  it("ignora ganador/monto del cliente y no repite premios/XP",async()=>{
    const match=(await readManualMatch(matchId))!;
    const body={idempotencyKey:matchId,ganador_dni:dnis[2],pozo:999999,monto:999999,resultados:[]};
    const response=await settle(request(body));
    const result=await response.json();expect(result).toMatchObject({ok:true,replay:false});expect(response.status).toBe(200);
    expect(await (await settle(request(body))).json()).toMatchObject({ok:true,replay:true,levelUp:null});
    const row=(await db.query("SELECT u.dni,p.pozo_centimos::text,p.premio_centimos::text,p.estado FROM partidas p JOIN usuarios u ON u.id=p.ganador_usuario_id WHERE p.external_id=$1",[matchId])).rows[0];
    expect(row).toEqual({dni:match.winnerId,pozo_centimos:"2000",premio_centimos:"1600",estado:"finalizada"});
    expect((await db.query("SELECT SUM(disponible_centimos+ bloqueado_centimos)::text AS total FROM billeteras")).rows[0]).toEqual({total:"15000"});
    expect((await db.query("SELECT SUM(partidas_jugadas)::int AS total FROM usuarios")).rows[0]).toEqual({total:2});
    expect((await db.query("SELECT SUM(monto_centimos)::text AS total FROM movimientos WHERE referencia_tipo='partida'")).rows[0]).toEqual({total:"0"});
  });
});
