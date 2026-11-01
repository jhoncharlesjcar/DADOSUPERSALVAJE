"use client";

import { useEffect, useRef } from "react";
import type { ArenaPlayer, ArenaRound } from "@/lib/arena/types";
import { simulateFlight, FLIGHT_START } from "@/lib/arena/physics";
import { createArenaScene, type Quality } from "@/lib/arena/scene";
import { ReplayClock } from "@/lib/arena/clock";
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
  const runtime = useRef<{ clock: ReplayClock; setQuality: (quality: Quality) => void } | null>(null);
  useEffect(() => { current.current = props; });
  useEffect(() => { runtime.current?.setQuality(props.quality); }, [props.quality]);
  useEffect(() => { runtime.current?.clock.setRunning(!props.paused && !document.hidden, performance.now()); }, [props.paused]);
  const { round, players, seed } = props;
  useEffect(() => {
    if (!host.current) return;
    let arena: ReturnType<typeof createArenaScene> | undefined;
    let raf = 0, impactIndex = 0, finished = false, lastDraw = -1;
    const clock = new ReplayClock();
    let phase: DicePhase = "idle";
    let lostCanvas: HTMLCanvasElement | undefined;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const visibilityChanged = () => clock.setRunning(!current.current.paused && !document.hidden, performance.now());
    document.addEventListener("visibilitychange", visibilityChanged);
    const contextLost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(raf); current.current.onError(); };
    // Let the loading state paint before preparing the deterministic contact simulation.
    raf = requestAnimationFrame(() => {
      try {
        const flight = simulateFlight(round, seed);
        arena = createArenaScene(host.current!, players, flight, current.current.quality);
        runtime.current = { clock, setQuality: arena.setQuality };
        visibilityChanged();
        lostCanvas = arena.canvas; lostCanvas.addEventListener("webglcontextlost", contextLost);
        const end = FLIGHT_START + flight.duration + 0.5;
        function tick(now: number) {
          try {
            const reduced = motion.matches;
            if (current.current.skip || reduced) clock.seek(end, now);
            const elapsed = clock.read(now);
            const nextPhase: DicePhase = elapsed < 0.65 ? "cup_entry" : elapsed < 2.05 ? "cup_shake" : elapsed < FLIGHT_START+2 ? "launching" : elapsed < end ? "settling" : "winner_reveal";
            if (nextPhase !== phase) { phase = nextPhase; current.current.onPhase(phase); }
            while (impactIndex < flight.impacts.length && flight.impacts[impactIndex].time+FLIGHT_START <= elapsed) {
              const impact = flight.impacts[impactIndex++];
              // Late frames advance to real time without playing a backlog of stale sounds.
              if (!current.current.skip && !reduced && !document.hidden && elapsed - impact.time - FLIGHT_START < 0.12) current.current.onImpact(impact.strength);
            }
            if (!document.hidden && elapsed !== lastDraw) { arena!.render(elapsed); lastDraw = elapsed; }
            if (elapsed >= end) { if (!finished) { finished = true; current.current.onComplete(); } return; }
            raf = requestAnimationFrame(tick);
          } catch { current.current.onError(); }
        }
        raf = requestAnimationFrame(tick);
      } catch { current.current.onError(); }
    });
    return () => { cancelAnimationFrame(raf); runtime.current = null; document.removeEventListener("visibilitychange", visibilityChanged); lostCanvas?.removeEventListener("webglcontextlost",contextLost); arena?.dispose(); };
  }, [round, players, seed]);
  return <div className="arena-canvas" ref={host} />;
}
