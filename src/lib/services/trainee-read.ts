import { Booking, Slot } from "@/lib/types";
import { BookingStore } from "./booking-store";
import { Bookings } from "./bookings";
import { israelSlotToUTC, todayIL, weekStartForDate } from "./israel-time";
import { listVisibleNotesForTrainee } from "./notes-repo";

/**
 * TraineeReadModel — read-only, view-shaped queries for the trainee UI.
 *
 * The read-side twin of {@link import("@/lib/coach/read-model").CoachReadModel}:
 * BookingStore is the write boundary, this is the read side. Routes stay dumb
 * (auth → call → serialize); the streak / attendance / next-session rules live
 * here, beside the booking lifecycle, not stranded in an HTTP handler.
 */
export type TraineeVisibleNote = {
  id: string;
  body: string;
  createdAt: string;
};

export type TraineeDashboardView = {
  sessionsThisMonth: number;
  pastConfirmed: number;
  noShows: number;
  attendanceRate: number; // past-confirmed / (past-confirmed + no_show); 1 when none yet
  currentStreak: number; // trailing run of past confirmed sessions; broken by a no_show
  nextSessionAt: string | null; // ISO of the soonest upcoming confirmed slot
  recentVisibleNote: TraineeVisibleNote | null;
  remainingEdits: number;
  memberSinceDays: number;
};

export interface TraineeReadModel {
  dashboard(input: {
    userId: string;
    createdAt: string;
  }): Promise<TraineeDashboardView>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function makeTraineeReadModel(
  store: BookingStore,
  bookings: Bookings
): TraineeReadModel {
  return {
    async dashboard({ userId, createdAt }): Promise<TraineeDashboardView> {
      const now = Date.now();

      // Include cancelled + no_show — getTraineeBookings filters to confirmed.
      const all = (await store.getAllBookings()).filter(
        (b) => b.traineeId === userId
      );
      // One batched slot read instead of getSlot() per booking.
      const slotIds = [...new Set(all.map((b) => b.slotId))];
      const slots = await store.getSlotsByIds(slotIds);
      const slotById = new Map<string, Slot>(slots.map((s) => [s.id, s]));

      const [yy, mm] = todayIL().split("-").map(Number);
      let sessionsThisMonth = 0;
      let pastConfirmed = 0;
      let noShows = 0;
      let nextSessionAt: string | null = null;
      let nextSessionMs = Infinity;
      const pastForStreak: { ms: number; status: Booking["status"] }[] = [];

      for (const b of all) {
        const slot = slotById.get(b.slotId);
        if (!slot) continue;
        const ms = israelSlotToUTC(slot.date, slot.startTime).getTime();
        const [sy, sm] = slot.date.split("-").map(Number);
        if (sy === yy && sm === mm && b.status !== "cancelled") sessionsThisMonth++;
        if (b.status === "confirmed" && ms < now) pastConfirmed++;
        if (b.status === "no_show") noShows++;
        if (b.status === "confirmed" && ms > now && ms < nextSessionMs) {
          nextSessionMs = ms;
          nextSessionAt = new Date(ms).toISOString();
        }
        if (ms < now && (b.status === "confirmed" || b.status === "no_show")) {
          pastForStreak.push({ ms, status: b.status });
        }
      }

      // Streak: newest → oldest, count confirmed until a no_show breaks the chain.
      pastForStreak.sort((a, b) => b.ms - a.ms);
      let currentStreak = 0;
      for (const p of pastForStreak) {
        if (p.status === "confirmed") currentStreak++;
        else break;
      }

      const totalPast = pastConfirmed + noShows;
      const attendanceRate = totalPast > 0 ? pastConfirmed / totalPast : 1;

      const note = (await listVisibleNotesForTrainee(userId, 1))[0];
      const recentVisibleNote: TraineeVisibleNote | null = note
        ? {
            id: note.id,
            body: note.body,
            createdAt:
              note.createdAt instanceof Date
                ? note.createdAt.toISOString()
                : String(note.createdAt),
          }
        : null;
      const remainingEdits = await bookings.getRemainingEdits(
        userId,
        weekStartForDate(todayIL())
      );
      const memberSinceDays = Math.floor(
        (now - new Date(createdAt).getTime()) / DAY_MS
      );

      return {
        sessionsThisMonth,
        pastConfirmed,
        noShows,
        attendanceRate,
        currentStreak,
        nextSessionAt,
        recentVisibleNote,
        remainingEdits,
        memberSinceDays,
      };
    },
  };
}
