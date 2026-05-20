/**
 * Seed dev users (Supabase Auth + profiles row) and slots for the current week.
 *
 * Reads from .env.local:
 *   DEV_PASSWORD               shared password for all dev users
 *   DEV_TRAINEE_EMAILS         comma-separated list
 *   DEV_TRAINEE_NAMES          comma-separated list (positional with EMAILS)
 *   DEV_COACH_EMAIL            single dev coach login
 *   DEV_COACH_NAME             coach display name
 *
 * Idempotent: re-running upserts profiles and skips already-created auth users.
 *
 * Usage: npx tsx scripts/seed.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DEV_PASSWORD = process.env.DEV_PASSWORD!;
const TRAINEE_EMAILS = (process.env.DEV_TRAINEE_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const TRAINEE_NAMES = (process.env.DEV_TRAINEE_NAMES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const COACH_EMAIL = process.env.DEV_COACH_EMAIL!;
const COACH_NAME = process.env.DEV_COACH_NAME!;

if (!SUPABASE_URL || !SERVICE_ROLE || !DEV_PASSWORD || !COACH_EMAIL || !COACH_NAME) {
  console.error("Missing required env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEV_PASSWORD, DEV_COACH_EMAIL, DEV_COACH_NAME)");
  process.exit(1);
}

if (TRAINEE_EMAILS.length !== TRAINEE_NAMES.length) {
  console.error(`DEV_TRAINEE_EMAILS (${TRAINEE_EMAILS.length}) and DEV_TRAINEE_NAMES (${TRAINEE_NAMES.length}) must have the same length`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function ensureAuthUser(email: string): Promise<string> {
  const { data: existing, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw new Error(`listUsers failed: ${listErr.message}`);

  const found = existing.users.find((u) => u.email === email);
  if (found) return found.id;

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: DEV_PASSWORD,
    email_confirm: true,
  });
  if (createErr || !created.user) throw new Error(`createUser(${email}) failed: ${createErr?.message}`);
  return created.user.id;
}

async function upsertProfile(id: string, email: string, name: string, role: "admin" | "trainee"): Promise<void> {
  const { error } = await supabase.from("profiles").upsert(
    { id, email, name, role, is_active: true },
    { onConflict: "id" },
  );
  if (error) throw new Error(`profile upsert(${email}) failed: ${error.message}`);
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
  const nextWeekStart = dateForDay(weekStart, 7);
  const hours = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

  const rows: { date: string; start_time: string; capacity: number; lockout_override: boolean }[] = [];
  for (const ws of [weekStart, nextWeekStart]) {
    for (let day = 0; day <= 5; day++) {
      const date = dateForDay(ws, day);
      for (const time of hours) rows.push({ date, start_time: time, capacity: 2, lockout_override: false });
    }
  }
  const { error } = await supabase.from("slots").upsert(rows, { onConflict: "date,start_time" });
  if (error) throw new Error(`slot upsert failed: ${error.message}`);
  return rows.length;
}

async function seed() {
  console.log(`Seeding ${SUPABASE_URL}\n`);

  // Coach
  const coachId = await ensureAuthUser(COACH_EMAIL);
  await upsertProfile(coachId, COACH_EMAIL, COACH_NAME, "admin");
  console.log(`Coach: ${COACH_NAME} <${COACH_EMAIL}>`);

  // Trainees
  for (let i = 0; i < TRAINEE_EMAILS.length; i++) {
    const email = TRAINEE_EMAILS[i];
    const name = TRAINEE_NAMES[i];
    const id = await ensureAuthUser(email);
    await upsertProfile(id, email, name, "trainee");
    console.log(`  Trainee: ${name} <${email}>`);
  }

  // Slots
  const slotCount = await seedSlots();
  console.log(`\nSlots: ${slotCount} for current + next week`);
  console.log("\nDone.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
