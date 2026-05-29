/**
 * Seed the local dev Postgres with a coach, trainees, and slots for the
 * current + next week. Mirrors scripts/seed.ts but writes directly to pg
 * (no Supabase Admin API). Idempotent via ON CONFLICT.
 *
 * Reads DEV_* from .env.local (+ DATABASE_URL from .env.development.local).
 * Usage: npm run db:pg:seed
 */
import * as dotenv from "dotenv";
import path from "path";
import { randomUUID } from "crypto";
import { getPgPool, closePgPool } from "../../src/lib/pg/client";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
dotenv.config({
  path: path.resolve(__dirname, "../../.env.development.local"),
  override: true,
});

const COACH_EMAIL = process.env.DEV_COACH_EMAIL!;
const COACH_NAME = process.env.DEV_COACH_NAME!;
const TRAINEE_EMAILS = (process.env.DEV_TRAINEE_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const TRAINEE_NAMES = (process.env.DEV_TRAINEE_NAMES ?? "").split(",").map((s) => s.trim()).filter(Boolean);

if (!COACH_EMAIL || !COACH_NAME) {
  console.error("Missing DEV_COACH_EMAIL / DEV_COACH_NAME");
  process.exit(1);
}
if (TRAINEE_EMAILS.length !== TRAINEE_NAMES.length) {
  console.error(`DEV_TRAINEE_EMAILS (${TRAINEE_EMAILS.length}) and DEV_TRAINEE_NAMES (${TRAINEE_NAMES.length}) must match`);
  process.exit(1);
}

const pool = getPgPool();

/** Insert (or find) an auth.users row by email; returns its id. */
async function ensureUser(email: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `insert into auth.users (id, email) values ($1, $2)
       on conflict (email) do update set email = excluded.email
       returning id`,
    [randomUUID(), email],
  );
  return rows[0].id;
}

async function upsertProfile(id: string, email: string, name: string, role: "coach" | "trainee") {
  await pool.query(
    `insert into profiles (id, email, name, role, is_active, status)
       values ($1, $2, $3, $4, true, 'active')
       on conflict (id) do update
         set email = excluded.email, name = excluded.name, role = excluded.role`,
    [id, email, name, role],
  );
}

function getWeekStart(): string {
  const todayIL = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  const [y, m, d] = todayIL.split("-").map(Number);
  const local = new Date(y, m - 1, d, 12);
  local.setDate(local.getDate() - local.getDay());
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}

function dateForDay(weekStart: string, dayOffset: number): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const dt = new Date(y, m - 1, d + dayOffset, 12);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

async function seedSlots(): Promise<number> {
  const weekStart = getWeekStart();
  const hours = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];
  const values: string[] = [];
  const params: unknown[] = [];
  let n = 0;
  for (const ws of [weekStart, dateForDay(weekStart, 7)]) {
    for (let day = 0; day <= 5; day++) {
      const date = dateForDay(ws, day);
      for (const time of hours) {
        values.push(`($${++n}, $${++n}, 2, false)`);
        params.push(date, time);
      }
    }
  }
  await pool.query(
    `insert into slots (date, start_time, capacity, lockout_override)
       values ${values.join(", ")}
       on conflict (date, start_time) do nothing`,
    params,
  );
  return params.length / 2;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required (set it in .env.development.local).");
    process.exit(1);
  }
  console.log(`Seeding ${process.env.DATABASE_URL}\n`);

  const coachId = await ensureUser(COACH_EMAIL);
  await upsertProfile(coachId, COACH_EMAIL, COACH_NAME, "coach");
  console.log(`Coach: ${COACH_NAME} <${COACH_EMAIL}>`);

  for (let i = 0; i < TRAINEE_EMAILS.length; i++) {
    const id = await ensureUser(TRAINEE_EMAILS[i]);
    await upsertProfile(id, TRAINEE_EMAILS[i], TRAINEE_NAMES[i], "trainee");
    console.log(`  Trainee: ${TRAINEE_NAMES[i]} <${TRAINEE_EMAILS[i]}>`);
  }

  const slotCount = await seedSlots();
  console.log(`\nSlots: ${slotCount} for current + next week`);
  console.log("Done.");
  await closePgPool();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await closePgPool();
  process.exit(1);
});
