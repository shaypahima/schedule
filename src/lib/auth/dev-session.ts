import { isPgDriver } from "@/lib/pg/client";
import { verifyDevToken } from "@/lib/pg/dev-auth";

export const DEV_SESSION_COOKIE = "velofit-dev-session";

/**
 * Dev sign-in exists only on the native-Postgres path, where there is no
 * GoTrue to talk to. Gated on the driver rather than NODE_ENV so a stray
 * token can never authenticate anyone against the cloud database.
 */
export function isDevAuthEnabled(): boolean {
  return isPgDriver();
}

export function readDevIdentity(
  token: string | undefined,
): { userId: string; email: string } | null {
  if (!isDevAuthEnabled() || !token) return null;
  return verifyDevToken(token);
}
