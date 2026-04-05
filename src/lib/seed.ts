import { MockUser } from "./services/auth";
import { Profile, Booking, Slot } from "./types";

/** Israeli first names for realistic seed data */
const FIRST_NAMES = [
  "Avi", "Dana", "Yael", "Noam", "Tamar", "Oren", "Shira", "Eitan",
  "Maya", "Lior", "Noa", "Gil", "Rotem", "Amir", "Hila", "Ido",
  "Michal", "Ran", "Tali", "Omri", "Keren", "Dor", "Lihi", "Yonatan",
  "Efrat", "Nadav", "Sapir", "Itay", "Roni", "Gal",
];

const LAST_NAMES = [
  "Cohen", "Levi", "Mizrahi", "Peretz", "Friedman", "Azulay", "Ben-David",
  "Shapira", "Goldstein", "Aharoni", "Katz", "Avraham", "Dahan", "Malka",
  "Biton",
];

/** Days: 0=Sun..5=Fri */
const DAYS = [0, 1, 2, 3, 4, 5];
/** Hours: 6am to 7pm (last session starts at 19:00, ends 20:00) */
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

export interface SeedData {
  coach: MockUser;
  trainees: MockUser[];
  recurringTrainees: { userId: string; preferredDay: number; preferredTime: string }[];
  sampleSlots: Omit<Slot, "id" | "currentBookings">[];
  sampleBookings: { traineeIndex: number; slotIndex: number }[];
}

export function generateSeedData(): SeedData {
  const coach: MockUser = {
    id: "admin-001",
    phone: "+972500000000",
    name: "Coach",
    role: "admin",
  };

  const trainees: MockUser[] = FIRST_NAMES.map((firstName, i) => ({
    id: `trainee-${String(i + 1).padStart(3, "0")}`,
    phone: `+9725000000${String(i + 1).padStart(2, "0")}`,
    name: `${firstName} ${LAST_NAMES[i % LAST_NAMES.length]}`,
    role: "trainee" as const,
  }));

  // ~60% are recurring (18 out of 30)
  const recurringTrainees = trainees.slice(0, 18).map((t, i) => ({
    userId: t.id,
    preferredDay: DAYS[i % DAYS.length],
    preferredTime: `${String(HOURS[i % HOURS.length]).padStart(2, "0")}:00`,
  }));

  // Sample week: next Sun-Fri (2026-04-05 is a Sunday)
  const weekStart = "2026-04-05";
  const sampleSlots: Omit<Slot, "id" | "currentBookings">[] = [];

  for (let day = 0; day < 6; day++) {
    const dateNum = 5 + day; // April 5-10
    const date = `2026-04-${String(dateNum).padStart(2, "0")}`;
    // 6am to 8pm = 14 slots per day
    for (const hour of HOURS) {
      sampleSlots.push({
        date,
        startTime: `${String(hour).padStart(2, "0")}:00`,
        capacity: 2,
        lockoutOverride: false,
      });
    }
  }

  // Sample bookings: first 12 trainees each book 1 slot
  const sampleBookings = Array.from({ length: 12 }, (_, i) => ({
    traineeIndex: i,
    slotIndex: i * 2, // spread them out
  }));

  return {
    coach,
    trainees,
    recurringTrainees,
    sampleSlots,
    sampleBookings,
  };
}
