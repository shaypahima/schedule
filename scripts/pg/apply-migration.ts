/**
 * Apply a single migration file to the local dev Postgres without a full
 * reset (reset.ts wipes seed data). Usage:
 *   npx tsx scripts/pg/apply-migration.ts supabase/migrations/00020_xxx.sql
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

async function main() {
  const file = process.argv[2];
  if (!file || !process.env.DATABASE_URL) {
    console.error("usage: tsx scripts/pg/apply-migration.ts <file.sql> (needs DATABASE_URL)");
    process.exit(1);
  }
  const pool = getPgPool();
  await pool.query(fs.readFileSync(path.resolve(file), "utf8"));
  console.log(`✓ applied ${file}`);
  await closePgPool();
}

main().catch(async (e) => {
  console.error(e);
  await closePgPool();
  process.exit(1);
});
