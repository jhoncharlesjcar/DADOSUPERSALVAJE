// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DADOS_DISPONIBLES } from "../lib/dados";
import { mascotModel } from "../lib/mascots";

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
});
