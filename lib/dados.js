export function lanzarDado() {
  return Math.floor(Math.random() * 6) + 1;
}

export function resolverGanador(jugadores) {
  let resultados = jugadores.map((j) => ({
    ...j,
    valor: lanzarDado(),
  }));

  let max = Math.max(...resultados.map((r) => r.valor));
  let ganadores = resultados.filter((r) => r.valor === max);

  // Rondas de desempate
  let rondas = [resultados.map((r) => ({ nombre: r.nombres, valor: r.valor }))];

  while (ganadores.length > 1) {
    ganadores = ganadores.map((j) => ({
      ...j,
      valor: lanzarDado(),
    }));

    rondas.push(
      ganadores.map((r) => ({ nombre: r.nombres, valor: r.valor }))
    );

    max = Math.max(...ganadores.map((r) => r.valor));
    ganadores = ganadores.filter((r) => r.valor === max);
  }

  return {
    ganador: ganadores[0],
    resultados,
    rondas,
  };
}
