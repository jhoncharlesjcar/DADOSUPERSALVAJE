export const NIVELES = [
  { nombre: "SIN NIVEL", emoji: "⬛", color: "#555577", puntos: 0 },
  { nombre: "BRONCE", emoji: "🟤", color: "#cd7f32", puntos: 1200 },
  { nombre: "PLATA", emoji: "⚪", color: "#c0c0c0", puntos: 2400 },
  { nombre: "ORO", emoji: "🟡", color: "#ffd700", puntos: 4800 },
  { nombre: "DIAMANTE", emoji: "💎", color: "#00bfff", puntos: 9600 },
  { nombre: "GALÁCTICO", emoji: "🌌", color: "#9b59b6", puntos: 19200 },
  { nombre: "DADO SALVAJE", emoji: "🎲", color: "#ff3d00", puntos: 38400 },
];

export function obtenerNivel(puntos) {
  let nivel = NIVELES[0];
  for (const n of NIVELES) {
    if (puntos >= n.puntos) {
      nivel = n;
    }
  }
  return nivel;
}

export function obtenerProgresoNivel(puntos) {
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
