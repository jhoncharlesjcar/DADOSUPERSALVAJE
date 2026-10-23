import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { DIE_SIZE, FACE_VALUES, FLIGHT_START, seededRandom, type Flight } from "./physics";
import type { ArenaPlayer } from "./types";

export type Quality = "low" | "medium" | "high";
export const PALETTE: Record<string, string> = { rojo: "#a52e2c", rosado: "#bd5283", amarillo: "#d5b557", celeste: "#318eac", blanco: "#e9e3cf", negro: "#282d33", verde: "#368c62", guinda: "#702d47", naranja: "#c77532", azul: "#355ab2" };

function canvasTexture(draw: (ctx: CanvasRenderingContext2D) => void, size = 512) {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear la textura");
  ctx.scale(size / 512, size / 512);
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function grain(seed: string, base: string, amount: number) {
  const random = seededRandom(seed);
  const texture = canvasTexture(ctx => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 45000; i++) {
      ctx.fillStyle = `rgba(${random() > 0.5 ? "255,255,255" : "0,0,0"},${random() * amount})`;
      ctx.fillRect(random() * 512, random() * 512, 1, 2);
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const pips: Record<number, number[][]> = {
  1: [[0,0]], 2: [[-1,-1],[1,1]], 3: [[-1,-1],[0,0],[1,1]],
  4: [[-1,-1],[1,-1],[-1,1],[1,1]], 5: [[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],
  6: [[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]],
};

function diceMaterials(color: string, darkPips: boolean, size: number, bumps: Map<number, THREE.Texture>) {
  return FACE_VALUES.map(value => {
    const map = canvasTexture(ctx => {
      ctx.fillStyle = color; ctx.fillRect(0,0,512,512);
      const sheen = ctx.createLinearGradient(0,0,512,512);
      sheen.addColorStop(0,"rgba(255,255,255,.12)"); sheen.addColorStop(1,"rgba(0,0,0,.13)");
      ctx.fillStyle = sheen; ctx.fillRect(0,0,512,512);
      ctx.strokeStyle = "rgba(225,200,146,.28)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(48,48,416,416,48); ctx.stroke();
      pips[value].forEach(([x,y]) => {
        ctx.beginPath(); ctx.arc(256+x*115,256+y*115,35,0,Math.PI*2);
        ctx.fillStyle = darkPips ? "#24292a" : "#f3e6c7"; ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 4; ctx.stroke();
      });
    }, size);
    const bumpMap = bumps.get(value) || canvasTexture(ctx => {
      ctx.fillStyle = "#aaa"; ctx.fillRect(0,0,512,512);
      pips[value].forEach(([x,y]) => {
        const gradient = ctx.createRadialGradient(256+x*115,256+y*115,25,256+x*115,256+y*115,38);
        gradient.addColorStop(0,"#333"); gradient.addColorStop(1,"#aaa");
        ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(256+x*115,256+y*115,38,0,Math.PI*2); ctx.fill();
      });
    }, size);
    bumpMap.colorSpace = THREE.NoColorSpace;
    bumps.set(value, bumpMap);
    return new THREE.MeshPhysicalMaterial({ map, bumpMap, bumpScale: 0.035, roughness: 0.27, metalness: 0.12, clearcoat: 0.65, clearcoatRoughness: 0.22 });
  });
}

export function createArenaScene(host: HTMLElement, players: ArenaPlayer[], flight: Flight, quality: Quality) {
  const renderer = new THREE.WebGLRenderer({ antialias: quality !== "low", alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, {low:1,medium:1.5,high:2}[quality]));
  renderer.shadowMap.enabled = quality !== "low";
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.domElement.setAttribute("aria-label", "Mesa tridimensional con cubilete y dados");
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color("#080f13");
  scene.fog = new THREE.FogExp2("#080f13", 0.015);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment(); const environment = pmrem.fromScene(room, 0.03);
  scene.environment = environment.texture; scene.environmentIntensity = 0.45;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xc7e6ff, 0x453221, 0.65));
  const key = new THREE.DirectionalLight(0xffebcf, 3); key.position.set(-4,10,5); key.castShadow = true;
  key.shadow.mapSize.setScalar(quality === "high" ? 2048 : 1024);
  Object.assign(key.shadow.camera, { left:-10,right:10,top:10,bottom:-10,near:0.5,far:35 });
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.025; key.shadow.radius = 3;
  scene.add(key);
  const rimLight = new THREE.DirectionalLight(0x85bfcf, 2); rimLight.position.set(5,5,-7); scene.add(rimLight);
  const gold = new THREE.MeshStandardMaterial({color:0xbca16b,metalness:0.8,roughness:0.29});
  const felt = grain("felt", "#18473f", 0.2); felt.repeat.set(6,6);
  const feltMaterial = new THREE.MeshStandardMaterial({map:felt,bumpMap:felt,bumpScale:0.025,roughness:0.96});
  const leather = grain("leather", "#302624", 0.3); leather.repeat.set(3,2);
  const leatherMaterial = new THREE.MeshStandardMaterial({map:leather,bumpMap:leather,bumpScale:0.035,roughness:0.64});
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = scene) {
    const m = new THREE.Mesh(geometry,material); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  const base = mesh(new THREE.CylinderGeometry(8.65,8.5,0.65,96), leatherMaterial); base.position.y = -0.36;
  const table = mesh(new THREE.CylinderGeometry(8.25,8.25,0.08,96),feltMaterial); table.position.y = -0.04;
  function ring(radius: number, tube: number, y: number, material = gold, parent: THREE.Object3D = scene) {
    const m = mesh(new THREE.TorusGeometry(radius,tube,12,96),material,parent); m.rotation.x = Math.PI/2; m.position.y = y; return m;
  }
  ring(8.4,0.23,0.15,leatherMaterial); ring(8.15,0.025,0.025); ring(8.64,0.04,-0.15);
  const print = canvasTexture(ctx => {
    ctx.clearRect(0,0,512,512); ctx.strokeStyle = "rgba(205,187,137,.28)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(256,256,224,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(256,256,210,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle = "rgba(205,187,137,.35)"; ctx.textAlign = "center";
    ctx.font = "26px Georgia"; ctx.fillText("D A D O  S A L V A J E",256,245);
    ctx.font = "13px sans-serif"; ctx.fillText("L A   A R E N A",256,277);
  });
  const insignia = mesh(new THREE.PlaneGeometry(9,9),new THREE.MeshBasicMaterial({map:print,transparent:true,depthWrite:false}));
  insignia.rotation.x = -Math.PI/2; insignia.position.y = 0.004; insignia.castShadow = false;
  const floor = mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshStandardMaterial({color:0x03070b,roughness:0.8}));
  floor.rotation.x = -Math.PI/2; floor.position.y = -0.75;
  // Closed, double-wall profile: a visible hollow mouth, a thick rim and a solid base.
  const cup = new THREE.Group(); scene.add(cup);
  const profile = [[0,0],[0.77,0],[0.85,0.1],[1.06,2.1],[1.05,2.2],[0.95,2.2],[0.93,2.08],[0.72,0.18],[0,0.18]].map(([x,y])=>new THREE.Vector2(x,y));
  mesh(new THREE.LatheGeometry(profile,64),leatherMaterial,cup);
  ring(1.01,0.055,2.16,gold,cup); ring(0.81,0.045,0.12,gold,cup); ring(0.95,0.018,1.58,gold,cup);
  for(let i=0;i<32;i++) {
    const angle=i*Math.PI/16;
    const stud=mesh(new THREE.SphereGeometry(0.025,6,6),gold,cup);
    stud.position.set(Math.cos(angle)*0.91,0.85,Math.sin(angle)*0.91);
  }
  const geometry = new RoundedBoxGeometry(DIE_SIZE,DIE_SIZE,DIE_SIZE,3,0.065);
  const bumps = new Map<number, THREE.Texture>();
  const dice = players.map(player => {
    const die = new THREE.Mesh(geometry,diceMaterials(PALETTE[player.dadoId] || PALETTE.rojo,["amarillo","blanco"].includes(player.dadoId),quality === "high" ? 512 : 256,bumps));
    die.castShadow = true; die.receiveShadow = true; scene.add(die); return die;
  });
  const q = new THREE.Quaternion(), nextQ = new THREE.Quaternion();
  const offsets = flight.offsets.map(value => new THREE.Quaternion(...value));
  const finalFrame = flight.frames.at(-1)!;
  const bounds = new THREE.Box3();
  players.forEach((_, i) => bounds.expandByPoint(new THREE.Vector3(finalFrame[i*7],0,finalFrame[i*7+2])));
  const center = bounds.getCenter(new THREE.Vector3()), span = bounds.getSize(new THREE.Vector3());
  function resize() {
    const width = Math.max(host.clientWidth,1), height = Math.max(host.clientHeight,1);
    renderer.setSize(width,height,false); camera.aspect=width/height;
    const distance = camera.aspect < 1 ? 24/camera.aspect : 23;
    camera.position.set(0,distance*0.78,distance*0.65); camera.lookAt(0,0,-0.6); camera.updateProjectionMatrix();
    renderer.render(scene,camera);
  }
  let lastTime = 0;
  const observer=new ResizeObserver(() => { resize(); render(lastTime); }); observer.observe(host); resize();
  const smooth=(v:number)=>{v=THREE.MathUtils.clamp(v,0,1);return v*v*(3-2*v);};
  function render(time: number) {
    lastTime = time;
    const entry=smooth(time/0.65), pour=smooth((time-2.05)/0.6);
    const shake=time>0.65&&time<2.05 ? Math.sin((time-0.65)*23)*0.19 : 0;
    const leave=smooth((time-FLIGHT_START-flight.releases.at(-1)!-0.6)/1);
    cup.position.set(shake*2+leave*7,0.15+entry*2.85+shake*0.5,-4.0);
    cup.rotation.set(pour*Math.PI/2,0,shake); cup.visible=leave<1;
    const elapsed=Math.max(0,time-FLIGHT_START);
    const closeup=smooth((elapsed-flight.releases.at(-1)!-1.4)/2.2);
    const overview=camera.aspect<1?24/camera.aspect:23;
    const closeDistance=Math.max(8.5,(Math.max(span.x/Math.min(camera.aspect,1.7),span.z*0.8)+3.4)/0.72);
    const distance=THREE.MathUtils.lerp(overview,closeDistance,closeup);
    const target=new THREE.Vector3(center.x*closeup,0,THREE.MathUtils.lerp(-0.6,center.z,closeup));
    camera.position.set(target.x,distance*0.78,target.z+distance*0.65);camera.lookAt(target);
    const index=Math.min(Math.floor(elapsed/flight.frameStep),flight.frames.length-1);
    const a=flight.frames[index],b=flight.frames[Math.min(index+1,flight.frames.length-1)];
    const alpha=Math.min(elapsed/flight.frameStep-index,1);
    dice.forEach((die,i)=>{
      die.visible=time>=FLIGHT_START+flight.releases[i]; if(!die.visible)return;
      const j=i*7; die.position.set(THREE.MathUtils.lerp(a[j],b[j],alpha),THREE.MathUtils.lerp(a[j+1],b[j+1],alpha),THREE.MathUtils.lerp(a[j+2],b[j+2],alpha));
      q.set(a[j+3],a[j+4],a[j+5],a[j+6]); nextQ.set(b[j+3],b[j+4],b[j+5],b[j+6]);
      die.quaternion.copy(q.slerp(nextQ,alpha).multiply(offsets[i]));
    });
    renderer.render(scene,camera);
  }
  function dispose() {
    observer.disconnect();
    const geometries=new Set<THREE.BufferGeometry>(), materials=new Set<THREE.Material>(), textures=new Set<THREE.Texture>();
    scene.traverse(object=>{
      if(object instanceof THREE.Mesh) {geometries.add(object.geometry); (Array.isArray(object.material)?object.material:[object.material]).forEach(m=>materials.add(m));}
    });
    materials.forEach(material=>{ Object.values(material).forEach(value=>{if(value instanceof THREE.Texture)textures.add(value);}); material.dispose(); });
    textures.forEach(texture=>texture.dispose()); geometries.forEach(geometry=>geometry.dispose());
    key.shadow.dispose(); environment.dispose(); renderer.dispose(); renderer.domElement.remove();
  }
  return {render,dispose,canvas:renderer.domElement};
}
