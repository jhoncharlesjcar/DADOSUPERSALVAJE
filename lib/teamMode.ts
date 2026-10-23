import { getDB } from './db';

export interface Team {
  id: number;
  nombre: string;
  lider_dni: string;
  miembros: string[];
}

export function createTeam(nombre: string, lider_dni: string, miembros: string[]) {
  const db = getDB();
  db.prepare(`
    INSERT INTO teams (nombre, lider_dni, miembros_json)
    VALUES (?, ?, ?)
  `).run(nombre, lider_dni, JSON.stringify(miembros));
}

export function getTeams(): Team[] {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM teams').all() as any[];
  return rows.map(r => ({
    ...r,
    miembros: JSON.parse(r.miembros_json)
  }));
}

export function calcularGanadorEquipo(resultadosEqA: number[], resultadosEqB: number[]) {
  const sumaA = resultadosEqA.reduce((a, b) => a + b, 0);
  const sumaB = resultadosEqB.reduce((a, b) => a + b, 0);

  if (sumaA > sumaB) return 'Equipo A';
  if (sumaB > sumaA) return 'Equipo B';
  return 'Empate';
}
