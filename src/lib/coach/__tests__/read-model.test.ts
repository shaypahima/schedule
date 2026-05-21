import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MockBookingStore } from "@/lib/services/booking-store";
import { makeBookings } from "@/lib/services/bookings";
import { MockAuthService } from "@/lib/supabase/auth-service";
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
  reminderSentAt: null as never,
} as Profile;

describe("CoachReadModel", () => {
  let store: MockBookingStore;
  let auth: MockAuthService;
  let bookings: ReturnType<typeof makeBookings>;
  let coachRead: ReturnType<typeof makeCoachReadModel>;

  beforeEach(() => {
    store = new MockBookingStore();
    auth = new MockAuthService();
    bookings = makeBookings(store, null, null);
    coachRead = makeCoachReadModel(store, auth, bookings);

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
