import {
  CoachReadModel,
  DashboardView,
  MonthlyStats,
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

  /** Batch-resolve the slots referenced by a set of bookings into a map. */
  async function slotMapFor(
    bookingsList: Pick<Booking, "slotId">[]
  ): Promise<Map<string, Slot>> {
    const ids = [...new Set(bookingsList.map((b) => b.slotId))];
    const slots = await store.getSlotsByIds(ids);
    return new Map(slots.map((s) => [s.id, s]));
  }

  /** lastSessionAt computed from already-loaded bookings + a slot map (no I/O). */
  function lastSessionAtFrom(
    bookingsList: Booking[],
    slotById: Map<string, Slot>
  ): string | null {
    const now = Date.now();
    let latestPastMs = -Infinity;
    for (const b of bookingsList) {
      if (b.status !== "confirmed") continue;
      const slot = slotById.get(b.slotId);
      if (!slot) continue;
      const ms = israelSlotToUTC(slot.date, slot.startTime).getTime();
      if (ms <= now && ms > latestPastMs) latestPastMs = ms;
    }
    return latestPastMs > -Infinity ? new Date(latestPastMs).toISOString() : null;
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

  /** Roster entries for a list of bookings, slots resolved from a prefetched map. */
  function rosterEntriesFrom(
    bookingsList: Booking[],
    slotById: Map<string, Slot>,
    byId: Map<string, Profile>
  ): RosterEntry[] {
    const out: RosterEntry[] = [];
    for (const b of bookingsList) {
      const slot = slotById.get(b.slotId);
      if (!slot) continue;
      out.push(rosterEntryFromSlot(b, b.status, slot, byId));
    }
    return out;
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
    const noShows = all.filter((b) => b.status === "no_show");
    const slotById = await slotMapFor(noShows);
    let count = 0;
    for (const b of noShows) {
      const slot = slotById.get(b.slotId);
      if (!slot) continue;
      if (slot.date >= weekStart && slot.date < weekEndStr) count++;
    }
    return count;
  }

  /**
   * Held/no-show aggregates for slots in [fromDate, toDate) that already
   * started. One pass over all bookings; slots resolved from a prefetched map.
   */
  async function monthlyStats(fromDate: string, toDate: string): Promise<MonthlyStats> {
    const all = await store.getAllBookings();
    const slots = await store.getSlotsByIds([...new Set(all.map((b) => b.slotId))]);
    const slotById = new Map(slots.map((s) => [s.id, s]));
    const now = Date.now();

    let sessionsHeld = 0;
    let noShows = 0;
    const traineeIds = new Set<string>();
    for (const b of all) {
      if (b.status !== "confirmed" && b.status !== "no_show") continue;
      const slot = slotById.get(b.slotId);
      if (!slot || slot.date < fromDate || slot.date >= toDate) continue;
      if (israelSlotToUTC(slot.date, slot.startTime).getTime() > now) continue;
      if (b.status === "no_show") noShows++;
      else sessionsHeld++;
      traineeIds.add(b.traineeId);
    }
    const total = sessionsHeld + noShows;
    return {
      sessionsHeld,
      noShows,
      attendanceRate: total > 0 ? sessionsHeld / total : null,
      activeTrainees: traineeIds.size,
    };
  }

  return {
    async getCoachDashboard(): Promise<DashboardView> {
      const today = todayIL();
      const todayRoster = await this.getDayBookings(today);
      const pendingRequests = await this.getPendingChangeRequests();
      const weekStart = weekStartForDate(today);
      const noShowsThisWeek = await countNoShowsForWeek(weekStart);

      const [y, m] = today.split("-").map(Number);
      const fmt = (yy: number, mm: number) =>
        `${mm > 12 ? yy + 1 : yy}-${String(mm > 12 ? 1 : mm).padStart(2, "0")}-01`;
      const monthStart = fmt(y, m);
      const nextMonthStart = fmt(y, m + 1);
      const prevMonthStart = m === 1 ? fmt(y - 1, 12) : fmt(y, m - 1);

      const current = await monthlyStats(monthStart, nextMonthStart);
      const prev = await monthlyStats(prevMonthStart, monthStart);
      const prevEmpty = prev.sessionsHeld + prev.noShows === 0;

      return {
        pendingApprovals: await pendingApprovalsCount(),
        pendingChangeRequests: pendingRequests.length,
        noShowsThisWeek,
        monthly: { ...current, prev: prevEmpty ? null : prev },
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

      // Four batch reads for the whole roster instead of ~4 reads per trainee.
      const ids = candidates.map((t) => t.id);
      const allBookings = await store.getConfirmedBookingsForTrainees(ids);
      const noShowBookings = await store.getNoShowBookingsForTrainees(ids);
      const slots = await store.getSlotsByIds([
        ...new Set([...allBookings, ...noShowBookings].map((b) => b.slotId)),
      ]);
      const slotById = new Map(slots.map((s) => [s.id, s]));
      const measurements = await progress.listMeasurementsForTrainees(ids, { sinceDays: 30 });

      const bookingsByTrainee = new Map<string, Booking[]>();
      for (const b of allBookings) {
        const list = bookingsByTrainee.get(b.traineeId);
        if (list) list.push(b);
        else bookingsByTrainee.set(b.traineeId, [b]);
      }
      const noShowsByTrainee = new Map<string, Booking[]>();
      for (const b of noShowBookings) {
        const list = noShowsByTrainee.get(b.traineeId);
        if (list) list.push(b);
        else noShowsByTrainee.set(b.traineeId, [b]);
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
        let hasUpcoming = false;
        for (const x of mySlots) {
          const ms = israelSlotToUTC(x.slot.date, x.slot.startTime).getTime();
          if (ms <= now && ms > latestPastMs) latestPastMs = ms;
          if (ms > now) hasUpcoming = true;
        }

        // At-risk (#83): no_shows beats inactive — an upcoming booking proves
        // engagement but not attendance.
        const fourWeeksAgo = now - 28 * 86_400_000;
        let recentNoShows = 0;
        for (const b of noShowsByTrainee.get(t.id) ?? []) {
          const slot = slotById.get(b.slotId);
          if (!slot) continue;
          const ms = israelSlotToUTC(slot.date, slot.startTime).getTime();
          if (ms > fourWeeksAgo && ms <= now) recentNoShows++;
        }
        const inactive =
          !hasUpcoming &&
          (latestPastMs === -Infinity || now - latestPastMs >= FOURTEEN_DAYS_MS);
        const atRisk: TraineeSummary["atRisk"] =
          status !== "active"
            ? null
            : recentNoShows >= 2
              ? "no_shows"
              : inactive
                ? "inactive"
                : null;

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
          atRisk,
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
      // One batched slot read covers both the recent roster and lastSessionAt.
      const slotById = await slotMapFor(all);
      // Sort by createdAt desc, take 10
      const recent = [...all]
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10);

      const recentBookings = rosterEntriesFrom(recent, slotById, byId);

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
          lastSessionAt: lastSessionAtFrom(all, slotById),
          lastWeightKg: agg.lastWeightKg,
          weightTrend14d: agg.weightTrend14d,
          lastMeasurementAt: agg.lastMeasurementAt,
          attendanceRate: rate,
          // Detail view doesn't render the flag; the list computes it batched.
          atRisk: null,
        },
        recentBookings,
        attendanceRate,
        remainingEdits,
        weekBookingsCount: weekBookings.length,
      };
    },

    async getDayBookings(date: string): Promise<RosterEntry[]> {
      const slots = await store.getAllSlotsForDate(date);
      const slotById = new Map(slots.map((s) => [s.id, s]));
      const all = await store.getAllBookings();
      const dayBookings = all.filter(
        (b) => b.status === "confirmed" && slotById.has(b.slotId)
      );
      const { byId } = await traineesByStatus();
      return rosterEntriesFrom(dayBookings, slotById, byId);
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
      // Batch: one bookings scan + one slots read instead of 3 point reads/request.
      const allBookings = await store.getAllBookings();
      const bookingById = new Map(allBookings.map((b) => [b.id, b]));
      const slotIds = new Set<string>();
      for (const r of pending) {
        const booking = bookingById.get(r.bookingId);
        if (booking) slotIds.add(booking.slotId);
        if (r.requestedNewSlotId) slotIds.add(r.requestedNewSlotId);
      }
      const slots = await store.getSlotsByIds([...slotIds]);
      const slotById = new Map(slots.map((s) => [s.id, s]));

      const out: ChangeRequestEntry[] = [];
      for (const r of pending) {
        const booking = bookingById.get(r.bookingId);
        if (!booking) continue;
        const fromSlot = slotById.get(booking.slotId);
        if (!fromSlot) continue;
        const toSlot = r.requestedNewSlotId
          ? slotById.get(r.requestedNewSlotId) ?? null
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
