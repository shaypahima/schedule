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
import { loadProfile } from "@/lib/auth/profile-repo";
import { Profile } from "@/lib/types";
import { todayIL, weekStartForDate, israelSlotToUTC } from "@/lib/services/israel-time";

/**
 * Composes BookingStore + AuthService + Bookings into the read-model.
 * Same impl works for both MockBookingStore (tests) and SupabaseBookingStore.
 * A production impl could replace this with hand-written SQL for better N+1
 * behavior, but the composition is correct and good enough for now.
 */
export function makeCoachReadModel(
  store: BookingStore,
  auth: AuthService,
  bookings: Bookings
): CoachReadModel {
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
    const t = byId.get(traineeId);
    return {
      bookingId,
      slotId,
      startsAt: israelSlotToUTC(slot.date, slot.startTime).toISOString(),
      slotDate: slot.date,
      slotTime: slot.startTime,
      trainee: { id: traineeId, name: t?.name ?? "" },
      status,
      isAutoBooked,
    };
  }

  async function pendingApprovalsCount(): Promise<number> {
    const trainees = await auth.getTrainees();
    return trainees.filter(
      (t) => (t as Profile & { status?: string }).status === "pending"
    ).length;
  }

  return {
    async getCoachDashboard(): Promise<DashboardView> {
      const today = todayIL();
      const todayRoster = await this.getDayBookings(today);
      const pendingRequests = await this.getPendingChangeRequests();
      return {
        pendingApprovals: await pendingApprovalsCount(),
        pendingChangeRequests: pendingRequests.length,
        noShowsThisWeek: 0,
        todayRoster,
        urgentRequests: pendingRequests.slice(0, 3),
      };
    },

    async getTraineesList(filter: TraineesFilter = "all"): Promise<TraineeSummary[]> {
      const { trainees } = await traineesByStatus();
      const today = todayIL();
      const weekStart = weekStartForDate(today);

      const summaries: TraineeSummary[] = [];
      for (const t of trainees) {
        const tt = t as Profile & { status?: string; email?: string };
        const status = (tt.status as TraineeSummary["status"] | undefined) ??
          (t.isActive ? "active" : "deactivated");

        if (filter === "pending" && status !== "pending") continue;
        if (filter === "active" && status !== "active") continue;

        const weekBookings = await store.getTraineeBookingsForWeek(t.id, weekStart);
        const bookedThisWeek = weekBookings.length > 0;

        if (filter === "unbooked-this-week" && (bookedThisWeek || !t.isActive)) continue;

        summaries.push({
          id: t.id,
          name: t.name,
          email: tt.email ?? null,
          status,
          isRecurring: t.isRecurring,
          preferredDay: t.preferredDay,
          preferredTime: t.preferredTime,
          bookedThisWeek,
          lastSessionAt: await lastSessionAt(t.id),
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
      // wires `no_show`, attendanceRate is always 1.0 for trainees with past bookings.
      const now = Date.now();
      const pastConfirmed = recentBookings.filter(
        (e) =>
          e.status === "confirmed" &&
          israelSlotToUTC(e.slotDate, e.slotTime).getTime() < now
      ).length;
      const noShows = recentBookings.filter((e) => e.status === "no_show").length;
      const attendanceRate =
        pastConfirmed + noShows > 0 ? pastConfirmed / (pastConfirmed + noShows) : 1;

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
