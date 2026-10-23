import { describe, it, expect } from "vitest";
import { obtenerNivel, obtenerProgresoNivel, detectarSubidaNivel, NIVELES } from "../lib/cofres";

describe("Logic: Lógica de Niveles (Cofres)", () => {
  
  it("debe retornar 'SIN NIVEL' para 0 puntos", () => {
    const nivel = obtenerNivel(0);
    expect(nivel.nombre).toBe("SIN NIVEL");
  });

  it("debe retornar 'BRONCE' para 1200 puntos", () => {
    const nivel = obtenerNivel(1200);
    expect(nivel.nombre).toBe("BRONCE");
  });

  it("debe retornar el nivel más alto alcanzado (PLATA para 3000 puntos)", () => {
    const nivel = obtenerNivel(3000);
    expect(nivel.nombre).toBe("PLATA");
  });

  it("debe retornar 'DADO SALVAJE' para puntos extremos", () => {
    const nivel = obtenerNivel(100000);
    expect(nivel.nombre).toBe("DADO SALVAJE");
  });

  it("debe detectar una subida de nivel correctamente", () => {
    // De 1100 (SIN NIVEL) a 1300 (BRONCE)
    const levelUp = detectarSubidaNivel(1100, 200);
    expect(levelUp).not.toBeNull();
    expect(levelUp?.nombre).toBe("BRONCE");
  });

  it("no debe detectar subida de nivel si permanece en el mismo rango", () => {
    // De 1300 a 1400 sigue siendo BRONCE
    const levelUp = detectarSubidaNivel(1300, 100);
    expect(levelUp).toBeNull();
  });

  it("debe calcular el progreso al siguiente nivel correctamente", () => {
    // BRONCE es 1200, PLATA es 2400.
    // 1800 está a la mitad (50%)
    const progreso = obtenerProgresoNivel(1800);
    expect(progreso.progreso).toBe(50);
    expect(progreso.puntosParaSiguiente).toBe(600);
    expect(progreso.siguiente?.nombre).toBe("PLATA");
  });

  it("debe manejar el nivel máximo en el progreso", () => {
    const progreso = obtenerProgresoNivel(50000);
    expect(progreso.progreso).toBe(100);
    expect(progreso.siguiente).toBeNull();
    expect(progreso.puntosParaSiguiente).toBe(0);
  });

});
