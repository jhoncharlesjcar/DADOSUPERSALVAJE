import "server-only";
import { getDatabase, type SqlClient } from "./data/database";
import { displaySoles } from "./data/money";
import { walletIsDemo } from "./wallet";
import type { Player, GameResult } from "@/types";

export interface Jugador {
  id: string; dni: string; nombres: string; celular?: string; codigo_yapeo?: string;
  monto_yapeo?: number; saldo_real: number; disponible_centimos: string; demo: boolean;
  puntos: number; partidas_jugadas: number; partidas_ganadas: number; total_ganado: number;
  total_ganado_centimos: string; racha_actual: number; mejor_racha: number; titulo?: string; creado?: string;
}
export interface Partida {
  id: string; modo: string; monto: number; pozo: number; ganador_dni: string; ganador_nombre: string;
  premio: number; jugadores_json: string; resultados_json: string; duracion_ms: number;
  hubo_empate: number; rondas_empate: number; fecha?: string;
  monto_centimos: string; pozo_centimos: string; premio_centimos: string; demo: boolean; won?: boolean;
}
export interface LiveState {
  jugadores: Player[]; monto: number; pozo: number; ganador: Player | null; resultado: GameResult | null;
  fase: string; countdown: number; ranking: Player[]; updated_at: string;
}
export interface Transaccion {
  id: string; dni: string; nombres?: string; operacion: string; tipo: "ingreso" | "egreso";
  monto: number; monto_centimos: string; fecha: string; demo: boolean;
}
export interface EstadisticasGlobales {
  totalPartidas: number; totalDinero: string; totalJugadores: number;
  topGanador: { nombres: string; partidas_ganadas: number } | null;
  mejorRacha: { nombres: string; mejor_racha: number } | null;
  masJugadas: { nombres: string; partidas_jugadas: number } | null;
}
export const Validators = {
  dni: (dni: string) => /^\d{8}$/.test(dni?.trim() || ""),
  monto: (monto: number) => [2, 5, 10, 20, 30, 40, 50, 100].includes(Number(monto)),
};
export const validarDNI = Validators.dni;
type PlayerRow = Omit<Jugador, "saldo_real" | "monto_yapeo" | "total_ganado">;
const playerColumns = `u.id,u.dni,u.nombres,u.celular,u.puntos,u.partidas_jugadas,u.partidas_ganadas,
  u.total_ganado_centimos::text,u.racha_actual,u.mejor_racha,u.titulo,u.creado_en::text AS creado,
  COALESCE(b.disponible_centimos,0)::text AS disponible_centimos,COALESCE(b.demo,$1) AS demo`;
function projectPlayer(p: PlayerRow): Jugador {
  return { ...p, saldo_real: displaySoles(p.disponible_centimos), monto_yapeo: displaySoles(p.disponible_centimos),
    total_ganado: displaySoles(p.total_ganado_centimos) };
}
export async function getJugador(dni: string) {
  const result = await getDatabase().query<PlayerRow>(`SELECT ${playerColumns} FROM usuarios u
    LEFT JOIN billeteras b ON b.usuario_id=u.id AND b.demo=$1 WHERE u.dni=$2`, [walletIsDemo(), dni]);
  return result.rows[0] ? projectPlayer(result.rows[0]) : null;
}
export async function getTodosJugadores(): Promise<Jugador[]> {
  const result = await getDatabase().query<PlayerRow>(`SELECT ${playerColumns} FROM usuarios u
    LEFT JOIN billeteras b ON b.usuario_id=u.id AND b.demo=$1 ORDER BY u.puntos DESC,u.partidas_jugadas DESC`, [walletIsDemo()]);
  return result.rows.map(projectPlayer);
}
export async function buscarJugadores(query: string) {
  const result = await getDatabase().query<PlayerRow>(`SELECT ${playerColumns} FROM usuarios u
    LEFT JOIN billeteras b ON b.usuario_id=u.id AND b.demo=$1 WHERE u.dni=$2 OR u.nombres ILIKE $3 LIMIT 20`,
    [walletIsDemo(), query, `%${query}%`]);
  return result.rows.map(projectPlayer);
}
export async function getRanking(includeDni = false) {
  const result = await getDatabase().query<{dni: string; nombres: string; puntos: number; partidas_ganadas: number;
    partidas_jugadas: number; total_ganado_centimos: string; racha_actual: number; mejor_racha: number; titulo: string}>(
    `SELECT dni,nombres,puntos,partidas_ganadas,partidas_jugadas,total_ganado_centimos::text,
      racha_actual,mejor_racha,titulo FROM usuarios WHERE puntos>0 ORDER BY puntos DESC,id LIMIT 20`);
  return result.rows.map(({dni, ...p}, index) => ({...p, ...(includeDni ? {dni} : {}), rank: index + 1,
    total_ganado: displaySoles(p.total_ganado_centimos)}));
}
export async function registrarJugadorEnTransaccion(client: SqlClient, dni: string, nombres: string, celular = "") {
  if (!Validators.dni(dni) || nombres.trim().length < 2 || nombres.length > 100 || celular.length > 30) throw new Error("Datos de jugador inválidos");
  const result = await client.query<{id: string}>(`INSERT INTO usuarios(dni,nombres,celular) VALUES($1,$2,$3)
    ON CONFLICT(dni) DO UPDATE SET nombres=excluded.nombres,celular=excluded.celular RETURNING id`, [dni.trim(),nombres.trim(),celular]);
  const userId = result.rows[0].id;
  await client.query("INSERT INTO billeteras(usuario_id,demo) VALUES($1,true),($1,false) ON CONFLICT(usuario_id,demo) DO NOTHING",[userId]);
  await client.query("INSERT INTO limites_usuario(usuario_id) VALUES($1) ON CONFLICT DO NOTHING",[userId]);
  return userId;
}
// Legacy deposit arguments are ignored: only the verified payment ledger may credit real funds.
export async function registrarJugadorSeguro(dni: string,nombres: string,celular?: string,_codigo?: string,_monto?: number | string) {
  return getDatabase().transaction(client => registrarJugadorEnTransaccion(client,dni,nombres,celular));
}
export async function getLiveState(): Promise<LiveState | null> {
  const result = await getDatabase().query<{payload: Partial<LiveState>; updated_at: string}>("SELECT payload,updated_at::text FROM estado_live WHERE id=1");
  const row = result.rows[0];
  if (!row) return null;
  return {jugadores:[],monto:10,pozo:0,ganador:null,resultado:null,fase:"esperando",countdown:0,
    ...row.payload,ranking:await getRanking(true) as Player[],updated_at:row.updated_at};
}
export async function updateLiveState(updates: Partial<Omit<LiveState,"ranking" | "updated_at">>) {
  const allowed = ["jugadores","monto","pozo","ganador","resultado","fase","countdown"];
  const payload = Object.fromEntries(Object.entries(updates).filter(([key]) => allowed.includes(key)));
  await getDatabase().query("UPDATE estado_live SET payload=payload || $1::jsonb,updated_at=now() WHERE id=1",[JSON.stringify(payload)]);
}
export async function getPartidas(limit = 20, dni?: string): Promise<Partida[]> {
  const count = Math.max(1,Math.min(100,Math.trunc(limit)));
  const result = await getDatabase().query<{id:string; modo:string; monto_centimos:string; pozo_centimos:string;
    premio_centimos:string; ganador_dni:string; ganador_nombre:string; duracion_ms:number; fecha:string; demo:boolean;
    replay: {players?: unknown[]; rounds?: unknown[]}; jugadores:unknown[]; won:boolean}>(`SELECT p.id,p.modo,
    p.monto_entrada_centimos::text AS monto_centimos,p.pozo_centimos::text,p.premio_centimos::text,
    COALESCE(w.dni,'') AS ganador_dni,COALESCE(w.nombres,CASE WHEN p.ganador_equipo IS NOT NULL THEN 'Equipo ' || p.ganador_equipo ELSE '' END) AS ganador_nombre,
    p.duracion_ms,p.finalizada_en::text AS fecha,p.demo,p.replay,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('dni',u.dni,'nombres',u.nombres) ORDER BY pt.id) FROM participantes pt JOIN usuarios u ON u.id=pt.usuario_id WHERE pt.partida_id=p.id),'[]') AS jugadores,
    EXISTS(SELECT 1 FROM participantes pt JOIN usuarios u ON u.id=pt.usuario_id WHERE pt.partida_id=p.id AND u.dni=$2 AND pt.premio_centimos>0) AS won
    FROM partidas p LEFT JOIN usuarios w ON w.id=p.ganador_usuario_id
    WHERE p.estado='finalizada' AND ($2::text IS NULL OR EXISTS(SELECT 1 FROM participantes pt JOIN usuarios u ON u.id=pt.usuario_id WHERE pt.partida_id=p.id AND u.dni=$2))
    ORDER BY p.finalizada_en DESC,p.id LIMIT $1`,[count,dni ?? null]);
  const current = result.rows.map(p => ({id:p.id,modo:p.modo,monto:displaySoles(p.monto_centimos),pozo:displaySoles(p.pozo_centimos),
    premio:displaySoles(p.premio_centimos),ganador_dni:p.ganador_dni,ganador_nombre:p.ganador_nombre,
    monto_centimos:p.monto_centimos,pozo_centimos:p.pozo_centimos,premio_centimos:p.premio_centimos,demo:p.demo,won:p.won,
    jugadores_json:JSON.stringify(p.jugadores),resultados_json:JSON.stringify(p.replay?.rounds ?? []),duracion_ms:p.duracion_ms,
    hubo_empate:(p.replay?.rounds?.length ?? 0)>1 ? 1 : 0,rondas_empate:Math.max(0,(p.replay?.rounds?.length ?? 0)-1),fecha:p.fecha}));
  const previous = await getDatabase().query<Omit<Partida,"monto"|"pozo"|"premio"|"jugadores_json"|"resultados_json"> & {jugadores:unknown[];resultados:unknown[]}>(`SELECT h.*,
    h.monto_centimos::text,h.pozo_centimos::text,h.premio_centimos::text,h.fecha::text,h.ganador_dni=$2 AS won
    FROM historial_partidas_legacy h WHERE ($2::text IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(h.jugadores) j WHERE j->>'dni'=$2))
    ORDER BY h.fecha DESC,h.id LIMIT $1`,[count,dni??null]);
  const legacy = previous.rows.map(p=>({...p,monto:displaySoles(p.monto_centimos),pozo:displaySoles(p.pozo_centimos),premio:displaySoles(p.premio_centimos),
    jugadores_json:JSON.stringify(p.jugadores),resultados_json:JSON.stringify(p.resultados)}));
  return [...current,...legacy].sort((a,b)=>Date.parse(b.fecha??"")-Date.parse(a.fecha??"")).slice(0,count);
}
export async function getTodasTransacciones(): Promise<Transaccion[]> {
  const result = await getDatabase().query<{id:string; dni:string; nombres:string; operacion:string; monto_centimos:string; fecha:string; demo:boolean}>(
    `SELECT m.id::text,COALESCE(u.dni,b.sistema) AS dni,COALESCE(u.nombres,b.sistema) AS nombres,
      COALESCE(NULLIF(m.descripcion,''),m.tipo) AS operacion,m.monto_centimos::text,m.creado_en::text AS fecha,b.demo
      FROM movimientos m JOIN billeteras b ON b.id=m.billetera_id LEFT JOIN usuarios u ON u.id=b.usuario_id
      ORDER BY m.creado_en DESC,m.id DESC LIMIT 500`);
  return result.rows.map(r => ({...r,tipo:BigInt(r.monto_centimos)<0n ? "egreso" : "ingreso",
    monto:displaySoles(BigInt(r.monto_centimos)<0n ? -BigInt(r.monto_centimos) : r.monto_centimos)}));
}
export async function getReporteFinanciero() {
  // House cashflow only; summing every wallet would double-count internal transfers.
  const result = await getDatabase().query<{dateStr:string; tipo:"ingreso"|"egreso"; total:string}>(`SELECT m.creado_en::date::text AS "dateStr",
    CASE WHEN m.monto_centimos>=0 THEN 'ingreso' ELSE 'egreso' END AS tipo,SUM(ABS(m.monto_centimos))::text AS total
    FROM movimientos m JOIN billeteras b ON b.id=m.billetera_id WHERE b.sistema='CASA' AND b.demo=$1
    GROUP BY 1,2 ORDER BY 1`,[walletIsDemo()]);
  let income = 0n, expense = 0n;
  for (const row of result.rows) { if(row.tipo === "ingreso") income+=BigInt(row.total); else expense+=BigInt(row.total); }
  return {ingresos:displaySoles(income),egresos:displaySoles(expense),neta:displaySoles(income-expense),
    ingresos_centimos:String(income),egresos_centimos:String(expense),demo:walletIsDemo(),
    history:result.rows.map(row=>({...row,total:displaySoles(row.total)}))};
}
export async function getEstadisticasGlobales(): Promise<EstadisticasGlobales> {
  const db = getDatabase();
  const [totals,players,top,streak,played] = await Promise.all([
    db.query<{count:string; total:string}>(`SELECT count(*)::text,COALESCE(sum(premio_centimos),0)::text AS total FROM (
      SELECT premio_centimos FROM partidas WHERE estado='finalizada' AND demo=$1
      UNION ALL SELECT premio_centimos FROM historial_partidas_legacy WHERE demo=$1) h`,[walletIsDemo()]),
    db.query<{count:string}>("SELECT count(*)::text FROM usuarios"),
    db.query<{nombres:string; partidas_ganadas:number}>("SELECT nombres,partidas_ganadas FROM usuarios ORDER BY partidas_ganadas DESC,id LIMIT 1"),
    db.query<{nombres:string; mejor_racha:number}>("SELECT nombres,mejor_racha FROM usuarios ORDER BY mejor_racha DESC,id LIMIT 1"),
    db.query<{nombres:string; partidas_jugadas:number}>("SELECT nombres,partidas_jugadas FROM usuarios ORDER BY partidas_jugadas DESC,id LIMIT 1"),
  ]);
  return {totalPartidas:Number(totals.rows[0].count),totalDinero:displaySoles(totals.rows[0].total).toFixed(2),
    totalJugadores:Number(players.rows[0].count),topGanador:top.rows[0] ?? null,mejorRacha:streak.rows[0] ?? null,masJugadas:played.rows[0] ?? null};
}
