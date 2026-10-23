import { getDB } from './db';

export interface WalletInfo {
  id: number;
  dni: string;
  saldo_real: number;
  saldo_bono: number;
  moneda_ingame: number;
}

export function getWallet(dni: string): WalletInfo | null {
  const db = getDB();
  const info = db.prepare('SELECT * FROM wallet WHERE dni = ?').get(dni) as WalletInfo | undefined;
  return info || null;
}

export function inicializarWallet(dni: string) {
  const db = getDB();
  db.prepare(`
    INSERT OR IGNORE INTO wallet (dni, saldo_real, saldo_bono, moneda_ingame)
    VALUES (?, 0, 0, 0)
  `).run(dni);
}

export function calcularDistribucion(pozoTotal: number) {
  if (!Number.isFinite(pozoTotal) || pozoTotal <= 0) throw new Error("Pozo inválido");
  const pozoCentavos = Math.round(pozoTotal * 100);
  const premioCentavos = Math.floor(pozoCentavos * 0.8);
  const rankingCentavos = Math.floor(pozoCentavos * 0.04);
  const casaCentavos = pozoCentavos - premioCentavos - rankingCentavos;
  return {
    premioJugador: premioCentavos / 100,
    gananciaRanking: rankingCentavos / 100,
    gananciaCasa: casaCentavos / 100,
  };
}

export function distribuirPremio(ganadorDni: string, pozoTotal: number) {
  const db = getDB();
  
  // Reglas del negocio: Casa 16%, Ganador 80%, Ranking 4%
  // FIN-001: Trabajar en centavos para evitar errores de precisión de punto flotante
  const { premioJugador, gananciaCasa, gananciaRanking } = calcularDistribucion(pozoTotal);

  return db.transaction(() => {
    const result = db.prepare(`
      UPDATE wallet 
      SET saldo_real = saldo_real + ? 
      WHERE dni = ?
    `).run(premioJugador, ganadorDni);

    if (result.changes !== 1) {
      throw new Error("Billetera del ganador no encontrada");
    }

    // R-10: Sincronizar columna heredada directamente desde wallet para evitar divergencia
    db.prepare(`
      UPDATE jugadores SET monto_yapeo = (SELECT saldo_real FROM wallet WHERE dni = ?) WHERE dni = ?
    `).run(ganadorDni, ganadorDni);

    return { premioJugador, gananciaCasa, gananciaRanking };
  }).immediate();
}
