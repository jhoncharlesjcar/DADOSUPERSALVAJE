// @vitest-environment node
import { afterAll,beforeAll,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
import { createTestDatabase } from "./helpers/postgres";
import { setTestDatabase } from "../lib/data/database";
import { getJugador,getPartidas,getRanking,getReporteFinanciero,getTodasTransacciones,getEstadisticasGlobales,registrarJugadorSeguro } from "../lib/db";
import { getWallet } from "../lib/wallet";
import { adjustDemoBalance } from "../lib/data/ledger";
import { generateServerRolls,verifyServerRolls } from "../lib/rollSigner";
import { checkRateLimit,clearRateLimit } from "../lib/rateLimit";

let db:Awaited<ReturnType<typeof createTestDatabase>>;
let userId:string;
beforeAll(async()=>{
  db=await createTestDatabase(); setTestDatabase(db);
  process.env.DINERO_REAL_HABILITADO="false";
  userId=await registrarJugadorSeguro("11112222","Jugador Uno");
  await registrarJugadorSeguro("33334444","Jugador Dos");
},30000);
afterAll(async()=>{setTestDatabase(undefined);await db?.close();delete process.env.DINERO_REAL_HABILITADO;});

describe("Adaptación financiera PostgreSQL",()=>{
  it("registra sin confiar en montos de formularios y separa demo de dinero real",async()=>{
    await registrarJugadorSeguro("33334444","Jugador Dos","","comprobante-cliente",10000);
    expect((await getWallet("33334444"))?.disponible_centimos).toBe("0");
    expect((await db.query<{count:string}>("SELECT count(*)::text FROM billeteras WHERE usuario_id=$1",[userId])).rows[0].count).toBe("2");
  });
  it("proyecta el saldo desde la billetera sin columna legacy mutable ni crédito duplicado",async()=>{
    await db.transaction(c=>adjustDemoBalance(c,userId,5001n,"funding","Saldo demo prueba","test"));
    await db.transaction(c=>adjustDemoBalance(c,userId,5001n,"funding","Saldo demo prueba","test"));
    const wallet=await getWallet("11112222");
    expect(wallet?.disponible_centimos).toBe("5001");
    expect(wallet?.saldo_real).toBe(50.01);
    expect((await getJugador("11112222"))?.monto_yapeo).toBe(wallet?.saldo_real);
    const real=(await db.query<{amount:string}>("SELECT disponible_centimos::text AS amount FROM billeteras WHERE usuario_id=$1 AND demo=false",[userId])).rows[0];
    expect(real.amount).toBe("0");
  });
  it("rechaza el mismo identificador con otro monto y no modifica el saldo",async()=>{
    await expect(db.transaction(c=>adjustDemoBalance(c,userId,999n,"funding","Saldo demo prueba","test"))).rejects.toThrow();
    expect((await getWallet("11112222"))?.disponible_centimos).toBe("5001");
  });
  it("mantiene historial y estadísticas serializables y no expone DNI en ranking público",async()=>{
    await db.query("UPDATE usuarios SET puntos=10 WHERE id=$1",[userId]);
    const ranking=await getRanking();
    expect(ranking[0]).not.toHaveProperty("dni");
    expect((await getRanking(true))[0]).toHaveProperty("dni","11112222");
    expect(await getPartidas(8,"33334444")).toEqual([]);
    expect((await getEstadisticasGlobales()).totalJugadores).toBe(2);
    expect((await getReporteFinanciero()).ingresos_centimos).toBe("0");
    const movements=await getTodasTransacciones();
    expect(movements[0].monto_centimos).toBe("5001");
    expect(()=>JSON.stringify(movements)).not.toThrow();
  });
});
describe("Tiradas firmadas heredadas",()=>{
  it("rechaza alteraciones sin cambiar el algoritmo existente",()=>{
    const result=generateServerRolls(["11112222","33334444"],"match_test_123");
    expect(verifyServerRolls(result)).toBe(true);
    expect(result.rolls["11112222"]).toBeGreaterThanOrEqual(1);
    expect(result.rolls["11112222"]).toBeLessThanOrEqual(6);
    expect(verifyServerRolls({...result,rolls:{...result.rolls,"11112222":result.rolls["11112222"]===6 ? 1 : 6}})).toBe(false);
  });
});
describe("Límite persistente y atómico PostgreSQL",()=>{
  it("100 llamadas simultáneas admiten solo el límite establecido",async()=>{
    const results=await Promise.all(Array.from({length:100},()=>checkRateLimit("burst",3,60000)));
    expect(results.filter(r=>r.allowed)).toHaveLength(3);
    expect(results.filter(r=>!r.allowed).every(r=>r.retryAfter>0)).toBe(true);
    await clearRateLimit("burst");
    expect((await checkRateLimit("burst",3,60000)).allowed).toBe(true);
  });
  it("reinicia la ventana expirada y falla cerrado si PostgreSQL no responde",async()=>{
    await db.query("UPDATE rate_limit SET reset_at=0 WHERE key='burst'");
    expect((await checkRateLimit("burst",3,60000)).allowed).toBe(true);
    setTestDatabase({query:async()=>{throw new Error("offline");},transaction:async()=>{throw new Error("offline");}});
    try { await expect(checkRateLimit("x",3,60000)).rejects.toThrow("offline"); }
    finally {setTestDatabase(db);}
  });
});
