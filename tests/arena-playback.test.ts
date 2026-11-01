// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Quaternion, Vector3 } from "three";
import { ReplayClock } from "../lib/arena/clock";
import { flightCameraBounds, flightCameraPose } from "../lib/arena/camera";
import { DIE_SIZE, simulateFlight } from "../lib/arena/physics";

describe("reloj independiente de FPS", () => {
  for (const fps of [10, 20, 30, 60]) it(`conserva 14 segundos a ${fps} FPS`, () => {
    const clock = new ReplayClock();
    clock.read(0);
    for (let i = 1; i <= 14 * fps; i++) clock.read(i * 1000 / fps);
    expect(clock.read(14000)).toBeCloseTo(14, 8);
  });
  it("descuenta la pausa y una pestaña oculta aunque no haya frames intermedios", () => {
    const clock = new ReplayClock();
    clock.read(1000); clock.read(4000);
    clock.setRunning(false, 4500);
    expect(clock.read(15000)).toBe(3.5);
    clock.setRunning(true, 20000);
    expect(clock.read(21500)).toBe(5);
    clock.seek(14, 22000);
    expect(clock.read(22000)).toBe(14);
  });
});

describe("encuadre de trayectorias y reposo", () => {
  for (const count of [2, 10]) it(`contiene los ${count} dados durante el vuelo y el acercamiento`, () => {
    for (const seed of [0, 1, 2]) {
      const flight = simulateFlight({rolls: Array.from({length:count}, (_, i) => ({playerId:`p${i}`, value:i%6+1})), leaders:["p0"]}, `physics-${count}-${seed}`);
      const bounds = flightCameraBounds(flight);
      const rotation = new Quaternion();
      for (const aspect of [0.5, 0.8, 1.8, 2.5]) {
        const camera = new PerspectiveCamera(40, aspect, 0.1, 150);
        let max = 0;
        for (let k = 0; k < flight.frames.length + 30; k += 3) {
          const elapsed = k * flight.frameStep;
          const pose = flightCameraPose(bounds, aspect, elapsed, flight.duration);
          camera.position.copy(pose.position); camera.lookAt(pose.target); camera.updateMatrixWorld();
          const frame = flight.frames[Math.min(k, flight.frames.length - 1)];
          for (let i = 0; i < count; i++) {
            if (elapsed < flight.releases[i]) continue;
            const j = i * 7;
            rotation.fromArray(frame, j + 3).normalize();
            for (const x of [-1,1]) for (const y of [-1,1]) for (const z of [-1,1]) {
              const p = new Vector3(x,y,z).multiplyScalar(DIE_SIZE / 2).applyQuaternion(rotation).add(new Vector3().fromArray(frame,j)).project(camera);
              max = Math.max(max, Math.abs(p.x), Math.abs(p.y));
              expect(p.z).toBeGreaterThan(-1); expect(p.z).toBeLessThan(1);
            }
          }
        }
        expect(max, `seed ${seed}, aspect ${aspect}`).toBeLessThan(0.9);
      }
    }
  }, 30000);
});
