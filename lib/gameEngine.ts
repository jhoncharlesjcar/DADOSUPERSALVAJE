import { Player, GameResult, LevelUp } from "@/types";
import { NIVELES, obtenerNivel } from "./cofres";

export type GamePhase = 'espera' | 'matchmaking' | 'sala_llena' | 'arena' | 'rodando' | 'calculo' | 'premios';

export interface GameState {
  fase: GamePhase;
  salaId: number | null;
  jugadores: Player[];
  monto: number;
  pozo: number;
  timestamp: string;
}

/**
 * GameEngine - Lógica centralizada de Dado Salvaje (Refactor v2.1)
 * Orquestador funcional para el manejo de estados, resultados y recompensas.
 */
export const GameEngine = {
  
  // 1. Inicialización de estado
  createInitialState(salaId: number, jugadores: Player[], monto: number): GameState {
    return {
      fase: 'espera',
      salaId,
      jugadores,
      monto,
      pozo: jugadores.length * monto,
      timestamp: new Date().toISOString()
    };
  },

  // 2. Transición de estados
  transitionState(currentState: GameState, nuevaFase: GamePhase): GameState {
    return {
      ...currentState,
      fase: nuevaFase,
      timestamp: new Date().toISOString()
    };
  },

  // 3. Cálculo de Resultados y Ganadores
  processResults(jugadores: Player[], valores: number[]): { 
    resultados: Array<Player & { valor: number }>, 
    ganadores: Array<Player & { valor: number }>,
    esEmpate: boolean
  } {
    const resultados = jugadores.map((j, i) => ({
      ...j,
      valor: valores[i],
    }));

    const maxVal = Math.max(...valores);
    const ganadores = resultados.filter((r) => r.valor === maxVal);
    const esEmpate = ganadores.length > 1;

    return { resultados, ganadores, esEmpate };
  },

  // 4. Cálculo de Recompensas y Evolución (R-07: Curva Balanceada AAA)
  calculateEvolution(ganadorDni: string, pozo: number, puntosActuales: number, numPlayers: number = 2): {
    puntosGanados: number,
    levelUp: LevelUp | null
  } {
    // Puntos base por victoria
    const BASE_POINTS = 10;
    // Bonus por número de rivales enfrentados (1 a 5)
    const rivalBonus = Math.min(Math.max(numPlayers - 1, 1), 5);
    // Modificador para amortiguar distorsión en pozos muy altos
    const normalizedPozo = Math.max(pozo, 4);
    const stakeModifier = Math.max(0.65, 1 - Math.log10(normalizedPozo / 20) * 0.12);

    const puntosGanados = Math.max(5, Math.round(BASE_POINTS * (1 + rivalBonus * 0.15) * stakeModifier));
    const puntosNuevos = puntosActuales + puntosGanados;

    const nivelAntes = obtenerNivel(puntosActuales);
    const nivelDespues = obtenerNivel(puntosNuevos);

    let levelUpInfo: LevelUp | null = null;

    if (nivelDespues.puntos > nivelAntes.puntos) {
      levelUpInfo = {
        nombre: nivelDespues.nombre,
        emoji: nivelDespues.emoji,
        color: nivelDespues.color,
        recompensa: nivelDespues.recompensa?.texto || null,
        puntosAntes: puntosActuales,
        puntosNuevos: puntosNuevos,
        puntosGanados,
        puntosTotal: puntosNuevos,
        rachaActual: 1, // Se actualiza externamente
      };
    }

    return { puntosGanados, levelUp: levelUpInfo };
  },

  // 5. Psicología: Near Miss (Casi ganan)
  detectNearMisses(resultados: Array<Player & { valor: number }>, maxVal: number, ganadorDni: string): string[] {
    return resultados
      .filter(r => r.dni !== ganadorDni && r.valor >= maxVal - 1)
      .map(r => r.nombres.split(" ")[0]);
  }

};
