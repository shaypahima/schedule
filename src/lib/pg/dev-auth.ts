import jwt from "jsonwebtoken";

/**
 * Local dev-auth: mint & verify our own HS256 JWTs so the app needs no GoTrue
 * when running on native Postgres (`DB_DRIVER=pg`). NOT for production — the
 * cloud path still uses Supabase Auth.
 *
 * The token mirrors the two fields the app reads from a Supabase session:
 * `sub` (user id) and `email`.
 */
function secret(): string {
  return (
    process.env.DEV_JWT_SECRET ||
    "velofit-local-dev-secret-change-me-min-32-chars"
  );
}

export interface DevTokenInput {
  sub: string;
  email: string;
  role?: string;
}

export function signDevToken(input: DevTokenInput): string {
  return jwt.sign(
    { email: input.email, role: input.role ?? "authenticated" },
    secret(),
    { subject: input.sub, expiresIn: "30d" },
  );
}

export function verifyDevToken(
  token: string,
): { userId: string; email: string } | null {
  try {
    const decoded = jwt.verify(token, secret()) as jwt.JwtPayload;
    if (!decoded.sub || !decoded.email) return null;
    return { userId: String(decoded.sub), email: String(decoded.email) };
  } catch {
    return null;
  }
}
