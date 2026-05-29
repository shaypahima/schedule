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
