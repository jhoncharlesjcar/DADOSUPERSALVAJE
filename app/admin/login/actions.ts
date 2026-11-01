"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  adminSessionCookieOptions,
  createAdminSessionToken,
  verifyAdminPassword,
} from "@/lib/adminAuth";
import { DEVELOPER_COOKIE_NAME, loginDeveloper, logoutDeveloper, usesSupabaseAdminAuth } from "@/lib/supabaseAdminAuth";

export async function loginAdmin(formData: FormData) {
  const password = String(formData.get("password") || "");
  const requestedNext = String(formData.get("next") || "/admin");
  const nextPath = requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !/[\\\u0000-\u0020]/.test(requestedNext)
    ? requestedNext
    : "/admin";

  const cookieStore = await cookies();
  if (usesSupabaseAdminAuth()) {
    const result = await loginDeveloper(String(formData.get("email") || ""), password);
    if (!result.ok) redirect(`/admin/login?error=${result.error}&next=${encodeURIComponent(nextPath)}`);
    cookieStore.delete(ADMIN_COOKIE_NAME);
    cookieStore.set(DEVELOPER_COOKIE_NAME, result.accessToken, { ...adminSessionCookieOptions, maxAge: result.expiresIn });
    redirect(nextPath);
  }

  if (!verifyAdminPassword(password)) redirect(`/admin/login?error=credentials&next=${encodeURIComponent(nextPath)}`);
  cookieStore.delete(DEVELOPER_COOKIE_NAME);
  cookieStore.set(ADMIN_COOKIE_NAME, createAdminSessionToken(), adminSessionCookieOptions);
  redirect(nextPath);
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  await logoutDeveloper(cookieStore.get(DEVELOPER_COOKIE_NAME)?.value);
  cookieStore.delete(DEVELOPER_COOKIE_NAME);
  cookieStore.delete(ADMIN_COOKIE_NAME);
  redirect("/admin/login");
}
