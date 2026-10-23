export interface Recompensa {
  tipo: string;
  valor: number;
  texto: string;
}

export interface Nivel {
  nombre: string;
  emoji: string;
  color: string;
  puntos: number;
  recompensa: Recompensa | null;
}

export const NIVELES: Nivel[] = [
  { nombre: "SIN NIVEL", emoji: "⬛", color: "#555577", puntos: 0, recompensa: null },
  { nombre: "BRONCE", emoji: "🟤", color: "#cd7f32", puntos: 1200, recompensa: { tipo: "creditos", valor: 2, texto: "+S/ 2 de bonificación" } },
  { nombre: "PLATA", emoji: "⚪", color: "#c0c0c0", puntos: 2400, recompensa: { tipo: "creditos", valor: 5, texto: "+S/ 5 de bonificación" } },
  { nombre: "ORO", emoji: "🟡", color: "#D4AF37", puntos: 4800, recompensa: { tipo: "creditos", valor: 10, texto: "+S/ 10 de bonificación" } },
  { nombre: "DIAMANTE", emoji: "💎", color: "#00bfff", puntos: 9600, recompensa: { tipo: "giro", valor: 1, texto: "🎰 Giro gratis" } },
  { nombre: "GALÁCTICO", emoji: "🌌", color: "#9b59b6", puntos: 19200, recompensa: { tipo: "sorpresa", valor: 0, texto: "🎁 Premio sorpresa" } },
  { nombre: "DADO SALVAJE", emoji: "🎲", color: "#ff3d00", puntos: 38400, recompensa: { tipo: "leyenda", valor: 0, texto: "👑 Estatus LEYENDA" } },
];

export function obtenerNivel(puntos: number): Nivel {
  let nivel = NIVELES[0];
  for (const n of NIVELES) {
    if (puntos >= n.puntos) {
      nivel = n;
    }
  }
  return nivel;
}

/**
 * Check if adding `puntosNuevos` causes a level-up from current `puntosActuales`.
 * Returns the new level object if leveled up, null otherwise.
 */
export function detectarSubidaNivel(puntosActuales: number, puntosNuevos: number): Nivel | null {
  const nivelAntes = obtenerNivel(puntosActuales);
  const nivelDespues = obtenerNivel(puntosActuales + puntosNuevos);

  if (nivelDespues.puntos > nivelAntes.puntos) {
    return nivelDespues;
  }
  return null;
}

export interface ProgresoNivel {
  nivel: Nivel;
  siguiente: Nivel | null;
  progreso: number;
  puntosParaSiguiente: number;
}

export function obtenerProgresoNivel(puntos: number): ProgresoNivel {
  const nivelActual = obtenerNivel(puntos);
  const indexActual = NIVELES.indexOf(nivelActual);
  const siguienteNivel = NIVELES[indexActual + 1] || null;

  if (!siguienteNivel) {
    return {
      nivel: nivelActual,
      siguiente: null,
      progreso: 100,
      puntosParaSiguiente: 0,
    };
  }

  const puntosEnNivel = puntos - nivelActual.puntos;
  const puntosTotalesNivel = siguienteNivel.puntos - nivelActual.puntos;
  const progreso = Math.min(
    100,
    Math.floor((puntosEnNivel / puntosTotalesNivel) * 100)
  );

  return {
    nivel: nivelActual,
    siguiente: siguienteNivel,
    progreso,
    puntosParaSiguiente: siguienteNivel.puntos - puntos,
  };
}
