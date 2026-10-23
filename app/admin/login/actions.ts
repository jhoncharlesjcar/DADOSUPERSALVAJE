"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  ADMIN_COOKIE_NAME,
  adminSessionCookieOptions,
  createAdminSessionToken,
  verifyAdminPassword,
} from "@/lib/adminAuth";

export async function loginAdmin(formData: FormData) {
  const password = String(formData.get("password") || "");
  const requestedNext = String(formData.get("next") || "/admin");
  const nextPath = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/admin";

  if (!verifyAdminPassword(password)) redirect(`/admin/login?error=1&next=${encodeURIComponent(nextPath)}`);

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, createAdminSessionToken(), adminSessionCookieOptions);
  redirect(nextPath);
}

export async function logoutAdmin() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  redirect("/admin/login");
}
