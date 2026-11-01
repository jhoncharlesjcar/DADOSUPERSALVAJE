import { Box3, MathUtils, Vector3 } from "three";
import { DIE_SIZE, type Flight } from "./physics";

const direction = new Vector3(0, 0.78, 0.65).normalize();
const right = new Vector3(1, 0, 0);
const up = new Vector3().crossVectors(direction, right).normalize();
const radius = DIE_SIZE * Math.sqrt(3) / 2;

/** Fit the complete flight, not just its result. Sphere bounds include every die orientation. */
export function flightCameraBounds(flight: Flight) {
  const overview = new Box3(new Vector3(-2.5, 0, -5.2), new Vector3(2.5, 6, -1));
  const settled = new Box3();
  const point = new Vector3(), extent = new Vector3(radius, radius, radius);
  flight.frames.forEach((frame, k) => {
    for (let i = 0; i < flight.releases.length; i++) {
      if (k * flight.frameStep < flight.releases[i]) continue;
      point.fromArray(frame, i * 7);
      overview.expandByPoint(point.clone().sub(extent));
      overview.expandByPoint(point.clone().add(extent));
      if (k === flight.frames.length - 1) {
        settled.expandByPoint(point.clone().sub(extent));
        settled.expandByPoint(point.clone().add(extent));
      }
    }
  });
  return { overview, settled };
}

function fit(box: Box3, aspect: number) {
  const target = box.getCenter(new Vector3());
  const tanY = Math.tan(MathUtils.degToRad(20)) * 0.88;
  const tanX = tanY * Math.max(aspect, 0.1);
  let distance = 6;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const offset = new Vector3(x, y, z).sub(target);
    const depth = offset.dot(direction);
    distance = Math.max(distance, depth + Math.abs(offset.dot(right)) / tanX, depth + Math.abs(offset.dot(up)) / tanY);
  }
  return { target, distance };
}

export function flightCameraPose(bounds: ReturnType<typeof flightCameraBounds>, aspect: number, elapsed: number, duration: number) {
  const wide = fit(bounds.overview, aspect), close = fit(bounds.settled, aspect);
  // Close only after all bodies have settled; interpolation cannot crop an active throw.
  const t = MathUtils.smoothstep(elapsed, duration, duration + 0.5);
  const target = wide.target.lerp(close.target, t);
  const distance = MathUtils.lerp(wide.distance, close.distance, t);
  return { target, position: target.clone().addScaledVector(direction, distance) };
}
