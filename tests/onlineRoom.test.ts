// @vitest-environment node
import {beforeAll,afterAll,describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
const session=vi.hoisted(()=>({dni:""}));
vi.mock("../lib/playerAuth",()=>({requirePlayer:async()=>session.dni}));
import {createTestDatabase} from "./helpers/postgres";
import {setTestDatabase} from "../lib/data/database";
import {joinQueue} from "../lib/matchmaking";
import {GET,POST} from "../app/api/game/room/route";
import {GET as proof} from "../app/api/game/fairness/route";
import {verifyReplay} from "../lib/data/fairness";
let db:Awaited<ReturnType<typeof createTestDatabase>>;
const post=(id:string,action="confirm")=>POST(new Request("http://localhost/api/game/room",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,action,ganador_usuario_id:"forged"})}));
const get=(id:string)=>GET(new Request(`http://localhost/api/game/room?id=${id}`));
async function seedPlayers(count:number,start:number) {
 const dnis=Array.from({length:count},(_,i)=>String(start+i));
 for(const dni of dnis) {
  const user=(await db.query<{id:string}>("INSERT INTO usuarios(dni,nombres) VALUES($1,'Prueba') RETURNING id",[dni])).rows[0];
  await db.query("INSERT INTO billeteras(usuario_id,disponible_centimos) VALUES($1,10000)",[user.id]);
 }
 return dnis;
}
beforeAll(async()=>{
 vi.stubEnv("ONLINE_MODE_ENABLED","true");vi.stubEnv("DINERO_REAL_HABILITADO","false");vi.stubEnv("ELO_K","32");
 vi.stubEnv("MATCHMAKING_MAX_RANGE","300");vi.stubEnv("CONFIRMATION_SECONDS","30");vi.stubEnv("CONFIRMATION_PENALTY_SECONDS","20");vi.stubEnv("TEAM_MAX_RATING_DIFFERENCE","0");
 db=await createTestDatabase({allMigrations:true});setTestDatabase(db);
},30000);
afterAll(async()=>{setTestDatabase(undefined);await db?.close();vi.unstubAllEnvs();});
describe("confirmación online autoritativa",()=>{
 it("no revela semilla ni bloquea hasta la última aceptación; paga solo una vez",async()=>{
  const dnis=await seedPlayers(2,62000000);
  await joinQueue(dnis[0],"duelo",10);const id=(await joinQueue(dnis[1],"duelo",10))!;
  const before=await (await proof(new Request(`http://localhost/api/game/fairness?id=${id}`))).json();
  expect(before.seed).toBeNull();expect(before.hash).toMatch(/^[a-f0-9]{64}$/);
  session.dni=dnis[0];expect(await (await post(id)).json()).toMatchObject({ok:true,completed:false});
  expect((await db.query("SELECT count(*)::int n FROM movimientos WHERE referencia_id=$1",[id])).rows[0].n).toBe(0);
  session.dni=dnis[1];expect(await (await post(id)).json()).toMatchObject({ok:true,completed:true});
  expect(await (await post(id)).json()).toMatchObject({ok:true,completed:true});
  const result=await (await get(id)).json();expect(result.room.status).toBe("completed");expect(result.result.pool_centimos).toBe("2000");
  const after=await (await proof(new Request(`http://localhost/api/game/fairness?id=${id}`))).json();
  expect(after.hash).toBe(before.hash);expect(verifyReplay(after.hash,after.seed,after.replay)).toBe(true);
  for(const dni of dnis) expect(JSON.stringify(result)).not.toContain(dni);
  expect((await db.query("SELECT sum(partidas_jugadas)::int n FROM usuarios")).rows[0].n).toBe(2);
  expect((await db.query("SELECT SUM(monto_centimos)::text n FROM movimientos WHERE referencia_id=$1",[id])).rows[0].n).toBe("0");
  session.dni="99999999";expect((await get(id)).status).toBe(400);
 });
 it("liquida un equipo completo y entrega prueba colectiva sin fingir un ganador individual",async()=>{
  const dnis=await seedPlayers(6,63000000);let id:string|null=null;
  for(const dni of dnis) id=await joinQueue(dni,"equipos_3v3",20);
  expect(id).toBeTruthy();
  for(const dni of dnis) {session.dni=dni;expect((await post(id!)).status).toBe(200);}
  const data=await (await get(id!)).json();
  expect(data.replay).toBeNull();expect(data.teamReplay.winnerTeam).toMatch(/^[AB]$/);
  expect(data.result.winnerTeam).toBe(data.teamReplay.winnerTeam);
  const winners=(await db.query<{premio_centimos:string}>("SELECT premio_centimos::text FROM participantes WHERE partida_id=$1 AND premio_centimos>0",[id])).rows;
  expect(winners).toHaveLength(3);expect(winners.every(w=>w.premio_centimos==="3200")).toBe(true);
  const check=await (await proof(new Request(`http://localhost/api/game/fairness?id=${id}`))).json();
  expect(verifyReplay(check.hash,check.seed,check.replay)).toBe(true);
 });
});
