import { Pool } from "pg";

/**
 * Native-Postgres connection pool for local development (no Docker, no
 * Supabase services). Selected when `DB_DRIVER=pg`; the cloud Supabase path
 * stays the default so production is untouched.
 *
 * Connection comes from `DATABASE_URL`, e.g.
 *   postgres://postgres:postgres@localhost:5432/velofit_dev
 *
 * The pool connects as the DB owner, which bypasses RLS — so the dev schema
 * can keep the migration RLS policies without them blocking server queries
 * (same effect as Supabase's service-role key).
 */
let pool: Pool | null = null;

export function isPgDriver(): boolean {
  return process.env.DB_DRIVER === "pg";
}

export function getPgPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is required when DB_DRIVER=pg (e.g. postgres://postgres:postgres@localhost:5432/velofit_dev)",
      );
    }
    pool = new Pool({ connectionString, max: 10 });
  }
  return pool;
}

/** Convenience query helper returning rows typed as T. */
export async function pgQuery<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await getPgPool().query(text, params as never[]);
  return res.rows as T[];
}

/** Closes the pool (used by scripts so the process can exit). */
export async function closePgPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
