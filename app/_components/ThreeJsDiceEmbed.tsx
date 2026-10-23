"use client";

import { useEffect, useRef } from "react";
import type { ArenaPlayer, ArenaRound } from "@/lib/arena/types";
import { simulateFlight, FLIGHT_START } from "@/lib/arena/physics";
import { createArenaScene, type Quality } from "@/lib/arena/scene";
import type { DicePhase } from "@/types";

interface Props {
  round: ArenaRound; players: ArenaPlayer[]; seed: string; quality: Quality;
  paused: boolean; skip: boolean; onComplete: () => void;
  onError: () => void; onPhase: (phase: DicePhase) => void;
  onImpact: (strength: number) => void;
}

export default function ThreeJsDiceEmbed(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef(props);
  useEffect(() => { current.current = props; });
  const { round, players, seed, quality } = props;
  useEffect(() => {
    if (!host.current) return;
    let arena: ReturnType<typeof createArenaScene> | undefined;
    let raf = 0, elapsed = 0, previous = 0, impactIndex = 0, finished = false, lastDraw = -1;
    let phase: DicePhase = "idle";
    let lostCanvas: HTMLCanvasElement | undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const contextLost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(raf); current.current.onError(); };
    // Let the loading state paint before preparing the deterministic contact simulation.
    raf = requestAnimationFrame(() => {
      try {
        const flight = simulateFlight(round, seed);
        arena = createArenaScene(host.current!, players, flight, quality);
        lostCanvas = arena.canvas; lostCanvas.addEventListener("webglcontextlost", contextLost);
        const end = FLIGHT_START + flight.duration + 0.5;
        function tick(now: number) {
          try {
            const delta = previous ? Math.min((now - previous) / 1000, 0.05) : 0; previous = now;
            if (current.current.skip || reduced) elapsed = end;
            else if (!current.current.paused && !document.hidden) elapsed += delta;
            const nextPhase: DicePhase = elapsed < 0.65 ? "cup_entry" : elapsed < 2.05 ? "cup_shake" : elapsed < FLIGHT_START+2 ? "launching" : elapsed < end ? "settling" : "winner_reveal";
            if (nextPhase !== phase) { phase = nextPhase; current.current.onPhase(phase); }
            while (impactIndex < flight.impacts.length && flight.impacts[impactIndex].time+FLIGHT_START <= elapsed) {
              const impact = flight.impacts[impactIndex++];
              if (!current.current.skip && !reduced && !document.hidden) current.current.onImpact(impact.strength);
            }
            if (!document.hidden && elapsed !== lastDraw) { arena!.render(elapsed); lastDraw = elapsed; }
            if (elapsed >= end) { if (!finished) { finished = true; current.current.onComplete(); } return; }
            raf = requestAnimationFrame(tick);
          } catch { current.current.onError(); }
        }
        raf = requestAnimationFrame(tick);
      } catch { current.current.onError(); }
    });
    return () => { cancelAnimationFrame(raf); lostCanvas?.removeEventListener("webglcontextlost",contextLost); arena?.dispose(); };
  }, [round, players, seed, quality]);
  return <div className="arena-canvas" ref={host} />;
}
