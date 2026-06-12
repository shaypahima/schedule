import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MockBookingStore } from "@/lib/services/booking-store";
import { makeBookings } from "@/lib/services/bookings";
import { MockAuthService } from "@/lib/supabase/auth-service";
import { MockProgressStore } from "@/lib/services/progress-store";
import { makeCoachReadModel } from "../mock-read-model";
import { Profile } from "@/lib/types";

const trainee: Profile = {
  id: "t1",
  name: "Yael",
  role: "trainee",
  isRecurring: false,
  preferredDay: null,
  preferredTime: null,
  isActive: true,
  createdAt: new Date("2026-01-01"),
} as Profile;

describe("CoachReadModel", () => {
  let store: MockBookingStore;
  let auth: MockAuthService;
  let bookings: ReturnType<typeof makeBookings>;
  let progress: MockProgressStore;
  let coachRead: ReturnType<typeof makeCoachReadModel>;

  beforeEach(() => {
    store = new MockBookingStore();
    auth = new MockAuthService();
    bookings = makeBookings(store, null, null);
    progress = new MockProgressStore();
    coachRead = makeCoachReadModel(store, auth, bookings, progress);

    vi.setSystemTime(new Date("2026-04-06T08:00:00Z"));
    auth._seedTrainee({ ...trainee, id: "t1", name: "Yael" });
    auth._seedTrainee({ ...trainee, id: "t2", name: "Avi" });

    store.addSlot({
      id: "slot-a",
      date: "2026-04-06",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getDayBookings", () => {
    it("returns confirmed bookings for the date with trainee names + slot times", async () => {
      const b = await bookings.book("t1", "slot-a", { bypass: true });
      if (!b.ok) throw new Error("setup failed");

      const roster = await coachRead.getDayBookings("2026-04-06");

      expect(roster).toHaveLength(1);
      expect(roster[0]).toMatchObject({
        bookingId: b.booking.id,
        trainee: { id: "t1", name: "Yael" },
        slotDate: "2026-04-06",
        slotTime: "10:00",
        status: "confirmed",
      });
    });

    it("returns [] for a date with no slots", async () => {
      const roster = await coachRead.getDayBookings("2026-04-10");
      expect(roster).toEqual([]);
    });
  });

  describe("getCoachDashboard — monthly overview (#84)", () => {
    function addSlot(id: string, date: string, time = "10:00") {
      store.addSlot({
        id,
        date,
        startTime: time,
        capacity: 2,
        lockoutOverride: false,
        currentBookings: 0,
      });
    }

    it("aggregates the current calendar month and deltas vs the previous", async () => {
      // now = 2026-04-06. April: 2 held (1 attended t1, 1 attended t2) + 1 no-show.
      addSlot("apr-1", "2026-04-01");
      addSlot("apr-2", "2026-04-02");
      addSlot("apr-3", "2026-04-03");
      addSlot("apr-future", "2026-04-25"); // upcoming — must not count as held
      // March: 1 held, 0 no-shows.
      addSlot("mar-1", "2026-03-10");

      await bookings.book("t1", "apr-1", { bypass: true });
      await bookings.book("t2", "apr-2", { bypass: true });
      const ns = await bookings.book("t1", "apr-3", { bypass: true });
      await bookings.book("t1", "apr-future", { bypass: true });
      await bookings.book("t1", "mar-1", { bypass: true });
      if (!ns.ok) throw new Error("setup failed");
      await bookings.markNoShow(ns.booking.id);

      const view = await coachRead.getCoachDashboard();
      expect(view.monthly).toEqual({
        sessionsHeld: 2,
        noShows: 1,
        attendanceRate: 2 / 3,
        activeTrainees: 2, // t1 + t2 trained in April
        prev: {
          sessionsHeld: 1,
          noShows: 0,
          attendanceRate: 1,
          activeTrainees: 1,
        },
      });
    });

    it("prev is null when the previous month had no sessions", async () => {
      addSlot("apr-1", "2026-04-01");
      await bookings.book("t1", "apr-1", { bypass: true });

      const view = await coachRead.getCoachDashboard();
      expect(view.monthly.sessionsHeld).toBe(1);
      expect(view.monthly.prev).toBeNull();
    });

    it("an empty current month still reports zeros", async () => {
      const view = await coachRead.getCoachDashboard();
      expect(view.monthly).toMatchObject({
        sessionsHeld: 0,
        noShows: 0,
        attendanceRate: null,
        activeTrainees: 0,
      });
    });
  });

  describe("getTraineesList — at-risk flags (#83)", () => {
    const get = async (id: string) =>
      (await coachRead.getTraineesList()).find((t) => t.id === id)!;

    function addPastSlot(id: string, date: string) {
      store.addSlot({
        id,
        date,
        startTime: "10:00",
        capacity: 2,
        lockoutOverride: false,
        currentBookings: 0,
      });
    }

    it("flags inactive when last session is 14+ days ago and nothing upcoming", async () => {
      // now = 2026-04-06. Last session 2026-03-20 (17 days ago).
      addPastSlot("slot-old", "2026-03-20");
      await bookings.book("t1", "slot-old", { bypass: true });

      expect((await get("t1")).atRisk).toBe("inactive");
    });

    it("does not flag when a session happened within 14 days", async () => {
      addPastSlot("slot-recent", "2026-03-30"); // 7 days ago
      await bookings.book("t1", "slot-recent", { bypass: true });

      expect((await get("t1")).atRisk).toBeNull();
    });

    it("an upcoming booking clears the inactive flag — they re-engaged", async () => {
      addPastSlot("slot-old", "2026-03-01");
      addPastSlot("slot-future", "2026-04-20");
      await bookings.book("t1", "slot-old", { bypass: true });
      await bookings.book("t1", "slot-future", { bypass: true });

      expect((await get("t1")).atRisk).toBeNull();
    });

    it("flags no_shows at 2+ no-shows within 4 weeks (boundary: exactly 2)", async () => {
      addPastSlot("slot-ns1", "2026-03-25");
      addPastSlot("slot-ns2", "2026-04-01");
      addPastSlot("slot-future", "2026-04-20"); // upcoming — must NOT mask no-shows
      const b1 = await bookings.book("t1", "slot-ns1", { bypass: true });
      const b2 = await bookings.book("t1", "slot-ns2", { bypass: true });
      await bookings.book("t1", "slot-future", { bypass: true });
      if (!b1.ok || !b2.ok) throw new Error("setup failed");
      await bookings.markNoShow(b1.booking.id);
      await bookings.markNoShow(b2.booking.id);

      expect((await get("t1")).atRisk).toBe("no_shows");
    });

    it("a single no-show within 4 weeks does not flag", async () => {
      addPastSlot("slot-ns1", "2026-04-01");
      addPastSlot("slot-recent", "2026-04-03");
      const b1 = await bookings.book("t1", "slot-ns1", { bypass: true });
      await bookings.book("t1", "slot-recent", { bypass: true });
      if (!b1.ok) throw new Error("setup failed");
      await bookings.markNoShow(b1.booking.id);

      expect((await get("t1")).atRisk).toBeNull();
    });

    it("old no-shows (>4 weeks) do not count", async () => {
      addPastSlot("slot-ns1", "2026-02-01");
      addPastSlot("slot-ns2", "2026-02-08");
      addPastSlot("slot-recent", "2026-04-03");
      const b1 = await bookings.book("t1", "slot-ns1", { bypass: true });
      const b2 = await bookings.book("t1", "slot-ns2", { bypass: true });
      await bookings.book("t1", "slot-recent", { bypass: true });
      if (!b1.ok || !b2.ok) throw new Error("setup failed");
      await bookings.markNoShow(b1.booking.id);
      await bookings.markNoShow(b2.booking.id);

      expect((await get("t1")).atRisk).toBeNull();
    });
  });

  describe("getTraineesList", () => {
    it("returns all seeded trainees by default", async () => {
      const list = await coachRead.getTraineesList();
      expect(list.map((t) => t.id).sort()).toEqual(["t1", "t2"]);
    });

    it("filters unbooked-this-week", async () => {
      await bookings.book("t1", "slot-a", { bypass: true });

      const list = await coachRead.getTraineesList("unbooked-this-week");
      expect(list.map((t) => t.id)).toEqual(["t2"]);
    });
  });

  describe("getTraineesList — progress aggregates", () => {
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
    const get = async (id: string) =>
      (await coachRead.getTraineesList()).find((t) => t.id === id)!;

    it("reports weightTrend14d 'down' + lastWeightKg when newest is >=0.5kg below a >=14d-older point", async () => {
      await progress.createMeasurement("t1", { weightKg: 70, loggedAt: daysAgo(20) });
      await progress.createMeasurement("t1", { weightKg: 68, loggedAt: daysAgo(1) });

      const t1 = await get("t1");
      expect(t1.weightTrend14d).toBe("down");
      expect(t1.lastWeightKg).toBe(68);
    });

    it("reports weightTrend14d 'up' when newest is >=0.5kg above a >=14d-older point", async () => {
      await progress.createMeasurement("t1", { weightKg: 68, loggedAt: daysAgo(20) });
      await progress.createMeasurement("t1", { weightKg: 70, loggedAt: daysAgo(1) });

      expect((await get("t1")).weightTrend14d).toBe("up");
    });

    it("reports weightTrend14d 'flat' when |delta| < 0.5kg", async () => {
      await progress.createMeasurement("t1", { weightKg: 70.0, loggedAt: daysAgo(20) });
      await progress.createMeasurement("t1", { weightKg: 70.3, loggedAt: daysAgo(1) });

      expect((await get("t1")).weightTrend14d).toBe("flat");
    });

    it("reports null trend with a single weight point (lastWeightKg still set)", async () => {
      await progress.createMeasurement("t1", { weightKg: 70, loggedAt: daysAgo(1) });

      const t1 = await get("t1");
      expect(t1.weightTrend14d).toBeNull();
      expect(t1.lastWeightKg).toBe(70);
    });

    it("reports null trend when no point is >=14d older than the newest", async () => {
      await progress.createMeasurement("t1", { weightKg: 70, loggedAt: daysAgo(5) });
      await progress.createMeasurement("t1", { weightKg: 71, loggedAt: daysAgo(1) });

      const t1 = await get("t1");
      expect(t1.weightTrend14d).toBeNull();
      expect(t1.lastWeightKg).toBe(71);
    });

    it("lastMeasurementAt reflects the newest measurement even when its weight is null", async () => {
      await progress.createMeasurement("t1", { weightKg: 70, loggedAt: daysAgo(20) });
      const noteOnly = daysAgo(1);
      await progress.createMeasurement("t1", { note: "felt good", loggedAt: noteOnly });

      const t1 = await get("t1");
      expect(t1.lastWeightKg).toBe(70);
      expect(t1.lastMeasurementAt).toBe(noteOnly.toISOString());
    });

    it("reports null aggregates for a trainee with no measurements", async () => {
      const t2 = await get("t2");
      expect(t2.lastWeightKg).toBeNull();
      expect(t2.weightTrend14d).toBeNull();
      expect(t2.lastMeasurementAt).toBeNull();
    });

    it("attendanceRate is null with no past bookings", async () => {
      expect((await get("t1")).attendanceRate).toBeNull();
    });

    it("attendanceRate is 1.0 for a past confirmed booking", async () => {
      // slot-a is at 2026-04-06 10:00 IL; advance the clock past it.
      await bookings.book("t1", "slot-a", { bypass: true });
      vi.setSystemTime(new Date("2026-04-07T08:00:00Z"));

      expect((await get("t1")).attendanceRate).toBe(1);
      // no_show path stays untestable until Phase 16 wires the terminal state.
    });
  });

  describe("getTraineeDetail", () => {
    it("returns trainee with recent bookings + remainingEdits (now Infinity post-edit-limit-removal)", async () => {
      await bookings.book("t1", "slot-a", { bypass: true });

      const detail = await coachRead.getTraineeDetail("t1");

      expect(detail).not.toBeNull();
      expect(detail!.trainee.id).toBe("t1");
      expect(detail!.recentBookings).toHaveLength(1);
      expect(detail!.remainingEdits).toBe(Number.POSITIVE_INFINITY);
      expect(detail!.weekBookingsCount).toBe(1);
    });

    it("returns null for unknown trainee", async () => {
      const detail = await coachRead.getTraineeDetail("ghost");
      expect(detail).toBeNull();
    });

    it("carries progress aggregates on the trainee summary", async () => {
      await progress.createMeasurement("t1", {
        weightKg: 69,
        loggedAt: new Date(Date.now() - 86_400_000),
      });

      const detail = await coachRead.getTraineeDetail("t1");
      expect(detail!.trainee.lastWeightKg).toBe(69);
      expect(detail!.trainee.lastMeasurementAt).not.toBeNull();
    });
  });

  describe("getCoachDashboard", () => {
    it("returns dashboard view with stubs at 0", async () => {
      const view = await coachRead.getCoachDashboard();
      expect(view.pendingChangeRequests).toBe(0);
      expect(view.noShowsThisWeek).toBe(0);
      expect(view.urgentRequests).toEqual([]);
      // pendingApprovals + todayRoster populated from real data
      expect(typeof view.pendingApprovals).toBe("number");
      expect(Array.isArray(view.todayRoster)).toBe(true);
    });
  });

  describe("getPendingChangeRequests", () => {
    it("returns [] (Phase 15 wires the table)", async () => {
      expect(await coachRead.getPendingChangeRequests()).toEqual([]);
    });
  });
});
