// @vitest-environment node
import {afterAll,beforeAll,describe,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("../lib/adminAuth",()=>({requireAdmin:vi.fn().mockResolvedValue(undefined)}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("../lib/playerAuth",async importOriginal=>({
  ...await importOriginal<typeof import("../lib/playerAuth")>(),
  requirePlayer:vi.fn().mockResolvedValue("11223344"),
}));
import {createTestDatabase} from "./helpers/postgres";
import {setTestDatabase} from "../lib/data/database";
import {getWallet} from "../lib/wallet";
import {POST as register} from "../app/api/auth/player/register/route";
import {POST as login} from "../app/api/auth/player/login/route";
import {GET as profile} from "../app/api/player/me/route";
import {POST as operatorRegister} from "../app/api/registrar/route";
import {updateBalance,setPlayerPin} from "../app/admin/actions";

let db:Awaited<ReturnType<typeof createTestDatabase>>;
function request(path:string,body:object) { return new Request(`http://localhost${path}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); }
beforeAll(async()=>{
  process.env.DINERO_REAL_HABILITADO="false";
  process.env.DEMO_WELCOME_CENTIMOS="1234";
  process.env.PLAYER_SESSION_SECRET="test-player-session-secret-at-least-32-characters";
  db=await createTestDatabase();setTestDatabase(db);
},30000);
afterAll(async()=>{
  setTestDatabase(undefined);await db?.close();
  delete process.env.DINERO_REAL_HABILITADO;delete process.env.DEMO_WELCOME_CENTIMOS;delete process.env.PLAYER_SESSION_SECRET;
});
describe("Rutas de jugador y operador PostgreSQL",()=>{
  it("registra créditos solo demo, ignora montos cliente y rechaza registro duplicado",async()=>{
    const body={dni:"11223344",nombres:"Ana Prueba",pin:"123456",saldo_real:999999};
    const first=await register(request("/api/auth/player/register",body));
    expect(first.status).toBe(201);
    expect((await first.json()).wallet).toEqual({creditos:12.34,disponible_centimos:"1234",demo:true});
    expect((await register(request("/api/auth/player/register",body))).status).toBe(409);
    expect((await getWallet("11223344"))?.disponible_centimos).toBe("1234");
    const real=await db.query<{amount:string}>("SELECT disponible_centimos::text AS amount FROM billeteras WHERE demo=false AND usuario_id=(SELECT id FROM usuarios WHERE dni='11223344')");
    expect(real.rows[0].amount).toBe("0");
  });
  it("conserva login PIN, limita el perfil a datos propios y nunca entrega el hash",async()=>{
    const wrong=await login(request("/api/auth/player/login",{dni:"11223344",pin:"654321"}));
    expect(wrong.status).toBe(401);
    const correct=await login(request("/api/auth/player/login",{dni:"11223344",pin:"123456"}));
    expect(correct.status).toBe(200);
    expect(correct.headers.get("set-cookie")).toContain("HttpOnly");
    const data=await (await profile()).json();
    expect(data.player.disponible_centimos).toBe("1234");
    expect(data.player).not.toHaveProperty("pin_hash");
    expect(data.player).not.toHaveProperty("dni");
  });
  it("hace idempotente el crédito del formulario del operador y rechaza colisiones",async()=>{
    const body={dni:"11223344",nombres:"Ana Prueba",codigo_yapeo:"demo-receipt",monto_yapeo:"1.01"};
    expect((await operatorRegister(request("/api/registrar",body))).status).toBe(200);
    expect((await operatorRegister(request("/api/registrar",body))).status).toBe(200);
    expect((await operatorRegister(request("/api/registrar",{...body,monto_yapeo:"2.00"}))).status).toBe(400);
    expect((await getWallet("11223344"))?.disponible_centimos).toBe("1335");
  });
  it("ajustes y PIN del admin se auditan; ajustar en modo real está bloqueado",async()=>{
    const key="idempotency-admin-api-01";
    expect(await updateBalance("11223344",2,true,key)).toEqual({success:true});
    expect(await updateBalance("11223344",2,true,key)).toEqual({success:true});
    expect((await getWallet("11223344"))?.disponible_centimos).toBe("1535");
    expect((await updateBalance("11223344",3,true,key)).success).toBe(false);
    expect(await setPlayerPin("11223344","111222")).toEqual({success:true});
    expect((await db.query("SELECT id FROM auditoria_admin WHERE accion='cambio_pin'")).rows).toHaveLength(1);
    process.env.DINERO_REAL_HABILITADO="true";
    try { expect((await updateBalance("11223344",2,true,"idempotency-admin-api-02")).success).toBe(false); }
    finally {process.env.DINERO_REAL_HABILITADO="false";}
  });
});
