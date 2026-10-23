"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, useSyncExternalStore } from "react";
import { mascotModel } from "@/lib/mascots";

const Viewer = dynamic(() => import("./MascotPreview"), { ssr: false, loading: () => null });
const query = "(prefers-reduced-motion: reduce)";
function subscribe(callback: () => void) {
  const media = window.matchMedia(query); media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
function reducedSnapshot() { return window.matchMedia(query).matches; }
function serverSnapshot() { return true; }

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function MascotCelebration({ dadoId }: { dadoId: string }) {
  const reduced = useSyncExternalStore(subscribe, reducedSnapshot, serverSnapshot);
  const model = mascotModel(dadoId);
  if (!model) return null;
  const fallback = <img src={model.image} alt={model.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />;
  return <div aria-label={`Celebración de ${model.name}`} style={{ position: "relative", width: "100%", height: "clamp(280px, 48vh, 460px)", maxWidth: 620, margin: "0 auto" }}>
    {reduced ? fallback : <ModelBoundary key={dadoId} fallback={fallback}>
      <Viewer dadoId={dadoId} celebration />
    </ModelBoundary>}
  </div>;
}
