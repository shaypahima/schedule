"use server";

import { redirect } from "next/navigation";
import { getWebSession } from "@/lib/auth/session";
import { validateIntro, saveIntro } from "@/lib/auth/intro";

export async function submitIntro(formData: FormData) {
  const session = await getWebSession();
  if (!session || session.role !== "trainee" || session.status !== "pending") {
    redirect("/sign-in");
  }
  if (session.hasIntro) redirect("/pending");

  const parsed = validateIntro({
    phone: String(formData.get("phone") ?? ""),
    introText: String(formData.get("introText") ?? ""),
  });
  if (!parsed.ok) redirect(`/intro?error=${parsed.error}`);

  await saveIntro(session.userId, parsed.value);
  redirect("/pending");
}
