export interface Player {
  dni: string;
  nombres: string;
  celular?: string;
  puntos: number;
  dadoId?: string;
  dadoNombre?: string;
  racha_actual?: number;
  mejor_racha?: number;
  titulo?: string;
  partidas_jugadas?: number;
  partidas_ganadas?: number;
  total_ganado?: number;
  valor?: number; // Used for temporary dice results
  saldo_real?: number; // Créditos disponibles (Yapeo)
}

export interface GameResult {
  ganador: Player;
  resultados: Array<Player & { valor: number }>;
  rondas: Array<Array<Player & { valor: number }>>;
  premio: number;
  pozo: number;
  monto: number;
  puntosGanados?: number;
  puntosTotal?: number;
  rachaActual?: number;
  nearMisses?: string[];
}

export interface LevelUp {
  nombre?: string;
  emoji?: string;
  color?: string;
  puntosGanados: number;
  puntosTotal: number;
  rachaActual: number;
  recompensa?: string | null;
  puntosAntes?: number;
  puntosNuevos?: number;
}

export interface GameStats {
  totalPartidas: number;
  totalDinero: string;
  totalJugadores: number;
  topGanador: { nombres: string; partidas_ganadas: number } | null;
  mejorRacha: { nombres: string; mejor_racha: number } | null;
  masJugadas: { nombres: string; partidas_jugadas: number } | null;
}

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error";
}

export type DicePhase = "idle" | "cup_entry" | "cup_shake" | "launching" | "settling" | "winner_reveal";
