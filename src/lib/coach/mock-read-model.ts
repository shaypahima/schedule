import {
  CoachReadModel,
  DashboardView,
  RosterEntry,
  TraineeDetailView,
  TraineeSummary,
  ChangeRequestEntry,
  TraineesFilter,
  PendingApprovalView,
} from "./read-model";
import { BookingStore } from "@/lib/services/booking-store";
import { AuthService } from "@/lib/services/auth";
import { Bookings } from "@/lib/services/bookings";
import { ProgressStore } from "@/lib/services/progress-store";
import { loadProfile } from "@/lib/auth/profile-repo";
import { Booking, MeasurementLog, Profile, Slot } from "@/lib/types";
import { todayIL, weekStartForDate, israelSlotToUTC } from "@/lib/services/israel-time";

const FOURTEEN_DAYS_MS = 14 * 86_400_000;
const TREND_FLAT_THRESHOLD_KG = 0.5;

/**
 * Weight trend over the trailing 14d: compares the newest weight to the newest
 * weight that is at least 14 days older. `null` if there are fewer than two
 * weight points, or no point old enough to compare against.
 * `measurements` is newest-first (as ProgressStore.listMeasurements returns).
 */
function computeWeightTrend14d(
  measurements: MeasurementLog[]
): "up" | "flat" | "down" | null {
  const points = measurements.filter((m) => m.weightKg != null);
  if (points.length < 2) return null;
  const newest = points[0];
  const cutoff = newest.loggedAt.getTime() - FOURTEEN_DAYS_MS;
  const older = points.find((m) => m.loggedAt.getTime() <= cutoff);
  if (!older) return null;
  const delta = newest.weightKg! - older.weightKg!;
  if (Math.abs(delta) < TREND_FLAT_THRESHOLD_KG) return "flat";
  return delta > 0 ? "up" : "down";
}

/**
 * Attendance over the given roster entries: past-confirmed / (past-confirmed +
 * no_show). `null` when there are no past sessions yet (so callers can hide a
 * "100%" badge that would otherwise mislead for never-attended trainees).
 */
function computeAttendanceRate(entries: RosterEntry[]): number | null {
  const now = Date.now();
  const pastConfirmed = entries.filter(
    (e) =>
      e.status === "confirmed" &&
      israelSlotToUTC(e.slotDate, e.slotTime).getTime() < now
  ).length;
  const noShows = entries.filter((e) => e.status === "no_show").length;
  const total = pastConfirmed + noShows;
  return total > 0 ? pastConfirmed / total : null;
}

/**
 * Composes BookingStore + AuthService + Bookings into the read-model.
 * Same impl works for both MockBookingStore (tests) and SupabaseBookingStore.
 * A production impl could replace this with hand-written SQL for better N+1
 * behavior, but the composition is correct and good enough for now.
 */
export function makeCoachReadModel(
  store: BookingStore,
  auth: AuthService,
  bookings: Bookings,
  progress: ProgressStore
): CoachReadModel {
  /** Progress aggregates from a preloaded newest-first measurement list (30d window). */
  function aggregatesFromMeasurements(ms: MeasurementLog[]): {
    lastWeightKg: number | null;
    weightTrend14d: "up" | "flat" | "down" | null;
    lastMeasurementAt: string | null;
  } {
    const lastWeight = ms.find((m) => m.weightKg != null);
    return {
      lastWeightKg: lastWeight?.weightKg ?? null,
      weightTrend14d: computeWeightTrend14d(ms),
      lastMeasurementAt: ms[0]?.loggedAt.toISOString() ?? null,
    };
  }

  /**
   * Per-trainee progress aggregates for the detail view (single-trainee fetch;
   * the list view batches via listMeasurementsForTrainees instead).
   */
  async function progressAggregates(traineeId: string): Promise<{
    lastWeightKg: number | null;
    weightTrend14d: "up" | "flat" | "down" | null;
    lastMeasurementAt: string | null;
  }> {
    const ms = await progress.listMeasurements(traineeId, { sinceDays: 30 });
    return aggregatesFromMeasurements(ms);
  }

  async function traineesByStatus(): Promise<{
    trainees: Profile[];
    byId: Map<string, Profile>;
  }> {
    const trainees = await auth.getTrainees();
    const byId = new Map(trainees.map((t) => [t.id, t]));
    return { trainees, byId };
  }

  async function lastSessionAt(traineeId: string): Promise<string | null> {
    const all = await store.getTraineeBookings(traineeId);
    const now = Date.now();
    let latestPast: { slotDate: string; slotTime: string } | null = null;
    for (const b of all) {
      if (b.status !== "confirmed") continue;
      const slot = await store.getSlot(b.slotId);
      if (!slot) continue;
      const ms = israelSlotToUTC(slot.date, slot.startTime).getTime();
      if (ms > now) continue;
      if (
        !latestPast ||
        israelSlotToUTC(slot.date, slot.startTime).getTime() >
          israelSlotToUTC(latestPast.slotDate, latestPast.slotTime).getTime()
      ) {
        latestPast = { slotDate: slot.date, slotTime: slot.startTime };
      }
    }
    return latestPast
      ? israelSlotToUTC(latestPast.slotDate, latestPast.slotTime).toISOString()
      : null;
  }

  function rosterEntryFromSlot(
    booking: Pick<Booking, "id" | "slotId" | "traineeId" | "isAutoBooked">,
    status: RosterEntry["status"],
    slot: Slot,
    byId: Map<string, Profile>
  ): RosterEntry {
    const t = byId.get(booking.traineeId);
    return {
      bookingId: booking.id,
      slotId: booking.slotId,
      startsAt: israelSlotToUTC(slot.date, slot.startTime).toISOString(),
      slotDate: slot.date,
      slotTime: slot.startTime,
      trainee: { id: booking.traineeId, name: t?.name ?? "" },
      status,
      isAutoBooked: booking.isAutoBooked,
    };
  }

  async function buildRosterEntry(
    bookingId: string,
    slotId: string,
    traineeId: string,
    isAutoBooked: boolean,
    status: RosterEntry["status"],
    byId: Map<string, Profile>
  ): Promise<RosterEntry | null> {
    const slot = await store.getSlot(slotId);
    if (!slot) return null;
    return rosterEntryFromSlot({ id: bookingId, slotId, traineeId, isAutoBooked }, status, slot, byId);
  }

  async function pendingApprovalsCount(): Promise<number> {
    const trainees = await auth.getTrainees();
    return trainees.filter(
      (t) => (t as Profile & { status?: string }).status === "pending"
    ).length;
  }

  async function countNoShowsForWeek(weekStart: string): Promise<number> {
    const [y, m, d] = weekStart.split("-").map(Number);
    const end = new Date(y, m - 1, d + 7);
    const weekEndStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    const all = await store.getAllBookings();
    let count = 0;
    for (const b of all) {
      if (b.status !== "no_show") continue;
      const slot = await store.getSlot(b.slotId);
      if (!slot) continue;
      if (slot.date >= weekStart && slot.date < weekEndStr) count++;
    }
    return count;
  }

  return {
    async getCoachDashboard(): Promise<DashboardView> {
      const today = todayIL();
      const todayRoster = await this.getDayBookings(today);
      const pendingRequests = await this.getPendingChangeRequests();
      const weekStart = weekStartForDate(today);
      const noShowsThisWeek = await countNoShowsForWeek(weekStart);
      return {
        pendingApprovals: await pendingApprovalsCount(),
        pendingChangeRequests: pendingRequests.length,
        noShowsThisWeek,
        todayRoster,
        urgentRequests: pendingRequests.slice(0, 3),
      };
    },

    async getTraineesList(filter: TraineesFilter = "all"): Promise<TraineeSummary[]> {
      const { trainees, byId } = await traineesByStatus();
      const today = todayIL();
      const weekStart = weekStartForDate(today);
      const [y, m, d] = weekStart.split("-").map(Number);
      const weekEnd = new Date(y, m - 1, d + 7);
      const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, "0")}-${String(weekEnd.getDate()).padStart(2, "0")}`;

      const candidates = trainees.filter((t) => {
        const tt = t as Profile & { status?: string };
        const status = (tt.status as TraineeSummary["status"] | undefined) ??
          (t.isActive ? "active" : "deactivated");
        if (filter === "pending" && status !== "pending") return false;
        if (filter === "active" && status !== "active") return false;
        return true;
      });

      // Three batch reads for the whole roster instead of ~4 reads per trainee.
      const ids = candidates.map((t) => t.id);
      const allBookings = await store.getConfirmedBookingsForTrainees(ids);
      const slots = await store.getSlotsByIds([...new Set(allBookings.map((b) => b.slotId))]);
      const slotById = new Map(slots.map((s) => [s.id, s]));
      const measurements = await progress.listMeasurementsForTrainees(ids, { sinceDays: 30 });

      const bookingsByTrainee = new Map<string, Booking[]>();
      for (const b of allBookings) {
        const list = bookingsByTrainee.get(b.traineeId);
        if (list) list.push(b);
        else bookingsByTrainee.set(b.traineeId, [b]);
      }
      const measurementsByTrainee = new Map<string, MeasurementLog[]>();
      for (const ml of measurements) {
        const list = measurementsByTrainee.get(ml.traineeId);
        if (list) list.push(ml);
        else measurementsByTrainee.set(ml.traineeId, [ml]);
      }

      const now = Date.now();
      const summaries: TraineeSummary[] = [];
      for (const t of candidates) {
        const tt = t as Profile & { status?: string; email?: string };
        const status = (tt.status as TraineeSummary["status"] | undefined) ??
          (t.isActive ? "active" : "deactivated");

        const myBookings = bookingsByTrainee.get(t.id) ?? [];
        const mySlots = myBookings
          .map((b) => ({ booking: b, slot: slotById.get(b.slotId) }))
          .filter((x): x is { booking: Booking; slot: Slot } => x.slot !== undefined);

        const bookedThisWeek = mySlots.some(
          (x) => x.slot.date >= weekStart && x.slot.date < weekEndStr
        );
        if (filter === "unbooked-this-week" && (bookedThisWeek || !t.isActive)) continue;

        let latestPastMs = -Infinity;
        for (const x of mySlots) {
          const ms = israelSlotToUTC(x.slot.date, x.slot.startTime).getTime();
          if (ms <= now && ms > latestPastMs) latestPastMs = ms;
        }

        const entries = mySlots.map((x) =>
          rosterEntryFromSlot(x.booking, x.booking.status, x.slot, byId)
        );

        const agg = aggregatesFromMeasurements(measurementsByTrainee.get(t.id) ?? []);
        summaries.push({
          id: t.id,
          name: t.name,
          email: tt.email ?? null,
          status,
          isRecurring: t.isRecurring,
          preferredDay: t.preferredDay,
          preferredTime: t.preferredTime,
          bookedThisWeek,
          lastSessionAt: latestPastMs > -Infinity ? new Date(latestPastMs).toISOString() : null,
          lastWeightKg: agg.lastWeightKg,
          weightTrend14d: agg.weightTrend14d,
          lastMeasurementAt: agg.lastMeasurementAt,
          attendanceRate: computeAttendanceRate(entries),
        });
      }

      return summaries;
    },

    async getTraineeDetail(traineeId: string): Promise<TraineeDetailView | null> {
      const { byId } = await traineesByStatus();
      const t = byId.get(traineeId);
      if (!t) return null;
      const tt = t as Profile & { status?: string; email?: string };

      const today = todayIL();
      const weekStart = weekStartForDate(today);
      const weekBookings = await store.getTraineeBookingsForWeek(traineeId, weekStart);
      const remainingEdits = await bookings.getRemainingEdits(traineeId, weekStart);

      const all = await store.getTraineeBookings(traineeId);
      // Sort by createdAt desc, take 10
      const recent = [...all]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10);

      const recentBookings: RosterEntry[] = [];
      for (const b of recent) {
        const entry = await buildRosterEntry(
          b.id,
          b.slotId,
          b.traineeId,
          b.isAutoBooked,
          b.status,
          byId
        );
        if (entry) recentBookings.push(entry);
      }

      // Attendance rate: confirmed-past / (confirmed-past + no_show). Today the
      // only past terminal state is `confirmed` (auto-attended). Until Phase 16
      // wires `no_show`, attendanceRate is always 1.0 for trainees with past
      // bookings. The detail view defaults a no-session trainee to 1.0 (legacy
      // behavior); the list summary keeps it null so the chip can hide.
      const rate = computeAttendanceRate(recentBookings);
      const attendanceRate = rate ?? 1;
      const agg = await progressAggregates(traineeId);

      return {
        trainee: {
          id: t.id,
          name: t.name,
          email: tt.email ?? null,
          status:
            (tt.status as TraineeSummary["status"] | undefined) ??
            (t.isActive ? "active" : "deactivated"),
          isRecurring: t.isRecurring,
          preferredDay: t.preferredDay,
          preferredTime: t.preferredTime,
          bookedThisWeek: weekBookings.length > 0,
          lastSessionAt: await lastSessionAt(traineeId),
          lastWeightKg: agg.lastWeightKg,
          weightTrend14d: agg.weightTrend14d,
          lastMeasurementAt: agg.lastMeasurementAt,
          attendanceRate: rate,
        },
        recentBookings,
        attendanceRate,
        remainingEdits,
        weekBookingsCount: weekBookings.length,
      };
    },

    async getDayBookings(date: string): Promise<RosterEntry[]> {
      const slots = await store.getAllSlotsForDate(date);
      const slotIds = new Set(slots.map((s) => s.id));
      const all = await store.getAllBookings();
      const dayBookings = all.filter(
        (b) => b.status === "confirmed" && slotIds.has(b.slotId)
      );

      const { byId } = await traineesByStatus();
      const out: RosterEntry[] = [];
      for (const b of dayBookings) {
        const entry = await buildRosterEntry(
          b.id,
          b.slotId,
          b.traineeId,
          b.isAutoBooked,
          b.status,
          byId
        );
        if (entry) out.push(entry);
      }
      return out;
    },

    async getPendingApprovals(): Promise<PendingApprovalView[]> {
      const { trainees } = await traineesByStatus();
      const out: PendingApprovalView[] = [];
      for (const t of trainees) {
        const tt = t as Profile & { status?: string; email?: string };
        if (tt.status !== "pending") continue;
        // Hydrate via loadProfile to read trainee_profile fields too.
        const full = await loadProfile(t.id);
        if (!full || !full.hasIntro) continue; // only those who completed intro
        out.push({
          id: full.userId,
          name: full.name,
          email: full.email,
          phone: full.phone,
          introText: null, // mock impl doesn't read intro_text directly; supabase impl would
          introSubmittedAt: null,
        });
      }
      return out;
    },

    async getPendingChangeRequests(): Promise<ChangeRequestEntry[]> {
      const pending = await store.listPendingRequests();
      const { byId } = await traineesByStatus();
      const out: ChangeRequestEntry[] = [];
      for (const r of pending) {
        const booking = await store.getBooking(r.bookingId);
        if (!booking) continue;
        const fromSlot = await store.getSlot(booking.slotId);
        if (!fromSlot) continue;
        const toSlot = r.requestedNewSlotId
          ? await store.getSlot(r.requestedNewSlotId)
          : null;
        const t = byId.get(booking.traineeId);
        out.push({
          id: r.id,
          requestedAt: r.requestedAt.toISOString(),
          reason: r.reason,
          trainee: { id: booking.traineeId, name: t?.name ?? "" },
          fromSlot: {
            id: fromSlot.id,
            startsAt: israelSlotToUTC(fromSlot.date, fromSlot.startTime).toISOString(),
          },
          toSlot: toSlot
            ? {
                id: toSlot.id,
                startsAt: israelSlotToUTC(toSlot.date, toSlot.startTime).toISOString(),
              }
            : null,
        });
      }
      return out;
    },
  };
}
