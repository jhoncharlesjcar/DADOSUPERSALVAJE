import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MascotCelebration from "../app/_components/MascotCelebration";

const viewer = vi.hoisted(() => ({ fail: false, modulePending: false, ready: undefined as undefined | ((ready: boolean) => void) }));
vi.mock("next/dynamic", () => ({ default: () => function Viewer({ dadoId, onReadyChange }: { dadoId: string; onReadyChange?: (ready: boolean) => void }) {
  viewer.ready = onReadyChange;
  if (viewer.modulePending) return null;
  if (viewer.fail) throw new Error("WebGL unavailable");
  return <div data-testid="animated-mascot">{dadoId}</div>;
} }));
let reduced = false;
let listeners: Set<() => void>;
beforeEach(() => {
  reduced = false; viewer.fail = false; viewer.modulePending = false; viewer.ready = undefined; listeners = new Set();
  vi.stubGlobal("matchMedia", () => ({ matches: reduced,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("celebración accesible", () => {
  it("mantiene la ilustración mientras descarga el módulo del visor", () => {
    viewer.modulePending = true;
    render(<MascotCelebration dadoId="azul" />);
    expect(screen.queryByTestId("animated-mascot")).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", "/mascots/poseidon.webp");
  });
  it("oculta el respaldo solo cuando el GLB está listo y lo recupera al perder WebGL", () => {
    render(<MascotCelebration dadoId="rojo" />);
    expect(screen.getByRole("img")).toBeInTheDocument();
    act(() => viewer.ready?.(true));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    act(() => viewer.ready?.(false));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/mascots/demonio.webp");
  });
  it("respeta cambios de movimiento reducido sin mantener el visor activo", () => {
    const { unmount } = render(<MascotCelebration dadoId="rojo" />);
    expect(screen.getByTestId("animated-mascot")).toHaveTextContent("rojo");
    act(() => { reduced = true; listeners.forEach(listener => listener()); });
    expect(screen.queryByTestId("animated-mascot")).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", "/mascots/demonio.webp");
    act(() => { reduced = false; listeners.forEach(listener => listener()); });
    expect(screen.getByTestId("animated-mascot")).toBeInTheDocument();
    unmount(); expect(listeners.size).toBe(0);
  });
  it("conserva la ilustración si el visor falla", () => {
    viewer.fail = true; vi.spyOn(console, "error").mockImplementation(() => {});
    render(<MascotCelebration dadoId="rojo" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/mascots/demonio.webp");
  });
  it("no inventa una mascota para un dado desconocido", () => {
    const { container } = render(<MascotCelebration dadoId="inexistente" />);
    expect(container).toBeEmptyDOMElement();
  });
});
