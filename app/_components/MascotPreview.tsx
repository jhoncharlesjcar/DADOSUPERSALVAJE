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
import { ReplayClock } from "@/lib/arena/clock";

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

export default function MascotPreview({ dadoId = "rojo", celebration = false, onReadyChange }: { dadoId?: string; celebration?: boolean; onReadyChange?: (ready: boolean) => void }) {
  const mascot = mascotModel(dadoId);
  const host = useRef<HTMLDivElement>(null);
  const playback = useRef<{ play: (name: string) => void; reset: () => void } | null>(null);
  const pausedRef = useRef(!celebration);
  const [paused, setPaused] = useState(!celebration);
  const [finished, setFinished] = useState(false);
  const [selected, setSelected] = useState(celebration ? "Celebrate" : "Idle");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [quality, setQuality] = useState<"auto" | "lite" | "full">("auto");
  const savedPlayback = useRef({ dadoId, clip: celebration ? "Celebrate" : "Idle", time: 0, elapsed: 0 });
  const readyCallback = useRef(onReadyChange);
  useEffect(() => { readyCallback.current = onReadyChange; }, [onReadyChange]);

  useEffect(() => {
    const container = host.current!;
    const info = mascotModel(dadoId);
    if (!info) return;
    if (savedPlayback.current.dadoId !== dadoId) savedPlayback.current = { dadoId, clip: celebration ? "Celebrate" : "Idle", time: 0, elapsed: 0 };
    const lightweight = quality === "lite" || (quality === "auto" && window.matchMedia("(max-width: 700px), (pointer: coarse)").matches);
    let disposed = false, frame = 0, previous = 0, animationTime = savedPlayback.current.elapsed, needsDraw = true;
    let renderer: THREE.WebGLRenderer | undefined;
    let composer: EffectComposer | undefined;
    let bloom: UnrealBloomPass | undefined;
    let fires: { node: THREE.Object3D; base: THREE.Vector3; light: THREE.PointLight; seed: number }[] = [];
    const steady = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let controls: OrbitControls | undefined;
    let environment: THREE.WebGLRenderTarget | undefined;
    let mixer: THREE.AnimationMixer | undefined;
    let activeAction: THREE.AnimationAction | undefined;
    let assetsReady = false, presented = false;
    let model: THREE.Group | undefined;
    let observer: ResizeObserver | undefined;
    const scene = new THREE.Scene();
    // Use the same tested monotonic clock as the arena, including suspended RAF in hidden tabs.
    const clock = new ReplayClock();
    const visibility = () => { clock.setRunning(!document.hidden, performance.now()); };
    document.addEventListener("visibilitychange", visibility);
    visibility();
    const fail = () => { if (!disposed) { setStatus("error"); readyCallback.current?.(false); } };
    const lost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(frame); fail(); };
    try {
      scene.background = celebration ? null : new THREE.Color("#141a22");
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
      camera.position.set(5, 3.4, 9);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: celebration });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, lightweight ? 1 : 1.75));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.setAttribute("aria-label", `Modelo 3D de ${info.name}`);
      renderer.domElement.addEventListener("webglcontextlost", lost);
      container.appendChild(renderer.domElement);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      environment = pmrem.fromScene(room, .04);
      scene.environment = environment.texture; room.dispose(); pmrem.dispose();
      const coolLight = dadoId === "rosado" || dadoId === "celeste" || dadoId === "blanco" || dadoId === "negro" || dadoId === "verde" || dadoId === "guinda" || dadoId === "azul";
      const key = new THREE.DirectionalLight(coolLight ? 0xe5ebff : 0xffd0aa, coolLight ? 1.8 : 2.4); key.position.set(3, 6, 4); scene.add(key);
      const rim = new THREE.DirectionalLight(dadoId === "azul" ? 0x387bff : dadoId === "guinda" ? 0xe94b78 : dadoId === "verde" ? 0x36df87 : dadoId === "negro" ? 0x9d50ec : dadoId === "blanco" ? 0xc9e9ff : dadoId === "celeste" ? 0x37cde8 : dadoId === "rosado" ? 0xe74bba : 0xff571c, 2.4); rim.position.set(-3, 4, -4); scene.add(rim);
      scene.add(new THREE.HemisphereLight(0xc7dfff, dadoId === "azul" ? 0x101b32 : dadoId === "guinda" ? 0x28131e : dadoId === "verde" ? 0x15251b : dadoId === "negro" ? 0x1b112a : dadoId === "blanco" ? 0x18212a : dadoId === "celeste" ? 0x0e2438 : 0x342322, .9));
      if (!celebration && !lightweight) {
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
      let fitView: (() => void) | undefined;
      const resize = () => {
        const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
        camera.aspect = width / height; camera.updateProjectionMatrix(); renderer!.setSize(width, height);
        composer?.setSize(width, height);
        fitView?.();
        needsDraw = true;
      };
      observer = new ResizeObserver(resize); observer.observe(container); resize();
      new GLTFLoader().load(lightweight ? info.liteUrl : info.url, gltf => {
        if (disposed) { release(gltf.scene); return; }
        model = gltf.scene; scene.add(model); mixer = new THREE.AnimationMixer(model);
        // Preserve the lava texture while keeping solid crystal materials readable under ACES and bloom.
        model.traverse(obj => {
          if (!(obj instanceof THREE.Mesh)) return;
          for (const material of Array.isArray(obj.material) ? obj.material : [obj.material])
            if (material instanceof THREE.MeshStandardMaterial) material.emissiveIntensity *= dadoId === "blanco" || dadoId === "negro" || dadoId === "verde" || dadoId === "guinda" || dadoId === "naranja" || dadoId === "azul" ? .6 : dadoId === "rojo" || dadoId === "rosado" || dadoId === "celeste" ? .32 : .08;
        });
        fires =fireNodes.flatMap((name, index) => {
          const node = model!.getObjectByName(name);
          if (!node) return [];
          const light = new THREE.PointLight(0xff6418, 2, 2.6, 2); light.position.y = .4; node.add(light);
          return [{ node, base: node.scale.clone(), light, seed: index * 2.7 }];
        });
        const actions = new Map(gltf.animations.map(clip => [clip.name, mixer!.clipAction(clip)]));
        if (!actions.has("Celebrate") || !actions.has("Idle")) { fail(); return; }
        const play = (name: string) => {
          const next = actions.get(name);
          if (!next) return;
          activeAction?.stop(); next.reset(); next.clampWhenFinished = true;
          next.setLoop(name === "Idle" ? THREE.LoopRepeat : THREE.LoopOnce, name === "Idle" ? Infinity : 1);
          next.play(); activeAction = next; mixer!.update(0); needsDraw = true;
          savedPlayback.current.clip = name; savedPlayback.current.time = 0;
        };
        playback.current = { play, reset: () => controls!.reset() };
        const resume = { ...savedPlayback.current };
        play("Idle");
        model.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(model, true), size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        fitView = () => {
          const distance = Math.max(size.y, size.x / camera.aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.6;
          controls!.maxDistance = Math.max(16, distance * 1.5);
          controls!.target.copy(center); camera.position.copy(center).add(new THREE.Vector3(.28, .10, 1).normalize().multiplyScalar(distance));
          controls!.update(); controls!.saveState();
        };
        fitView();
        mixer.addEventListener("finished", event => { if (celebration && event.action === actions.get("Celebrate")) play("Idle"); });
        play(resume.clip);
        const resumed = actions.get(resume.clip);
        if (resumed) { resumed.time = resume.time; mixer.update(0); }
        savedPlayback.current.time = resume.time;
        assetsReady = true;
        setStatus("ready");
      }, undefined, fail);
      const tick = (now: number) => {
        const elapsed = clock.read(now);
        const delta = Math.max(0, elapsed - previous); previous = elapsed;
        if (!document.hidden) {
          if (mixer && !pausedRef.current && (!celebration || animationTime < 12)) {
            mixer.update(delta); animationTime += delta; needsDraw = true;
            savedPlayback.current.elapsed = animationTime;
            if (activeAction) savedPlayback.current.time = activeAction.time;
            if (celebration && animationTime >= 12) setFinished(true);
          }
          for (const fire of fires) {
            const t = animationTime + fire.seed;
            const flicker = steady ? 1 : 1 + .07 * Math.sin(t * 17) + .045 * Math.sin(t * 31 + 1.3);
            fire.node.scale.copy(fire.base).multiplyScalar(flicker); fire.light.intensity = 2 * flicker;
          }
          const cameraMoved = controls!.update();
          if (needsDraw || cameraMoved) {
            try { if (composer) composer.render(); else renderer!.render(scene, camera); }
            catch { fail(); return; }
            needsDraw = false;
            if (assetsReady && !presented) { presented = true; readyCallback.current?.(true); }
          }
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    } catch { queueMicrotask(fail); }
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer?.disconnect(); controls?.dispose();
      document.removeEventListener("visibilitychange", visibility);
      playback.current = null; mixer?.stopAllAction(); if (model) mixer?.uncacheRoot(model);
      release(scene); environment?.dispose(); composer?.passes.forEach(pass => pass.dispose()); composer?.dispose();
      renderer?.domElement.removeEventListener("webglcontextlost", lost);
      renderer?.dispose(); renderer?.domElement.remove();
    };
  }, [dadoId, celebration, quality]);

  function choose(id: string) {
    setSelected(id); playback.current?.play(id); pausedRef.current = false; setPaused(false);
  }
  return <section style={celebration ? { height: "100%", position: "relative" } : undefined}>
    {celebration && !onReadyChange && status !== "ready" && mascot && <img src={mascot.image} alt={mascot.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />}
    <div ref={host} aria-hidden={status !== "ready"} style={{ height: celebration ? "100%" : "min(65vh, 660px)", minHeight: celebration ? 0 : 360, borderRadius: 20, overflow: "hidden", background: celebration ? "transparent" : "#141a22", opacity: celebration && status !== "ready" ? 0 : 1 }} />
    {celebration && status === "ready" && !finished && <div className={styles.toolbar} style={{ position: "absolute", bottom: 0, right: 0 }}><button aria-label={paused ? "Reanudar celebración" : "Pausar celebración"} onClick={event => { event.stopPropagation(); pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); }}>{paused ? "Reanudar" : "Pausar"}</button></div>}
    {!celebration && <>
    <p role="status" style={{ color: "#b4c0ce", margin: "14px 0" }}>{status === "loading" ? "Cargando modelo…" : status === "error" ? "No se pudo mostrar el modelo 3D. Recarga la página para reintentar." : "Arrastra para girar · rueda o pellizco para acercar · elige una animación para reproducirla"}</p>
    <div className={styles.toolbar}>
      <label>Calidad de mascota <select aria-label="Calidad de mascota" value={quality} onChange={event => { setStatus("loading"); readyCallback.current?.(false); setQuality(event.target.value as "auto" | "lite" | "full"); }}><option value="auto">Automática</option><option value="lite">Ligera</option><option value="full">Completa</option></select></label>
      {clips.map(clip => <button key={clip.id} disabled={status !== "ready"} aria-pressed={selected === clip.id} onClick={() => choose(clip.id)}>{clip.label}</button>)}
      <button disabled={status !== "ready"} onClick={() => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); }}>{paused ? "Reanudar" : "Pausar"}</button>
      <button disabled={status !== "ready"} onClick={() => playback.current?.reset()}>Restablecer vista</button>
    </div>
    </>}
  </section>;
}
