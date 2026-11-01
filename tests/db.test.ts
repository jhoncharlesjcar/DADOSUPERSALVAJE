import { describe, it, expect, vi } from "vitest";
import { validarDNI } from "../lib/db";

vi.mock("server-only", () => ({}));

describe("Logic: Base de Datos y Validaciones", () => {

  describe("validarDNI", () => {
    it("debe aceptar DNIs de 8 dígitos exactos", () => {
      expect(validarDNI("12345678")).toBe(true);
      expect(validarDNI(" 87654321 ")).toBe(true); // check trim
    });

    it("debe rechazar DNIs con letras o símbolos", () => {
      expect(validarDNI("1234567a")).toBe(false);
      expect(validarDNI("123-4567")).toBe(false);
    });

    it("debe rechazar DNIs con longitud incorrecta", () => {
      expect(validarDNI("1234567")).toBe(false);
      expect(validarDNI("123456789")).toBe(false);
    });

    it("debe rechazar valores nulos o vacíos", () => {
      expect(validarDNI("")).toBe(false);
      expect(validarDNI(null as any)).toBe(false);
    });
  });
});
