import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GameResults from "../app/_components/GameResults";
import { DADOS_DISPONIBLES } from "../lib/dados";
import { MASCOT_MODELS } from "../lib/mascots";
import type { GameResult, LevelUp } from "../types";

const motionPreference = vi.hoisted(() => ({ reduced: false }));
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const component = (tag: string) => function Motion({ initial, animate: _animate, transition, whileHover: _hover, ...props }: Record<string, unknown>) {
    return React.createElement(tag, { ...props, "data-motion-initial": JSON.stringify(initial), "data-motion-duration": (transition as { duration?: number })?.duration });
  };
  return { motion: { div: component("div"), img: component("img") }, AnimatePresence: ({ children }: { children: React.ReactNode }) => children, useReducedMotion: () => motionPreference.reduced };
});
vi.mock("../app/_components/MascotCelebration", () => ({ default: () => <div aria-label="Mascota del ganador" /> }));
vi.mock("../lib/particleSystem", () => ({ victoryExplosion: vi.fn(), coinShower: vi.fn(), screenFlash: vi.fn() }));
vi.mock("../lib/soundEngine", () => ({ playWinFanfare: vi.fn() }));

const winner = { dni: "1", nombres: "Campeona", puntos: 100, dadoId: "naranja", valor: 6 };
const loser = { dni: "2", nombres: "Jugador con nombre muy largo", puntos: 0, dadoId: "azul", valor: 3 };
const result: GameResult = { ganador: winner, resultados: [loser, winner], rondas: [[winner, loser]], premio: 16, pozo: 20, monto: 10 };
const levelUp: LevelUp = { nombre: "Reinado de las diez coronas salvajes", emoji: "👑", puntosGanados: 50, puntosTotal: 100, rachaActual: 2 };
const dialogDescriptors = Object.getOwnPropertyDescriptors(HTMLDialogElement.prototype);

beforeEach(() => {
  motionPreference.reduced = false;
  // jsdom has no native modal/top-layer behavior; these shims cover the React lifecycle only.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
    this.querySelector<HTMLElement>("[autofocus]")?.focus();
  }) });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: vi.fn(function (this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  }) });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  for (const method of ["showModal", "close"]) {
    if (dialogDescriptors[method]) Object.defineProperty(HTMLDialogElement.prototype, method, dialogDescriptors[method]);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, method);
  }
});

describe("resultados y ascenso accesibles", () => {
  it("conserva los resultados completos y usa la misma identidad de mascota que la galería", () => {
    render(<GameResults resultado={result} levelUp={null} onNewGame={vi.fn()} onDismissLevelUp={vi.fn()} />);
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Campeona");
    expect(rows[2]).toHaveTextContent("Jugador con nombre muy largo");
    expect(screen.getByText("DERROTA")).toBeVisible();
    expect(screen.getByText("Bestia de Fuego")).toBeVisible();
    for (const dado of DADOS_DISPONIBLES) expect(dado.nombre).toBe(MASCOT_MODELS[dado.id].name);
    expect(DADOS_DISPONIBLES.find(dado => dado.id === "naranja")?.imagen).toBe("/dados/naranja.webp");
  });

  it("abre un diálogo con nombre y descripción; continuar cierra una vez y devuelve el foco", () => {
    const dismiss = vi.fn();
    const trigger = document.createElement("button");
    document.body.appendChild(trigger); trigger.focus();
    const { unmount } = render(<GameResults resultado={result} levelUp={levelUp} onNewGame={vi.fn()} onDismissLevelUp={dismiss} />);
    const dialog = screen.getByRole("dialog", { name: "¡ASCENSO DE PODER!" });
    expect(dialog).toHaveAccessibleDescription("NUEVO RANGO ALCANZADO CON 100 PUNTOS");
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByText(levelUp.nombre!));
    expect(dismiss).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "CONTINUAR MI REINADO" }));
    expect(dismiss).toHaveBeenCalledTimes(1);
    unmount();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
    trigger.remove();
  });

  it("propaga el cierre nativo (incluido Escape) al estado padre", () => {
    const dismiss = vi.fn();
    render(<GameResults resultado={result} levelUp={levelUp} onNewGame={vi.fn()} onDismissLevelUp={dismiss} />);
    act(() => (screen.getByRole("dialog") as HTMLDialogElement).close());
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("elimina la entrada desplazada y escalada con movimiento reducido, incluso al cambiar la preferencia", () => {
    const { container, rerender } = render(<GameResults resultado={result} levelUp={null} onNewGame={vi.fn()} onDismissLevelUp={vi.fn()} />);
    expect(container.querySelector('[data-motion-initial*="scale"]')).not.toBeNull();
    motionPreference.reduced = true;
    rerender(<GameResults resultado={result} levelUp={null} onNewGame={vi.fn()} onDismissLevelUp={vi.fn()} />);
    const wrappers = container.querySelectorAll("[data-motion-initial]");
    expect(wrappers.length).toBeGreaterThan(0);
    wrappers.forEach(wrapper => {
      expect(wrapper).toHaveAttribute("data-motion-initial", "false");
      expect(wrapper).toHaveAttribute("data-motion-duration", "0");
    });
  });
});
