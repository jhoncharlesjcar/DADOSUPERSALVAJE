import "server-only";

export interface RedisIndex { command<T = unknown>(...args: (string | number)[]): Promise<T>; }
let testIndex: RedisIndex | undefined;
export function setTestRedis(index: RedisIndex | undefined) {
  if (process.env.NODE_ENV !== "test") throw new Error("Solo para pruebas");
  testIndex = index;
}
export function getRedisIndex(): RedisIndex | null {
  if (testIndex) return testIndex;
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (new URL(url).protocol !== "https:") throw new Error("Redis REST requiere HTTPS");
  return { async command<T>(...args: (string | number)[]) {
    const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(args), cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Índice Redis no disponible");
    const body = await response.json() as { result: T; error?: string };
    if (body.error) throw new Error("Comando de índice Redis rechazado");
    return body.result;
  } };
}
export const queueKey = (mode: string, cents: string, demo: boolean) => `dado:queue:${demo ? "demo" : "real"}:${mode}:${cents}`;
