// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DADOS_DISPONIBLES } from "../lib/dados";
import { mascotModel } from "../lib/mascots";

function readAsset(url: string) {
  const bytes = readFileSync(new URL(`../public${url}`, import.meta.url));
  const asset = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
  return { bytes, asset };
}

function triangles(asset: ReturnType<typeof readAsset>["asset"]) {
  return asset.meshes.reduce((sum: number, mesh: { primitives: { indices: number }[] }) =>
    sum + mesh.primitives.reduce((count, primitive) => count + asset.accessors[primitive.indices].count / 3, 0), 0);
}

describe("mascotas del resultado", () => {
  it("cada dado tiene un modelo propio con esqueleto y los cinco movimientos", () => {
    const urls = new Set<string>();
    for (const dado of DADOS_DISPONIBLES) {
      const model = mascotModel(dado.id)!;
      expect(model, dado.id).not.toBeNull(); urls.add(model.url);
      const bytes = readFileSync(new URL(`../public${model.url}`, import.meta.url));
      expect(bytes.toString("utf8", 0, 4)).toBe("glTF");
      const asset = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
      expect(asset.skins[0].joints).toHaveLength(18);
      expect(asset.animations.map((clip: { name: string }) => clip.name).sort()).toEqual(["Celebrate", "Hit", "Idle", "Knockout", "Throw"]);
      expect(readFileSync(new URL(`../public${model.image}`, import.meta.url)).length).toBeGreaterThan(100);
    }
    expect(urls.size).toBe(DADOS_DISPONIBLES.length);
  });
  it("un identificador desconocido no muestra el personaje de otro jugador", () => {
    expect(mascotModel("desconocido")).toBeNull();
    expect(mascotModel("__proto__")).toBeNull();
  });
  it("las variantes ligeras reducen geometría y descarga sin perder esqueleto ni duración de clips", () => {
    for (const dado of DADOS_DISPONIBLES) {
      const model = mascotModel(dado.id)!;
      const full = readAsset(model.url), lite = readAsset(model.liteUrl);
      expect(lite.asset.skins[0].joints, dado.id).toHaveLength(18);
      expect(lite.bytes.length, dado.id).toBeLessThan(full.bytes.length * .7);
      expect(triangles(lite.asset), dado.id).toBeLessThan(triangles(full.asset) * .5);
      const durations = (asset: typeof full.asset) => Object.fromEntries(asset.animations.map((clip: { name: string; samplers: { input: number }[] }) =>
        [clip.name, Math.max(...clip.samplers.map(s => asset.accessors[s.input].max[0]))]));
      const original = durations(full.asset), reduced = durations(lite.asset);
      expect(Object.keys(reduced).sort(), dado.id).toEqual(Object.keys(original).sort());
      for (const name of Object.keys(original)) expect(Math.abs(original[name] - reduced[name]), `${dado.id}: ${name}`).toBeLessThan(1 / 30 + .001);
    }
  });
});
