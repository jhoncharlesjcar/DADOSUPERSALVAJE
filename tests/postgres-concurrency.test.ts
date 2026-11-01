// @vitest-environment node
import {afterAll,beforeAll,describe,it,expect,vi} from "vitest";
import {randomUUID} from "node:crypto";
import {readFileSync,readdirSync} from "node:fs";
import {Pool,Client} from "pg";
import {blockEntries} from "../lib/data/ledger";
import type {SqlClient} from "../lib/data/database";
vi.mock("server-only",()=>({}));
const url=process.env.PGTEST_ADMIN_URL;
const name="dado_test_"+randomUUID().replaceAll("-","");
let admin:Client,pool:Pool,created=false;
const run=async<T>(operation:(c:SqlClient)=>Promise<T>)=>{
 const c=await pool.connect();
 try {await c.query("BEGIN");const result=await operation({async query<R>(sql:string,args:unknown[]=[]){const r=await c.query(sql,args);return {rows:r.rows as R[],rowCount:r.rowCount??0};}});await c.query("COMMIT");return result;}
 catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
};
describe.skipIf(!url)("100 apuestas concurrentes en PostgreSQL multiconexión",()=>{
 beforeAll(async()=>{
  const parsed=new URL(url!);
  if(!["localhost","127.0.0.1","[::1]"].includes(parsed.hostname)) throw new Error("PGTEST_ADMIN_URL requiere servidor local de pruebas");
  admin=new Client({connectionString:url});await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);created=true;
  parsed.pathname="/"+name;pool=new Pool({connectionString:parsed.toString(),max:100});
  for(const file of readdirSync("supabase/migrations").filter(f=>f.endsWith(".sql")).sort()) await pool.query(readFileSync("supabase/migrations/"+file,"utf8"));
 },60000);
 afterAll(async()=>{await pool?.end();if(created) await admin.query(`DROP DATABASE "${name}"`);await admin?.end();});
 it("no sobregira un mismo saldo y no repite reservas",async()=>{
  const a=randomUUID(),b=randomUUID();
  await pool.query("INSERT INTO usuarios(id,dni,nombres) VALUES($1,'87654321','A'),($2,'87654322','B')",[a,b]);
  await pool.query("INSERT INTO billeteras(usuario_id,demo,disponible_centimos) VALUES($1,true,5000),($2,true,50000)",[a,b]);
  const ids=Array.from({length:100},()=>randomUUID());
  for(const id of ids) {
   await pool.query("INSERT INTO partidas(id,modo,demo,monto_entrada_centimos,min_jugadores,max_jugadores,estado,hash_semilla) VALUES($1,'duelo',true,200,2,2,'confirmando',$2)",[id,'a'.repeat(64)]);
   await pool.query("INSERT INTO participantes(partida_id,usuario_id,dado_id,apuesta_centimos,confirmado) VALUES($1,$2,'rojo',200,true),($1,$3,'azul',200,true)",[id,a,b]);
  }
  const outcomes=await Promise.allSettled(ids.map(id=>run(c=>blockEntries(c,id))));
  expect(outcomes.filter(r=>r.status==="fulfilled")).toHaveLength(25);
  for(const outcome of outcomes) if(outcome.status==="rejected") expect(outcome.reason.message).toBe("Saldo insuficiente");
  const {rows:[balance]}=await pool.query("SELECT disponible_centimos::text,bloqueado_centimos::text FROM billeteras WHERE usuario_id=$1",[a]);
  expect(balance).toEqual({disponible_centimos:'0',bloqueado_centimos:'5000'});
  const won=ids[outcomes.findIndex(r=>r.status==="fulfilled")];
  await Promise.all(Array.from({length:100},()=>run(c=>blockEntries(c,won))));
  expect((await pool.query("SELECT count(*)::int n FROM movimientos WHERE referencia_id=$1",[won])).rows[0].n).toBe(2);
 },120000);
});
