import "server-only";

export const DEVELOPER_COOKIE_NAME = "dado_developer_access";
const MAX_SESSION_SECONDS = 3600;

export type DeveloperIdentity = { id: string; email: string; name: string; role: "developer" };
export type AdminLoginError = "credentials" | "forbidden" | "configuration" | "unavailable" | "rate_limit";
type LoginResult = { ok: true; accessToken: string; expiresIn: number; identity: DeveloperIdentity }
  | { ok: false; error: AdminLoginError };

// Legacy access must be explicitly selected. Old signed cookies cannot bypass a
// Supabase role check when this provider is active.
export function usesSupabaseAdminAuth(): boolean {
  return process.env.ADMIN_AUTH_PROVIDER !== "legacy";
}

function configuration() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") return null;
    return { url: parsed.origin, key };
  } catch { return null; }
}

function identityFromUser(value: unknown): DeveloperIdentity | null {
  if (!value || typeof value !== "object") return null;
  const user = value as Record<string, unknown>;
  const metadata = user.app_metadata as Record<string, unknown> | undefined;
  // user_metadata is editable by the user and must never grant permissions.
  if (metadata?.role !== "developer" || typeof user.id !== "string" || typeof user.email !== "string"
    || !user.email_confirmed_at || user.is_anonymous === true
    || (typeof user.banned_until === "string" && Date.parse(user.banned_until) > Date.now())) return null;
  const profile = user.user_metadata as Record<string, unknown> | undefined;
  return { id: user.id, email: user.email, name: typeof profile?.full_name === "string" ? profile.full_name : user.email, role: "developer" };
}

async function authRequest(path: string, init: RequestInit = {}) {
  const config = configuration();
  if (!config) throw new Error("Supabase Auth no configurado");
  return fetch(`${config.url}/auth/v1/${path}`, {
    ...init,
    headers: { apikey: config.key, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
}

export async function getDeveloperIdentity(accessToken?: string): Promise<DeveloperIdentity | null> {
  if (!accessToken || !configuration()) return null;
  try {
    // Read the current user from Auth, not a locally decoded JWT: role removal
    // takes effect on the next request, even for an already issued token.
    const response = await authRequest("user", { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) return null;
    return identityFromUser(await response.json());
  } catch { return null; }
}

export async function loginDeveloper(email: string, password: string): Promise<LoginResult> {
  if (!configuration()) return { ok: false, error: "configuration" };
  if (!email || email.length > 254 || !password || password.length > 4096) return { ok: false, error: "credentials" };
  try {
    const response = await authRequest("token?grant_type=password", {
      method: "POST", body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    if (response.status === 429) return { ok: false, error: "rate_limit" };
    if (response.status === 401 || response.status === 403) return { ok: false, error: "configuration" };
    if (!response.ok) return { ok: false, error: response.status === 400 || response.status === 422 ? "credentials" : "unavailable" };
    const session = await response.json() as { access_token?: unknown; expires_in?: unknown };
    if (typeof session.access_token !== "string" || typeof session.expires_in !== "number"
      || !Number.isFinite(session.expires_in) || session.expires_in < 1) return { ok: false, error: "unavailable" };
    const identity = await getDeveloperIdentity(session.access_token);
    if (!identity) return { ok: false, error: "forbidden" };
    return { ok: true, accessToken: session.access_token, expiresIn: Math.min(Math.floor(session.expires_in), MAX_SESSION_SECONDS), identity };
  } catch { return { ok: false, error: "unavailable" }; }
}

export async function logoutDeveloper(accessToken?: string): Promise<void> {
  if (!accessToken || !configuration()) return;
  try {
    await authRequest("logout?scope=local", { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
  } catch { /* Always remove the local cookie, even if Auth is unavailable. */ }
}
