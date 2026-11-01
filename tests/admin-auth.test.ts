// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { cookieValues, setCookie, deleteCookie } = vi.hoisted(() => ({
  cookieValues: new Map<string, string>(), setCookie: vi.fn(), deleteCookie: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined,
  set: setCookie, delete: deleteCookie,
}) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
import { getDeveloperIdentity, loginDeveloper, DEVELOPER_COOKIE_NAME } from "../lib/supabaseAdminAuth";
import { ADMIN_COOKIE_NAME, createAdminSessionToken, isAdminAuthenticated, requireAdmin } from "../lib/adminAuth";
import { loginAdmin, logoutAdmin } from "../app/admin/login/actions";

const user = { id: "test-uuid", email: "developer@example.com", email_confirmed_at: "2026-10-31T12:00:00Z",
  app_metadata: { role: "developer" }, user_metadata: { full_name: "Developer Test" } };
const fetchMock = vi.fn();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function successfulLogin() {
  fetchMock.mockResolvedValueOnce(json({ access_token: "verified-token", expires_in: 7200, refresh_token: "never-stored" }))
    .mockResolvedValueOnce(json(user));
}
beforeEach(() => {
  vi.stubEnv("ADMIN_AUTH_PROVIDER", "supabase");
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  vi.stubEnv("ADMIN_SESSION_SECRET", "test-secret-with-at-least-thirty-two-characters");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset(); cookieValues.clear(); setCookie.mockClear(); deleteCookie.mockClear();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Developer authorization", () => {
  it("accepts only the current server-controlled role and verified identity", async () => {
    fetchMock.mockResolvedValueOnce(json(user));
    expect(await getDeveloperIdentity("token")).toEqual({ id: user.id, email: user.email, name: "Developer Test", role: "developer" });
    expect(fetchMock).toHaveBeenCalledWith("https://test.supabase.co/auth/v1/user", expect.objectContaining({
      cache: "no-store", redirect: "error", headers: expect.objectContaining({ Authorization: "Bearer token" }),
    }));
  });
  it.each([
    { ...user, app_metadata: {}, user_metadata: { role: "developer" } },
    { ...user, app_metadata: { role: "player" } },
    { ...user, email_confirmed_at: null },
    { ...user, is_anonymous: true },
    { ...user, banned_until: "2999-01-01T00:00:00Z" },
    { ...user, id: undefined },
  ])("rejects untrusted roles or invalid accounts", async (value) => {
    fetchMock.mockResolvedValueOnce(json(value));
    expect(await getDeveloperIdentity("token")).toBeNull();
  });
  it("revokes access on the next request after the role is removed", async () => {
    cookieValues.set(DEVELOPER_COOKIE_NAME, "token");
    fetchMock.mockResolvedValueOnce(json(user)).mockResolvedValueOnce(json({ ...user, app_metadata: {} }));
    expect(await isAdminAuthenticated()).toBe(true);
    await expect(requireAdmin()).rejects.toThrow("No autorizado");
  });
  it("denies expired tokens and outages instead of falling back to a legacy cookie", async () => {
    cookieValues.set(ADMIN_COOKIE_NAME, createAdminSessionToken());
    expect(await isAdminAuthenticated()).toBe(false);
    cookieValues.set(DEVELOPER_COOKIE_NAME, "expired");
    fetchMock.mockResolvedValueOnce(json({}, 401)).mockRejectedValueOnce(new Error("offline"));
    expect(await isAdminAuthenticated()).toBe(false);
    expect(await isAdminAuthenticated()).toBe(false);
  });
  it("permits old signed sessions only when legacy mode is explicit", async () => {
    vi.stubEnv("ADMIN_AUTH_PROVIDER", "legacy");
    cookieValues.set(ADMIN_COOKIE_NAME, createAdminSessionToken());
    expect(await isAdminAuthenticated()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Developer login", () => {
  it("uses Supabase credentials and limits the session to one hour", async () => {
    successfulLogin();
    const result = await loginDeveloper(" Developer@example.com ", "existing-password");
    expect(result).toMatchObject({ ok: true, expiresIn: 3600, identity: { role: "developer" } });
    expect(result).not.toHaveProperty("refresh_token");
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ email: "developer@example.com", password: "existing-password" }));
  });
  it.each([[400, "credentials"], [429, "rate_limit"], [500, "unavailable"], [401, "configuration"]])("handles HTTP %s distinctly", async (status, error) => {
    fetchMock.mockResolvedValueOnce(json({}, status as number));
    expect(await loginDeveloper(user.email, "password")).toEqual({ ok: false, error });
  });
  it("does not send credentials with missing or insecure configuration", async () => {
    vi.stubEnv("SUPABASE_URL", "http://test.supabase.co");
    expect(await loginDeveloper(user.email, "password")).toEqual({ ok: false, error: "configuration" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not create a session for an ordinary authenticated user", async () => {
    fetchMock.mockResolvedValueOnce(json({ access_token: "player-token", expires_in: 3600 }))
      .mockResolvedValueOnce(json({ ...user, app_metadata: {} }));
    const form = new FormData(); form.set("email", user.email); form.set("password", "password");
    await expect(loginAdmin(form)).rejects.toThrow("error=forbidden");
    expect(setCookie).not.toHaveBeenCalled();
  });
  it("creates an HttpOnly cookie, removes the legacy cookie and blocks external redirects", async () => {
    successfulLogin();
    const form = new FormData(); form.set("email", user.email); form.set("password", "password"); form.set("next", "/\\evil.example");
    await expect(loginAdmin(form)).rejects.toThrow("redirect:/admin");
    expect(setCookie).toHaveBeenCalledWith(DEVELOPER_COOKIE_NAME, "verified-token", expect.objectContaining({ httpOnly: true, sameSite: "strict", maxAge: 3600 }));
    expect(deleteCookie).toHaveBeenCalledWith(ADMIN_COOKIE_NAME);
  });
  it("clears both cookies on logout even when Supabase is unavailable", async () => {
    cookieValues.set(DEVELOPER_COOKIE_NAME, "token"); fetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(logoutAdmin()).rejects.toThrow("redirect:/admin/login");
    expect(deleteCookie).toHaveBeenCalledWith(DEVELOPER_COOKIE_NAME);
    expect(deleteCookie).toHaveBeenCalledWith(ADMIN_COOKIE_NAME);
  });
});
