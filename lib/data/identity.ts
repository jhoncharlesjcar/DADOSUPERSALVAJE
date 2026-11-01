import "server-only";

export interface VerificadorIdentidad {
  verificar(input: { usuarioId: string; dni: string; evidenciaReferencia: string }): Promise<{
    estado: "verificado" | "rechazado" | "pendiente"; fechaNacimiento?: string; referencia: string;
  }>;
  verificarTitularCuenta(input: { usuarioId: string; dni: string; cuenta: string; banco: string }): Promise<{
    coincideTitular: boolean; referencia: string;
  }>;
}
let testVerifier: VerificadorIdentidad | undefined;
export function setIdentityVerifierForTests(verifier: VerificadorIdentidad | undefined) {
  if (process.env.NODE_ENV !== "test") throw new Error("Solo para pruebas");
  testVerifier = verifier;
}
export function getIdentityVerifier(): VerificadorIdentidad {
  if (testVerifier) return testVerifier;
  // TODO(DECISIÓN): select an authorized provider and implement its server-side evidence contract.
  throw new Error("TODO(DECISIÓN): proveedor de identidad no configurado");
}
