/**
 * Seed script: populates Supabase with sample data for development.
 *
 * Creates:
 * - 1 coach (admin)
 * - 30 trainees (10 recurring with preferred day/time, 20 ad-hoc)
 * - Slots for the current week (Sun-Fri, 06:00-20:00 every hour)
 * - Sample bookings across the week
 *
 * Usage: npx tsx scripts/seed.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- Data ---

const COACH = { phone: "+972500000000", name: "Coach Shay", role: "admin" as const };

const TRAINEES = [
  // Recurring trainees (10) — auto-booked weekly
  { phone: "+972501000001", name: "Avi Cohen", isRecurring: true, preferredDay: 1, preferredTime: "08:00" },
  { phone: "+972501000002", name: "Dana Levi", isRecurring: true, preferredDay: 1, preferredTime: "09:00" },
  { phone: "+972501000003", name: "Eyal Katz", isRecurring: true, preferredDay: 2, preferredTime: "08:00" },
  { phone: "+972501000004", name: "Gal Mizrahi", isRecurring: true, preferredDay: 2, preferredTime: "10:00" },
  { phone: "+972501000005", name: "Hila Shapira", isRecurring: true, preferredDay: 3, preferredTime: "07:00" },
  { phone: "+972501000006", name: "Ido Ben-David", isRecurring: true, preferredDay: 3, preferredTime: "16:00" },
  { phone: "+972501000007", name: "Keren Avraham", isRecurring: true, preferredDay: 4, preferredTime: "08:00" },
  { phone: "+972501000008", name: "Lior Peretz", isRecurring: true, preferredDay: 4, preferredTime: "17:00" },
  { phone: "+972501000009", name: "Matan Rosen", isRecurring: true, preferredDay: 5, preferredTime: "09:00" },
  { phone: "+972501000010", name: "Noa Goldberg", isRecurring: true, preferredDay: 5, preferredTime: "10:00" },
  // Ad-hoc trainees (20)
  { phone: "+972502000001", name: "Ofir Tal" },
  { phone: "+972502000002", name: "Pnina Haim" },
  { phone: "+972502000003", name: "Rami Zohar" },
  { phone: "+972502000004", name: "Shira Naim" },
  { phone: "+972502000005", name: "Tomer Blum" },
  { phone: "+972502000006", name: "Uri Segal" },
  { phone: "+972502000007", name: "Vered Kaplan" },
  { phone: "+972502000008", name: "Yael Fischer" },
  { phone: "+972502000009", name: "Ziv Hadad" },
  { phone: "+972502000010", name: "Alon Mor" },
  { phone: "+972502000011", name: "Bat-El Oren" },
  { phone: "+972502000012", name: "Chen Dagan" },
  { phone: "+972502000013", name: "Dikla Stern" },
  { phone: "+972502000014", name: "Einav Paz" },
  { phone: "+972502000015", name: "Fadi Nasser" },
  { phone: "+972502000016", name: "Galit Yosef" },
  { phone: "+972502000017", name: "Hadar Friedman" },
  { phone: "+972502000018", name: "Ilan Baruch" },
  { phone: "+972502000019", name: "Jasmine Levy" },
  { phone: "+972502000020", name: "Kobi Shaked" },
];

function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = now.getDate() - day;
  const sunday = new Date(now);
  sunday.setDate(diff);
  return sunday.toISOString().slice(0, 10);
}

function dateForDay(weekStart: string, dayOffset: number): string {
  const d = new Date(weekStart + "T12:00:00Z");
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

async function createUser(phone: string, name: string, role: "admin" | "trainee", extra?: {
  isRecurring?: boolean;
  preferredDay?: number;
  preferredTime?: string;
}): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({
    phone,
    phone_confirm: true,
  });
  if (error) {
    // User may already exist
    if (error.message.includes("already")) {
      const { data: existing } = await db.from("profiles").select("id").eq("phone", phone).single();
      if (existing) return existing.id;
    }
    throw error;
  }

  const userId = data.user.id;
  await db.from("profiles").upsert({
    id: userId,
    phone,
    name,
    role,
    is_recurring: extra?.isRecurring ?? false,
    preferred_day: extra?.preferredDay ?? null,
    preferred_time: extra?.preferredTime ?? null,
    is_active: true,
  });

  return userId;
}

async function seed() {
  console.log("Seeding Supabase...\n");

  // 1. Create coach
  const coachId = await createUser(COACH.phone, COACH.name, "admin");
  console.log(`Coach: ${COACH.name} (${coachId})`);

  // 2. Create trainees
  const traineeIds: string[] = [];
  for (const t of TRAINEES) {
    const id = await createUser(t.phone, t.name, "trainee", {
      isRecurring: (t as { isRecurring?: boolean }).isRecurring,
      preferredDay: (t as { preferredDay?: number }).preferredDay,
      preferredTime: (t as { preferredTime?: string }).preferredTime,
    });
    traineeIds.push(id);
    const tag = (t as { isRecurring?: boolean }).isRecurring ? " [recurring]" : "";
    console.log(`  Trainee: ${t.name}${tag}`);
  }

  // 3. Create slots for current week (Sun-Fri, 06:00-20:00)
  const weekStart = getWeekStart();
  console.log(`\nWeek start: ${weekStart}`);

  const hours = ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
    "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

  const slotRows: { date: string; start_time: string; capacity: number; lockout_override: boolean }[] = [];
  for (let day = 0; day <= 5; day++) {
    const date = dateForDay(weekStart, day);
    for (const time of hours) {
      slotRows.push({
        date,
        start_time: time,
        capacity: 2,
        lockout_override: false,
      });
    }
  }

  const { error: slotError } = await db.from("slots").upsert(slotRows, { onConflict: "date,start_time" });
  if (slotError) console.error("Slot upsert error:", slotError.message);
  else console.log(`Created ${slotRows.length} slots`);

  // 4. Fetch slot IDs for booking
  const { data: slots } = await db.from("slots").select("id, date, start_time")
    .gte("date", weekStart)
    .order("date")
    .order("start_time");

  if (!slots || slots.length === 0) {
    console.error("No slots found after insert");
    return;
  }

  // 5. Create sample bookings — recurring trainees get their preferred slots
  let bookingCount = 0;
  for (let i = 0; i < 10; i++) {
    const t = TRAINEES[i] as { preferredDay: number; preferredTime: string };
    const date = dateForDay(weekStart, t.preferredDay);
    const slot = slots.find((s) => s.date === date && s.start_time === t.preferredTime);
    if (slot) {
      const { error } = await db.from("bookings").insert({
        slot_id: slot.id,
        trainee_id: traineeIds[i],
        is_auto_booked: true,
        status: "confirmed",
      });
      if (!error) bookingCount++;
    }
  }

  // A few ad-hoc bookings
  const adHocBookings = [
    { traineeIdx: 10, dayOffset: 1, time: "10:00" },
    { traineeIdx: 11, dayOffset: 1, time: "10:00" },
    { traineeIdx: 12, dayOffset: 2, time: "14:00" },
    { traineeIdx: 13, dayOffset: 3, time: "09:00" },
    { traineeIdx: 14, dayOffset: 4, time: "15:00" },
  ];

  for (const ab of adHocBookings) {
    const date = dateForDay(weekStart, ab.dayOffset);
    const slot = slots.find((s) => s.date === date && s.start_time === ab.time);
    if (slot) {
      const { error } = await db.from("bookings").insert({
        slot_id: slot.id,
        trainee_id: traineeIds[ab.traineeIdx],
        is_auto_booked: false,
        status: "confirmed",
      });
      if (!error) bookingCount++;
    }
  }

  console.log(`Created ${bookingCount} bookings`);
  console.log("\nDone!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
