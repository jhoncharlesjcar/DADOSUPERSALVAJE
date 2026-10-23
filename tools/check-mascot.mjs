import { readFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { AnimationMixer, Box3, LoopOnce, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Node has no image decoder, so textures are stripped from the GLB's JSON chunk before parsing geometry.
function withoutTextures(bytes) {
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8"));
  const textures = json.textures?.length ?? 0;
  delete json.textures; delete json.images; delete json.samplers;
  json.extensionsUsed = json.extensionsUsed?.filter(name => name !== "EXT_texture_webp");
  json.extensionsRequired = json.extensionsRequired?.filter(name => name !== "EXT_texture_webp");
  for (const material of json.materials ?? []) {
    delete material.normalTexture; delete material.emissiveTexture; delete material.occlusionTexture;
    if (material.pbrMetallicRoughness) { delete material.pbrMetallicRoughness.baseColorTexture; delete material.pbrMetallicRoughness.metallicRoughnessTexture; }
  }
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 0x20)]);
  const rest = bytes.subarray(20 + jsonLength);
  const header = Buffer.alloc(20);
  header.write("glTF", 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + text.length + rest.length, 8);
  header.writeUInt32LE(text.length, 12); header.write("JSON", 16);
  const glb = Buffer.concat([header, text, rest]);
  return { buffer: glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), textures };
}

const directory = new URL("../public/models/mascots/", import.meta.url);
const fileIndex = process.argv.indexOf("--file");
if (fileIndex >= 0 && !process.argv[fileIndex + 1]) throw new Error("--file requires a GLB path");
const candidate = fileIndex >= 0 ? pathToFileURL(resolve(process.argv[fileIndex + 1])) : null;
const names = process.argv.includes("--all") ? readdirSync(directory).filter(name => name.endsWith(".glb")) : ["demonio.glb"];
if (process.argv.includes("--all") && names.length !== 10) throw new Error(`Expected 10 mascots, found ${names.length}`);
for (const file of candidate ? [candidate] : names.map(name => new URL(name, directory))) {
const name = basename(file.pathname);
const bytes = readFileSync(file);
const { buffer, textures } = withoutTextures(bytes);
const gltf = await new GLTFLoader().parseAsync(buffer, "");
const props = name === "demonio.glb" ? ["Maza", "Llamas_Maza", "Dado", "Llamas_Dado"] : [];
for (const name of props) if (!gltf.scene.getObjectByName(name)) throw new Error(`Missing prop: ${name}`);
console.log(JSON.stringify({ name, megabytes: +(bytes.length / 2 ** 20).toFixed(2), textures, props }));
for (const clip of ["Idle", "Celebrate", "Throw", "Hit", "Knockout"]) if (!gltf.animations.some(action => action.name === clip)) throw new Error(`Missing ${clip}: ${name}`);
const mixer = new AnimationMixer(gltf.scene);
for (const clip of gltf.animations) {
  mixer.stopAllAction();
  const action = mixer.clipAction(clip); action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.reset().play();
  const samples = [];
  for (const fraction of [0, .25, .5, .75, 1]) {
    mixer.setTime(clip.duration * fraction); gltf.scene.updateMatrixWorld(true);
    const box = new Box3().setFromObject(gltf.scene, true);
    if (![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)) throw new Error(`Nonfinite pose: ${clip.name}`);
    if (Math.abs(box.min.y) > .015) throw new Error(`Floor contact drift: ${clip.name} at ${fraction}`);
    samples.push({ fraction, minY: +box.min.y.toFixed(3), size: box.getSize(new Vector3()).toArray().map(v => +v.toFixed(2)) });
  }
  console.log(JSON.stringify({ name: clip.name, seconds: clip.duration, samples }));
}
}
