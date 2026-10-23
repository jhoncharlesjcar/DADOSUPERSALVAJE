import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MascotCelebration from "../app/_components/MascotCelebration";

const viewer = vi.hoisted(() => ({ fail: false }));
vi.mock("next/dynamic", () => ({ default: () => function Viewer({ dadoId }: { dadoId: string }) {
  if (viewer.fail) throw new Error("WebGL unavailable");
  return <div data-testid="animated-mascot">{dadoId}</div>;
} }));
let reduced = false;
let listeners: Set<() => void>;
beforeEach(() => {
  reduced = false; viewer.fail = false; listeners = new Set();
  vi.stubGlobal("matchMedia", () => ({ matches: reduced,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("celebración accesible", () => {
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
