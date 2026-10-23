"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import styles from "./mascot-preview.module.css";
import { mascotModel } from "@/lib/mascots";

const clips = [{ id: "Idle", label: "Reposo" }, { id: "Celebrate", label: "Celebración" },
  { id: "Throw", label: "Lanzamiento" }, { id: "Hit", label: "Impacto" }, { id: "Knockout", label: "KO" }];
// Flame nodes exported by tools/blender/build_demonio.py, each parented to a hand bone.
const fireNodes = ["Llamas_Maza", "Llamas_Dado"];

function release(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      geometries.add(obj.geometry);
      for (const material of Array.isArray(obj.material) ? obj.material : [obj.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    }
    if (obj instanceof THREE.SkinnedMesh) skeletons.add(obj.skeleton);
  });
  textures.forEach(texture => texture.dispose()); materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose()); skeletons.forEach(skeleton => skeleton.dispose());
}

export default function MascotPreview({ dadoId = "rojo", celebration = false }: { dadoId?: string; celebration?: boolean }) {
  const mascot = mascotModel(dadoId);
  const host = useRef<HTMLDivElement>(null);
  const playback = useRef<{ play: (name: string) => void; reset: () => void } | null>(null);
  const pausedRef = useRef(!celebration);
  const [paused, setPaused] = useState(!celebration);
  const [finished, setFinished] = useState(false);
  const [selected, setSelected] = useState(celebration ? "Celebrate" : "Idle");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const container = host.current!;
    const info = mascotModel(dadoId);
    if (!info) return;
    let disposed = false, frame = 0, previous = 0, animationTime = 0, needsDraw = true;
    let renderer: THREE.WebGLRenderer | undefined;
    let composer: EffectComposer | undefined;
    let bloom: UnrealBloomPass | undefined;
    let fires: { node: THREE.Object3D; base: THREE.Vector3; light: THREE.PointLight; seed: number }[] = [];
    const steady = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let controls: OrbitControls | undefined;
    let environment: THREE.WebGLRenderTarget | undefined;
    let mixer: THREE.AnimationMixer | undefined;
    let model: THREE.Group | undefined;
    let observer: ResizeObserver | undefined;
    const scene = new THREE.Scene();
    const fail = () => { if (!disposed) setStatus("error"); };
    const lost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frame); fail(); };
    try {
      scene.background = celebration ? null : new THREE.Color("#141a22");
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
      camera.position.set(5, 3.4, 9);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: celebration });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.setAttribute("aria-label", `Modelo 3D de ${info.name}`);
      renderer.domElement.addEventListener("webglcontextlost", lost);
      container.appendChild(renderer.domElement);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      environment = pmrem.fromScene(room, .04);
      scene.environment = environment.texture; room.dispose(); pmrem.dispose();
      const key = new THREE.DirectionalLight(dadoId === "rosado" ? 0xe5ebff : 0xffd0aa, dadoId === "rosado" ? 1.8 : 2.4); key.position.set(3, 6, 4); scene.add(key);
      const rim = new THREE.DirectionalLight(dadoId === "rosado" ? 0xe74bba : 0xff571c, 2.4); rim.position.set(-3, 4, -4); scene.add(rim);
      scene.add(new THREE.HemisphereLight(0xc7dfff, 0x342322, .9));
      if (!celebration) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      // Only emissive lava, runes and flames exceed the threshold, so the armor stays crisp.
      bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .4, .3, .85);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      }
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.85, .12, 64), new THREE.MeshStandardMaterial({ color: 0x29343d, roughness: .5, metalness: .45 }));
      base.position.y = -.08; if (!celebration) scene.add(base); else { base.geometry.dispose(); base.material.dispose(); }
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 2, 0); controls.enableDamping = true;
      controls.minDistance = 4; controls.maxDistance = 16; controls.maxPolarAngle = Math.PI * .55; controls.update();
      controls.enabled = !celebration;
      controls.saveState();
      const resize = () => {
        const width = container.clientWidth, height = container.clientHeight;
        camera.aspect = width / height; camera.updateProjectionMatrix(); renderer!.setSize(width, height);
        composer?.setSize(width, height);
        needsDraw = true;
      };
      observer = new ResizeObserver(resize); observer.observe(container); resize();
      new GLTFLoader().load(info.url, gltf => {
        if (disposed) { release(gltf.scene); return; }
        model = gltf.scene; scene.add(model); mixer = new THREE.AnimationMixer(model);
        // Preserve the lava texture while keeping solid crystal materials readable under ACES and bloom.
        model.traverse(obj => {
          if (!(obj instanceof THREE.Mesh)) return;
          for (const material of Array.isArray(obj.material) ? obj.material : [obj.material])
            if (material instanceof THREE.MeshStandardMaterial) material.emissiveIntensity *= dadoId === "rojo" || dadoId === "rosado" ? .32 : .08;
        });
        fires =fireNodes.flatMap((name, index) => {
          const node = model!.getObjectByName(name);
          if (!node) return [];
          const light = new THREE.PointLight(0xff6418, 2, 2.6, 2); light.position.y = .4; node.add(light);
          return [{ node, base: node.scale.clone(), light, seed: index * 2.7 }];
        });
        const actions = new Map(gltf.animations.map(clip => [clip.name, mixer!.clipAction(clip)]));
        if (!actions.has("Celebrate") || !actions.has("Idle")) { fail(); return; }
        let active: THREE.AnimationAction | undefined;
        const play = (name: string) => {
          const next = actions.get(name);
          if (!next) return;
          active?.stop(); next.reset(); next.clampWhenFinished = true;
          next.setLoop(name === "Idle" ? THREE.LoopRepeat : THREE.LoopOnce, name === "Idle" ? Infinity : 1);
          next.play(); active = next; mixer!.update(0); needsDraw = true;
        };
        playback.current = { play, reset: () => controls!.reset() };
        play("Idle");
        model.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(model, true), size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const distance = Math.max(size.y, size.x / camera.aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.6;
        controls!.target.copy(center); camera.position.copy(center).add(new THREE.Vector3(.28, .10, 1).normalize().multiplyScalar(distance));
        controls!.update(); controls!.saveState();
        mixer.addEventListener("finished", event => { if (celebration && event.action === actions.get("Celebrate")) play("Idle"); });
        if (celebration) play("Celebrate");
        setStatus("ready");
      }, undefined, fail);
      const tick = (now: number) => {
        const delta = previous ? Math.min((now - previous) / 1000, .05) : 0; previous = now;
        if (!document.hidden) {
          if (mixer && !pausedRef.current && (!celebration || animationTime < 12)) {
            mixer.update(delta); animationTime += delta; needsDraw = true;
            if (celebration && animationTime >= 12) setFinished(true);
          }
          for (const fire of fires) {
            const t = animationTime + fire.seed;
            const flicker = steady ? 1 : 1 + .07 * Math.sin(t * 17) + .045 * Math.sin(t * 31 + 1.3);
            fire.node.scale.copy(fire.base).multiplyScalar(flicker); fire.light.intensity = 2 * flicker;
          }
          const cameraMoved = controls!.update();
          if (needsDraw || cameraMoved) { if (composer) composer.render(); else renderer!.render(scene, camera); needsDraw = false; }
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    } catch { queueMicrotask(fail); }
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer?.disconnect(); controls?.dispose();
      playback.current = null; mixer?.stopAllAction(); if (model) mixer?.uncacheRoot(model);
      release(scene); environment?.dispose(); composer?.passes.forEach(pass => pass.dispose()); composer?.dispose();
      renderer?.domElement.removeEventListener("webglcontextlost", lost);
      renderer?.dispose(); renderer?.domElement.remove();
    };
  }, [dadoId, celebration]);

  function choose(id: string) {
    setSelected(id); playback.current?.play(id); pausedRef.current = false; setPaused(false);
  }
  return <section style={celebration ? { height: "100%", position: "relative" } : undefined}>
    {celebration && status !== "ready" && mascot && <img src={mascot.image} alt={mascot.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />}
    <div ref={host} aria-hidden={status !== "ready"} style={{ height: celebration ? "100%" : "min(65vh, 660px)", minHeight: celebration ? 0 : 360, borderRadius: 20, overflow: "hidden", background: celebration ? "transparent" : "#141a22", opacity: celebration && status !== "ready" ? 0 : 1 }} />
    {celebration && status === "ready" && !finished && <div className={styles.toolbar} style={{ position: "absolute", bottom: 0, right: 0 }}><button aria-label={paused ? "Reanudar celebración" : "Pausar celebración"} onClick={event => { event.stopPropagation(); pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); }}>{paused ? "Reanudar" : "Pausar"}</button></div>}
    {!celebration && <>
    <p role="status" style={{ color: "#b4c0ce", margin: "14px 0" }}>{status === "loading" ? "Cargando modelo…" : status === "error" ? "No se pudo mostrar el modelo 3D. Recarga la página para reintentar." : "Arrastra para girar · rueda o pellizco para acercar · elige una animación para reproducirla"}</p>
    <div className={styles.toolbar}>
      {clips.map(clip => <button key={clip.id} disabled={status !== "ready"} aria-pressed={selected === clip.id} onClick={() => choose(clip.id)}>{clip.label}</button>)}
      <button disabled={status !== "ready"} onClick={() => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); }}>{paused ? "Reanudar" : "Pausar"}</button>
      <button disabled={status !== "ready"} onClick={() => playback.current?.reset()}>Restablecer vista</button>
    </div>
    </>}
  </section>;
}
