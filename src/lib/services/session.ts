import { cookies } from "next/headers";
import { Profile } from "@/lib/types";

const SESSION_COOKIE = "session_user";

export async function setSession(profile: Profile): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, JSON.stringify({
    id: profile.id,
    name: profile.name,
    role: profile.role,
    phone: profile.phone,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: "/",
  });
}

export async function getSession(): Promise<{ id: string; name: string; role: string; phone: string } | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
