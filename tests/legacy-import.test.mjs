// @vitest-environment node
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {createTestDatabase} from './helpers/postgres';
import {setTestDatabase} from '../lib/data/database';
import {getPartidas,getEstadisticasGlobales} from '../lib/db';
import {importSnapshot,validateSnapshot} from '../tools/import-postgres.mjs';
let db;
beforeAll(async()=>{vi.stubEnv('DINERO_REAL_HABILITADO','false');db=await createTestDatabase({allMigrations:true});setTestDatabase(db);},30000);
afterAll(async()=>{setTestDatabase(undefined);await db?.close();vi.unstubAllEnvs();});
const fixture=()=>({version:1,source_sha256:'a'.repeat(64),archive:{jugadores:[{dni:'12345678',nombres:'Ejemplo',puntos:5}],partidas:[{id:1,monto:5,pozo:10,premio:8.01,ganador_dni:'12345678',ganador_nombre:'Ejemplo',jugadores_json:JSON.stringify([{dni:'12345678',nombres:'Ejemplo'}]),resultados_json:'[]',fecha:'2026-10-01 12:00:00'}]},
 accounts:[{dni:'12345678',disponible_centimos:'1001',bono_centimos:'29',moneda_ingame:3}],
 player_stats:{'12345678':{total_ganado_centimos:'801'}},totals:{disponible_centimos:'1001',bono_centimos:'29'}});
describe('importación conciliada',()=>{
 it('rechaza totales falsos antes de escribir',()=>{const data=fixture();data.totals.disponible_centimos='1002';expect(()=>validateSnapshot(data)).toThrow('Conciliación');});
 it('rechaza históricos que no contienen listas de participantes',()=>{const data=fixture();data.archive.partidas[0].jugadores_json='{}';expect(()=>validateSnapshot(data)).toThrow('Historial inválido');});
 it('preserva céntimos, bonos, estadísticas e histórico sin duplicar aperturas',async()=>{
  const data=fixture(),hash='b'.repeat(64);
  data.archive.partidas[0].duracion_ms=1234.56;
  expect(await db.transaction(c=>importSnapshot(c,data,hash,true))).toMatchObject({replay:false,accounts:1,available:'1001',bonus:'29'});
  expect(await db.transaction(c=>importSnapshot(c,data,hash,true))).toEqual({replay:true});
  expect((await db.query('SELECT SUM(monto_centimos)::text total FROM movimientos')).rows[0]).toEqual({total:'1030'});
  expect((await db.query('SELECT datos FROM archivo_legacy WHERE tabla=\'partidas\'')).rows[0].datos).toEqual(data.archive.partidas[0]);
  const history=await getPartidas(20,'12345678');
  expect(history).toHaveLength(1);
  expect(history[0]).toMatchObject({monto_centimos:'500',pozo_centimos:'1000',premio_centimos:'801',premio:8.01,won:true,demo:true,ganador_nombre:'Ejemplo',duracion_ms:1235});
  expect(await getPartidas(20,'99999999')).toEqual([]);
  expect(await getEstadisticasGlobales()).toMatchObject({totalPartidas:1,totalDinero:'8.01',totalJugadores:1});
  expect((await db.query('SELECT total_ganado_centimos::text FROM usuarios')).rows[0].total_ganado_centimos).toBe('801');
  expect((await db.query('SELECT disponible_centimos::text FROM billeteras WHERE usuario_id IS NOT NULL AND NOT demo')).rows[0].disponible_centimos).toBe('0');
  await expect(db.transaction(c=>importSnapshot(c,data,'c'.repeat(64),true))).rejects.toThrow('sin usuarios');
 });
});
