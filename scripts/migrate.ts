/**
 * Applies SQL migrations to a hosted Supabase project.
 * Reads all .sql files from supabase/migrations/ and executes them in order.
 *
 * Usage: npx tsx scripts/migrate.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or key env vars");
  process.exit(1);
}

// Extract project ref from URL: https://xxx.supabase.co -> xxx
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];

async function migrate() {
  const migrationsDir = path.resolve(__dirname, "../supabase/migrations");
  const files = fs.readdirSync(migrationsDir).sort();

  console.log(`Supabase project: ${projectRef}`);
  console.log(`Migrations to apply: ${files.filter(f => f.endsWith(".sql")).length}\n`);

  console.log("NOTE: For hosted Supabase, paste migration SQL into the SQL Editor at:");
  console.log(`  ${SUPABASE_URL.replace(".supabase.co", ".supabase.co")}/project/${projectRef}/sql\n`);
  console.log("--- Migration SQL ---\n");

  for (const file of files) {
    if (!file.endsWith(".sql")) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    console.log(`-- ${file}`);
    console.log(sql);
    console.log("");
  }
}

migrate();
