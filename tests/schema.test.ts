// @vitest-environment node
import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {createTestDatabase} from "./helpers/postgres";
let db:Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async()=>{db=await createTestDatabase({allMigrations:true});},30000);
afterAll(async()=>{await db?.close();});
describe("migraciones PostgreSQL",()=>{
 it("reproduce todas las tablas y activa RLS en cada una",async()=>{
  const rows=(await db.query<{relname:string;relrowsecurity:boolean}>("SELECT relname,relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'")).rows;
  expect(rows.map(r=>r.relname)).toEqual(expect.arrayContaining(["usuarios","billeteras","partidas","movimientos","recargas","retiros","equipos","dados","caras_dado","items","ratings","semillas_partida","queue_units","archivo_legacy"]));
  expect(rows.every(r=>r.relrowsecurity)).toBe(true);
 });
 it("semilla diez dados sin ventajas y cuatro billeteras de sistema",async()=>{
  expect((await db.query("SELECT count(*)::int AS n FROM dados")).rows[0]).toEqual({n:10});
  expect((await db.query("SELECT count(*)::int AS n FROM caras_dado WHERE cara=valor")).rows[0]).toEqual({n:60});
  expect((await db.query("SELECT count(*)::int AS n FROM billeteras WHERE sistema IS NOT NULL")).rows[0]).toEqual({n:4});
 });
 it("roles cliente no pueden escribir dinero ni leer semillas privadas",async()=>{
  for(const role of ["anon","authenticated"]) {
   await db.query("SET ROLE "+role);
   try {
    await expect(db.query("INSERT INTO billeteras(sistema,demo) VALUES('CASA',true)")).rejects.toThrow();
    await expect(db.query("SELECT * FROM semillas_partida")).rejects.toThrow();
   } finally {await db.query("RESET ROLE");}
  }
 });
});
