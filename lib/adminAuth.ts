import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { DEVELOPER_COOKIE_NAME, getDeveloperIdentity, usesSupabaseAdminAuth } from "./supabaseAdminAuth";

export const ADMIN_COOKIE_NAME = "dado_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV !== "production") return "development-only-secret-change-before-production";
  throw new Error("ADMIN_SESSION_SECRET debe tener al menos 32 caracteres");
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function createAdminSessionToken(now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ exp: now + SESSION_TTL_SECONDS * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSessionToken(token?: string): boolean {
  if (!token) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;

  try {
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return Number.isFinite(parsed.exp) && Number(parsed.exp) > Date.now();
  } catch {
    return false;
  }
}

export function verifyAdminPassword(password: string): boolean {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) return process.env.NODE_ENV !== "production" && password === "admin-local";
  const expected = Buffer.from(configured);
  const received = Buffer.from(password);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function getAdminIdentity() {
  const cookieStore = await cookies();
  if (usesSupabaseAdminAuth()) {
    return getDeveloperIdentity(cookieStore.get(DEVELOPER_COOKIE_NAME)?.value);
  }
  return verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value)
    ? { id: "legacy", name: "Operador", email: "", role: "operator" as const } : null;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  return (await getAdminIdentity()) !== null;
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdminAuthenticated())) throw new Error("No autorizado");
}

export const adminSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
