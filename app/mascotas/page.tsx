"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { MASCOT_MODELS } from "@/lib/mascots";
import MascotCelebration from "../_components/MascotCelebration";
import styles from "../_components/mascot-preview.module.css";

const MascotPreview = dynamic(() => import("../_components/MascotPreview"), {
  ssr: false,
  loading: () => <p role="status">Preparando visor…</p>,
});

export default function MascotasPage() {
  const [selected, setSelected] = useState("rojo");
  const [celebration, setCelebration] = useState(false);
  const [compare, setCompare] = useState(false);
  const model = MASCOT_MODELS[selected];
  return <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 18px 60px" }}>
    <header style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
      <div><p style={{ color: model.accent, fontSize: 12, letterSpacing: 2 }}>TALLER DE MASCOTAS · COLECCIÓN 3D</p>
        <h1 style={{ fontSize: 30, marginTop: 8 }}>{model.name}</h1></div>
      <Link href="/arena" style={{ color: "#ce9e67" }}>Ver arena</Link>
    </header>
    <div className={styles.toolbar} role="group" aria-label="Elegir mascota" style={{ marginBottom: 20 }}>
      {Object.entries(MASCOT_MODELS).map(([id, entry]) => <button key={id} aria-pressed={id === selected} onClick={() => setSelected(id)}>{entry.name}</button>)}
    </div>
    <div className={styles.toolbar} style={{ marginBottom: 18 }}>
      <button aria-pressed={!celebration} onClick={() => setCelebration(false)}>Explorar animaciones</button>
      <button aria-pressed={celebration} onClick={() => setCelebration(true)}>Ver celebración de partida</button>
      <button aria-pressed={compare} onClick={() => setCompare(!compare)}>Comparar con imagen</button>
    </div>
    <div className={compare ? styles.comparison : undefined}>
      {compare && <figure className={styles.reference}>
        <figcaption>Ilustración original</figcaption>
        <Image src={`/mascots/${model.slug}.webp`} alt={`Referencia original de ${model.name}`} width={1024} height={1024} sizes="(max-width: 700px) 100vw, 530px" />
      </figure>}
      <div style={{ minWidth: 0 }}>
        {compare && <p className={styles.caption}>Modelo 3D · gira para revisar</p>}
        {celebration ? <MascotCelebration key={selected} dadoId={selected} /> : <MascotPreview key={`${selected}-${compare}`} dadoId={selected} />}
      </div>
    </div>
    <p style={{ color: "#a7b1bb", lineHeight: 1.7, marginTop: 22 }}>{model.description} Modelos estilizados basados en las ilustraciones del proyecto. La celebración se muestra al confirmar el resultado; si no se puede cargar el 3D o se prefiere movimiento reducido, se conserva la imagen de la mascota.</p>
  </main>;
}
