import "server-only";
import { getDatabase, type SqlClient } from "./data/database";

export interface Team { id: string; nombre: string; lider_usuario_id: string; miembros: Array<{ id: string; nombres: string }>; }
async function playerId(client: SqlClient, dni: string) {
  const row = (await client.query<{ id: string }>("SELECT id FROM usuarios WHERE dni=$1 AND estado='activo'", [dni])).rows[0];
  if (!row) throw new Error("Jugador no habilitado");
  return row.id;
}
/** Create only the caller's membership. Other players explicitly join themselves. */
export async function createTeam(nombre: string, liderDni: string) {
  const name = nombre.trim();
  if (name.length < 1 || name.length > 80) throw new Error("Nombre de grupo inválido");
  return getDatabase().transaction(async client => {
    const leader = await playerId(client, liderDni);
    const team = (await client.query<{ id: string }>("INSERT INTO equipos(nombre,lider_usuario_id) VALUES($1,$2) RETURNING id", [name, leader])).rows[0];
    await client.query("INSERT INTO equipo_miembros(equipo_id,usuario_id) VALUES($1,$2)", [team.id, leader]);
    return team.id;
  });
}
export async function joinTeam(teamId: string, dni: string) {
  return getDatabase().transaction(async client => {
    if (!(await client.query("SELECT id FROM equipos WHERE id=$1 FOR UPDATE", [teamId])).rowCount) throw new Error("Grupo no encontrado");
    if ((await client.query("SELECT id FROM queue_units WHERE grupo_id=$1 AND estado IN ('esperando','asignado')", [teamId])).rowCount) throw new Error("El grupo ya está en cola o partida");
    const userId = await playerId(client, dni);
    const members = (await client.query<{ usuario_id: string }>("SELECT usuario_id FROM equipo_miembros WHERE equipo_id=$1", [teamId])).rows;
    if (members.some(member => member.usuario_id === userId)) return teamId;
    if (members.length >= 5) throw new Error("El grupo admite hasta cinco jugadores");
    await client.query("INSERT INTO equipo_miembros(equipo_id,usuario_id) VALUES($1,$2)", [teamId, userId]);
    return teamId;
  });
}
export async function leaveTeam(teamId: string, dni: string) {
  await getDatabase().transaction(async client => {
    const team = (await client.query<{ lider_usuario_id: string }>("SELECT lider_usuario_id FROM equipos WHERE id=$1 FOR UPDATE", [teamId])).rows[0];
    if (!team) throw new Error("Grupo no encontrado");
    const userId = await playerId(client, dni);
    if (team.lider_usuario_id === userId) throw new Error("El líder no puede abandonar el grupo sin transferirlo");
    if ((await client.query("SELECT id FROM queue_units WHERE grupo_id=$1 AND estado IN ('esperando','asignado')", [teamId])).rowCount) throw new Error("El grupo ya está en cola o partida");
    await client.query("DELETE FROM equipo_miembros WHERE equipo_id=$1 AND usuario_id=$2", [teamId, userId]);
  });
}
export async function getTeams(dni: string): Promise<Team[]> {
  const userId = await playerId(getDatabase(), dni);
  const teams = (await getDatabase().query<Omit<Team, "miembros">>(`SELECT e.* FROM equipos e JOIN equipo_miembros m ON m.equipo_id=e.id WHERE m.usuario_id=$1 ORDER BY e.creado_en DESC`, [userId])).rows;
  return Promise.all(teams.map(async team => ({ ...team, miembros: (await getDatabase().query<{ id: string; nombres: string }>(`SELECT u.id,u.nombres FROM usuarios u JOIN equipo_miembros m ON m.usuario_id=u.id WHERE m.equipo_id=$1 ORDER BY u.id`, [team.id])).rows })));
}
export function calcularGanadorEquipo(resultadosEqA: number[], resultadosEqB: number[]) {
  const sumaA = resultadosEqA.reduce((a, b) => a + b, 0), sumaB = resultadosEqB.reduce((a, b) => a + b, 0);
  return sumaA > sumaB ? "Equipo A" : sumaB > sumaA ? "Equipo B" : "Empate";
}
