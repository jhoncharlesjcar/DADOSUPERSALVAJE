import { Body, Box, ContactMaterial, Material, Plane, Vec3, World } from "cannon-es";
import { Quaternion, Vector3 } from "three";
import type { ArenaRound } from "./types";
import takes from "./takes.json";

export const DIE_SIZE = 0.86;
export const STEP = 1 / 60;
export const FLIGHT_START = 2.65;
export const FACE_VALUES = [1, 6, 2, 5, 3, 4]; // +X, -X, +Y, -Y, +Z, -Z. Opposite faces sum to seven.
export const FACE_NORMALS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
export interface Flight {
  frames: Float32Array[];
  offsets: Array<[number, number, number, number]>;
  impacts: Array<{ time: number; strength: number; x: number }>;
  duration: number;
  /** Presentation seconds per simulated frame; contacts and releases use this clock too. */
  frameStep: number;
  diceContacts: number;
  releases: number[];
}

export function seededRandom(seed: string) {
  let state = 2166136261;
  for (let i = 0; i < seed.length; i++) state = Math.imul(state ^ seed.charCodeAt(i), 16777619);
  return () => { state += 0x6d2b79f5; let t = Math.imul(state ^ state >>> 15, 1 | state); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/** Precompute real box contacts, then rotate only the face artwork by a cube symmetry.
 * The outcome is already authoritative. No settling correction or random local result.
 * Choreographed cup motion precedes this simulation; its interior is not simulated.
 */
export function simulateFlight(round: ArenaRound, seed: string): Flight {
  const choices = (takes as Record<string, string[]>)[round.rolls.length];
  if (!choices?.length) throw new Error("El lanzamiento requiere entre 2 y 10 dados");
  // Accepted physical takes are calibrated offline. Runtime does one simulation,
  // never a search; the seed selects presentation only, not the authoritative faces.
  return simulateTake(round, choices[Math.floor(seededRandom(seed)() * choices.length)]);
}

function simulateTake(round: ArenaRound, seed: string): Flight {
  const random = seededRandom(seed);
  const world = new World({ gravity: new Vec3(0, -18, 0), allowSleep: true });
  const material = new Material("dice-table");
  world.addContactMaterial(new ContactMaterial(material, material, { friction: 0.06, restitution: 0.78 }));
  const floor = new Body({ mass: 0, material, shape: new Plane() });
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);
  // Match the circular raised table rail. Shapes are outside the visible playing area.
  for (let i = 0; i < 24; i++) {
    const angle = i * Math.PI / 12;
    const wall = new Body({ mass: 0, material, shape: new Box(new Vec3(1.25, 1, 0.15)) });
    wall.position.set(Math.sin(angle) * 8.35, 0.5, Math.cos(angle) * 8.35);
    wall.quaternion.setFromEuler(0, angle, 0);
    world.addBody(wall);
  }
  const impacts: Flight["impacts"] = [];
  let diceContacts = 0;
  let time = 0;
  const bodies = round.rolls.map((_, i) => {
    const body = new Body({ mass: 1, material, shape: new Box(new Vec3(DIE_SIZE / 2, DIE_SIZE / 2, DIE_SIZE / 2)),
      linearDamping: 0.28, angularDamping: 0.10, allowSleep: true, sleepSpeedLimit: 0.22, sleepTimeLimit: 0.35 });
    // A short fan of throws leaves the tilted cup's opening without stacking bodies.
    const angle = (i - (round.rolls.length - 1) / 2) * 0.10;
    body.position.set(0, 3, -1.8);
    body.velocity.set(Math.sin(angle) * (4.4 + random()), 2.4 + random() * 1.4, 4 + random() * 1.5 + (i % 2) * 1.5);
    body.angularVelocity.set(60 + random() * 8, random() * 30 - 15, random() * 36 - 18);
    body.quaternion.setFromEuler(random() * 2, random() * 3, random() * 2);
    let lastImpact = -1;
    body.addEventListener("collide", (event: { body: Body; contact: { getImpactVelocityAlongNormal(): number } }) => {
      const strength = Math.abs(event.contact.getImpactVelocityAlongNormal());
      if (event.body.mass > 0 && body.id < event.body.id && strength > 0.5) diceContacts++;
      if (strength > 1.4 && time - lastImpact > 0.12 && impacts.length < 55) {
        impacts.push({ time, strength: Math.min(strength, 12), x: body.position.x });
        lastImpact = time;
      }
    });
    return body;
  });
  const releases = bodies.map((_, i) => i * 0.10);
  const frames: Float32Array[] = [];
  const rotations = bodies.map(() => 0);
  let stayedOnTable = true;
  let lastMovingTime = 0;
  const previousRotation = new Quaternion(), currentRotation = new Quaternion();
  for (let frame = 0; frame <= 1080; frame++) {
    time = frame * STEP;
    bodies.forEach((body, i) => { if (frame === i * 6) world.addBody(body); });
    const snapshot = new Float32Array(bodies.length * 7);
    bodies.forEach((body, i) => snapshot.set([body.position.x, body.position.y, body.position.z, body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w], i * 7));
    bodies.forEach((body, i) => {
      if (Math.hypot(body.position.x, body.position.z) > 7.9) stayedOnTable = false;
      if (frames.length) {
        previousRotation.fromArray(frames.at(-1)!, i * 7 + 3).normalize();
        currentRotation.fromArray(snapshot, i * 7 + 3).normalize();
        const angle = previousRotation.angleTo(currentRotation);
        rotations[i] += angle / (2 * Math.PI);
        const a = frames.at(-1)!, j = i * 7;
        if (angle > .006 || Math.hypot(a[j]-snapshot[j],a[j+1]-snapshot[j+1],a[j+2]-snapshot[j+2]) > .003) lastMovingTime = time;
      }
    });
    frames.push(snapshot);
    if (time > releases.at(-1)! + 3 && bodies.every(body => body.sleepState === Body.SLEEPING)) break;
    world.step(STEP);
  }
  // Reject an unsettled or stacked take before playback; never snap a visible die.
  const stable = stayedOnTable && diceContacts > 0 && rotations.every(turns => turns >= 2.5) && bodies.every(body => {
    const q = new Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
    return body.sleepState === Body.SLEEPING && body.position.y < 0.5 && Math.hypot(body.position.x, body.position.z) < 7.9 &&
      Math.max(...FACE_NORMALS.map(normal => new Vector3(...normal).applyQuaternion(q).y)) > 0.995;
  });
  if (!stable) throw new Error("No se pudo preparar un lanzamiento estable");
  const offsets = bodies.map((body, i) => {
    const q = new Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
    let face = 0, height = -Infinity;
    FACE_NORMALS.forEach((normal, index) => {
      const y = new Vector3(...normal).applyQuaternion(q).y;
      if (y > height) { height = y; face = index; }
    });
    const source = FACE_NORMALS[FACE_VALUES.indexOf(round.rolls[i].value)];
    return new Quaternion().setFromUnitVectors(new Vector3(...source), new Vector3(...FACE_NORMALS[face])).toArray() as [number, number, number, number];
  });
  // Cinematic playback stretches the moving trajectory, not a static result hold.
  // Keep the final quiet settling interval short instead of stretching it too.
  // Release, collision audio and camera all use the same presentation clock.
  const duration = 14.5;
  const physicalDuration = (frames.length - 1) * STEP;
  const tail = 0.6;
  const movingDuration = Math.min(lastMovingTime, physicalDuration - STEP);
  const scale = (duration - tail) / movingDuration;
  const tailScale = tail / (physicalDuration - movingDuration);
  const presentationTime = (time: number) => time <= movingDuration ? time * scale : duration - tail + (time - movingDuration) * tailScale;
  const sampled: Float32Array[] = [];
  const qa = new Quaternion(), qb = new Quaternion();
  for (let frame = 0; frame <= duration / STEP; frame++) {
    const shown = frame * STEP;
    const physical = shown <= duration - tail ? shown / scale : movingDuration + (shown - duration + tail) / tailScale;
    const index = Math.min(Math.floor(physical / STEP), frames.length - 1);
    const next = Math.min(index + 1, frames.length - 1), alpha = Math.min(physical / STEP - index, 1);
    const a = frames[index], b = frames[next], snapshot = new Float32Array(a.length);
    for (let i = 0; i < bodies.length; i++) {
      const j = i * 7;
      for (let axis = 0; axis < 3; axis++) snapshot[j + axis] = a[j + axis] + (b[j + axis] - a[j + axis]) * alpha;
      qa.fromArray(a, j + 3).normalize(); qb.fromArray(b, j + 3).normalize();
      qa.slerp(qb, alpha).toArray(snapshot, j + 3);
    }
    sampled.push(snapshot);
  }
  return { frames: sampled, offsets, duration, frameStep: STEP, diceContacts,
    releases: releases.map(presentationTime),
    impacts: impacts.map(impact => ({ ...impact, time: presentationTime(impact.time) })).sort((a, b) => a.time - b.time) };
}
