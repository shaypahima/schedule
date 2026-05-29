/**
 * Reset the local dev Postgres to a clean schema: drop public/auth/storage,
 * recreate, install dev stubs, then replay the Supabase migrations in order.
 *
 * Skips 00019 (Storage bucket) — there is no Storage service locally and
 * progress photos (#61) aren't built yet.
 *
 * Requires DATABASE_URL (from .env.development.local). Usage:
 *   npx tsx scripts/pg/reset.ts
 */
import * as dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { getPgPool, closePgPool } from "../../src/lib/pg/client";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
dotenv.config({
  path: path.resolve(__dirname, "../../.env.development.local"),
  override: true,
});

const MIGRATIONS_DIR = path.resolve(__dirname, "../../supabase/migrations");
const BOOTSTRAP = path.resolve(__dirname, "./bootstrap.sql");
// Storage-only migration — no Storage service locally.
const SKIP = new Set(["00019_phase19_progress_photos_bucket.sql"]);

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required (set it in .env.development.local).");
    process.exit(1);
  }
  const pool = getPgPool();

  console.log("Dropping & recreating schemas…");
  await pool.query(`
    drop schema if exists storage cascade;
    drop schema if exists auth cascade;
    drop schema if exists public cascade;
    create schema public;
  `);

  console.log("Installing dev stubs (auth schema)…");
  await pool.query(fs.readFileSync(BOOTSTRAP, "utf8"));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (SKIP.has(file)) {
      console.log(`  skip ${file} (storage)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    try {
      await pool.query(sql);
      console.log(`  ✓ ${file}`);
    } catch (err) {
      console.error(`  ✗ ${file}\n`, err);
      throw err;
    }
  }

  console.log("Local Postgres schema ready.");
  await closePgPool();
}

main().catch(async (e) => {
  console.error(e);
  await closePgPool();
  process.exit(1);
});
