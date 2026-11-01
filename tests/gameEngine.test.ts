import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { GameEngine } from "../lib/gameEngine";
import { calcularDistribucion } from "../lib/wallet";
import type { Player } from "../types";

const players: Player[] = [
  { dni: "12345678", nombres: "Ana", puntos: 0 },
  { dni: "87654321", nombres: "Luis", puntos: 0 },
];

describe("liquidación del juego", () => {
  it("reparte exactamente el pozo sin multiplicar los porcentajes", () => {
    const split = calcularDistribucion(2000n);
    expect(split).toEqual({ premioJugador: 1600n, gananciaRanking: 80n, gananciaCasa: 320n, premioPorGanador: 1600n });
    expect(split.premioJugador + split.gananciaRanking + split.gananciaCasa).toBe(2000n);
  });

  it("rechaza pozos no válidos", () => {
    expect(() => calcularDistribucion(0n)).toThrow("Pozo inválido");
    expect(() => calcularDistribucion(Number.NaN as unknown as bigint)).toThrow("Pozo inválido");
  });

  it("calcula el ganador únicamente desde los valores asociados por posición", () => {
    const result = GameEngine.processResults(players, [2, 6]);
    expect(result.esEmpate).toBe(false);
    expect(result.ganadores).toHaveLength(1);
    expect(result.ganadores[0].dni).toBe("87654321");
  });

  it("detecta un empate", () => {
    const result = GameEngine.processResults(players, [5, 5]);
    expect(result.esEmpate).toBe(true);
    expect(result.ganadores).toHaveLength(2);
  });

  it("calcula curva de evolución balanceada sin colapsar en montos altos (R-07)", () => {
    // Partida estándar: 2 jugadores, pozo 20
    const normal = GameEngine.calculateEvolution("12345678", 20, 0, 2);
    expect(normal.puntosGanados).toBeGreaterThanOrEqual(10);
    expect(normal.puntosGanados).toBeLessThanOrEqual(15);

    // Partida high-stakes: 10 jugadores, pozo 1000 (no debe explotar a 40 puntos)
    const highStakes = GameEngine.calculateEvolution("12345678", 1000, 0, 10);
    expect(highStakes.puntosGanados).toBeLessThanOrEqual(25);
    expect(highStakes.puntosGanados).toBeGreaterThan(normal.puntosGanados);
  });

  it("detecta near misses psicológicos para rivales a 1 punto del ganador", () => {
    const threePlayers: Player[] = [
      { dni: "1", nombres: "Carlos Ruiz", puntos: 0 },
      { dni: "2", nombres: "Elena Diaz", puntos: 0 },
      { dni: "3", nombres: "Marcos Soto", puntos: 0 },
    ];
    // Carlos sacó 6 (ganador), Elena 5 (near miss), Marcos 3
    const near = GameEngine.detectNearMisses(
      threePlayers.map((p, i) => ({ ...p, valor: [6, 5, 3][i] })),
      6,
      "1"
    );
    expect(near).toEqual(["Elena"]);
  });
});
