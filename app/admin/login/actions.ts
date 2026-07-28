"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminCookieOptions, createAdminSessionValue, verifyAdminPassword } from "@/lib/auth";

export async function loginAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!verifyAdminPassword(password)) {
    redirect("/admin/login?error=1");
  }

  const token = await createAdminSessionValue();
  const cookie = adminCookieOptions(token);
  const jar = await cookies();
  jar.set(cookie.name, cookie.value, cookie.options);
  redirect("/admin");
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
