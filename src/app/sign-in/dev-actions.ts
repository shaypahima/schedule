"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { pgQuery } from "@/lib/pg/client";
import { signDevToken } from "@/lib/pg/dev-auth";
import { DEV_SESSION_COOKIE, isDevAuthEnabled } from "@/lib/auth/dev-session";
import { getWebSession, resolveDestination } from "@/lib/auth/session";

export async function devSignIn(formData: FormData) {
  if (!isDevAuthEnabled()) redirect("/sign-in?error=oauth_failed");

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!process.env.DEV_PASSWORD || password !== process.env.DEV_PASSWORD) {
    redirect("/sign-in?error=dev_credentials");
  }

  const rows = await pgQuery<{ id: string; email: string }>(
    "select id, email from profiles where email = $1 limit 1",
    [email],
  );
  if (rows.length === 0) redirect("/sign-in?error=dev_no_user");

  const token = signDevToken({ sub: rows[0].id, email: rows[0].email });
  (await cookies()).set(DEV_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect(resolveDestination(await getWebSession()));
}
