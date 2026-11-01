import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../public/models/mascots/', import.meta.url);
function inspect(url) {
  const bytes = readFileSync(url);
  const asset = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  const primitives = asset.meshes.flatMap(mesh => mesh.primitives);
  return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    triangles: primitives.reduce((sum, p) => sum + asset.accessors[p.indices].count / 3, 0),
    vertices: primitives.reduce((sum, p) => sum + asset.accessors[p.attributes.POSITION].count, 0),
    primitives: primitives.length, materials: asset.materials.length,
    clips: Object.fromEntries(asset.animations.map(clip => [clip.name, Math.max(...clip.samplers.map(s => asset.accessors[s.input].max[0]))])) };
}
const report = readdirSync(root).filter(name => name.endsWith('.glb')).sort().map(name => {
  const full = inspect(new URL(name, root)), lite = inspect(new URL(`lite/${name}`, root));
  return { name, full, lite, downloadReductionPercent: +(100 * (1 - lite.bytes / full.bytes)).toFixed(1),
    triangleReductionPercent: +(100 * (1 - lite.triangles / full.triangles)).toFixed(1) };
});
if (report.length !== 10) throw new Error(`Expected 10 models, received ${report.length}`);
console.log(JSON.stringify(report, null, 2));
