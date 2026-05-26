import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MockBookingStore } from "@/lib/services/booking-store";
import { makeBookings, Bookings } from "@/lib/services/bookings";
import { MockNotificationService } from "@/lib/services/notification";

describe("Bookings — request/decide (Phase 15)", () => {
  let store: MockBookingStore;
  let bookings: Bookings;
  let notifier: MockNotificationService;

  beforeEach(() => {
    store = new MockBookingStore();
    notifier = new MockNotificationService();
    bookings = makeBookings(store, null, notifier);
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));

    store.addSlot({
      id: "slot-mon",
      date: "2026-04-06",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    store.addSlot({
      id: "slot-tue",
      date: "2026-04-07",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function setupBooking() {
    const b = await bookings.book("t1", "slot-mon");
    if (!b.ok) throw new Error("setup failed");
    return b.booking;
  }

  describe("requestCancel", () => {
    it("creates a pending cancel request", async () => {
      const booking = await setupBooking();

      const r = await bookings.requestCancel(booking.id, "t1", "Sick");

      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.request.status).toBe("pending");
        expect(r.request.bookingId).toBe(booking.id);
        expect(r.request.requestedNewSlotId).toBeNull();
        expect(r.request.reason).toBe("Sick");
      }
    });

    it("rejects with REASON_REQUIRED for empty reason", async () => {
      const booking = await setupBooking();
      const r = await bookings.requestCancel(booking.id, "t1", "  ");
      expect(r).toMatchObject({ ok: false, error: "REASON_REQUIRED" });
    });

    it("rejects with ALREADY_REQUESTED when a pending request exists", async () => {
      const booking = await setupBooking();
      await bookings.requestCancel(booking.id, "t1", "Sick");
      const r2 = await bookings.requestCancel(booking.id, "t1", "Still sick");
      expect(r2).toMatchObject({ ok: false, error: "ALREADY_REQUESTED" });
    });

    it("rejects NOT_FOUND when booking belongs to another trainee", async () => {
      const booking = await setupBooking();
      const r = await bookings.requestCancel(booking.id, "t2", "ill");
      expect(r).toMatchObject({ ok: false, error: "NOT_FOUND" });
    });

    it("slot stays held (currentBookings unchanged) while request is pending", async () => {
      const booking = await setupBooking();
      await bookings.requestCancel(booking.id, "t1", "Sick");
      expect(store.getSlot("slot-mon")!.currentBookings).toBe(1);
    });
  });

  describe("requestReschedule", () => {
    it("creates pending reschedule request with target slot", async () => {
      const booking = await setupBooking();
      const r = await bookings.requestReschedule(booking.id, "t1", "slot-tue", "Conflict");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.request.requestedNewSlotId).toBe("slot-tue");
    });

    it("rejects when target slot doesn't exist", async () => {
      const booking = await setupBooking();
      const r = await bookings.requestReschedule(booking.id, "t1", "ghost", "any");
      expect(r).toMatchObject({ ok: false, error: "NOT_FOUND" });
    });
  });

  describe("decideRequest — approve (cancel)", () => {
    it("cancels old booking, frees slot, stamps request", async () => {
      const booking = await setupBooking();
      const reqRes = await bookings.requestCancel(booking.id, "t1", "Sick");
      if (!reqRes.ok) throw new Error("setup failed");

      const decision = await bookings.decideRequest(reqRes.request.id, "c1", "approve");

      expect(decision.ok).toBe(true);
      if (decision.ok) {
        expect(decision.request.status).toBe("approved");
        expect(decision.request.decidedBy).toBe("c1");
      }
      expect(store.getBooking(booking.id)!.status).toBe("cancelled");
      expect(store.getSlot("slot-mon")!.currentBookings).toBe(0);
    });
  });

  describe("decideRequest — approve (reschedule)", () => {
    it("cancels old booking, books new slot, stamps request", async () => {
      const booking = await setupBooking();
      const reqRes = await bookings.requestReschedule(
        booking.id,
        "t1",
        "slot-tue",
        "Conflict on Monday"
      );
      if (!reqRes.ok) throw new Error("setup failed");

      const decision = await bookings.decideRequest(reqRes.request.id, "c1", "approve");

      expect(decision.ok).toBe(true);
      if (decision.ok) {
        expect(decision.request.status).toBe("approved");
        expect(decision.effectedBooking).toBeDefined();
        expect(decision.effectedBooking!.slotId).toBe("slot-tue");
      }
      expect(store.getBooking(booking.id)!.status).toBe("cancelled");
      expect(store.getSlot("slot-mon")!.currentBookings).toBe(0);
      expect(store.getSlot("slot-tue")!.currentBookings).toBe(1);
    });
  });

  describe("decideRequest — approve (reschedule) race conditions", () => {
    it("when target slot has since filled up, request is approved but no new booking is made (trainee loses both)", async () => {
      // Trainee requests reschedule slot-mon → slot-tue
      const booking = await setupBooking();
      const reqRes = await bookings.requestReschedule(
        booking.id,
        "t1",
        "slot-tue",
        "Conflict on Monday"
      );
      if (!reqRes.ok) throw new Error("setup failed");

      // Meanwhile, slot-tue fills up to capacity (race)
      await bookings.book("t2", "slot-tue");
      await bookings.book("t3", "slot-tue");
      expect(store.getSlot("slot-tue")!.currentBookings).toBe(2);

      // Coach approves the reschedule request anyway
      const decision = await bookings.decideRequest(reqRes.request.id, "c1", "approve");

      // Documents current behaviour: request approved, old booking cancelled,
      // new booking NOT made (silently). Trainee ends up with no booking.
      // (This is a latent bug — file a follow-up issue if surprising; the
      // test locks in current behaviour so the regression is visible.)
      expect(decision.ok).toBe(true);
      if (decision.ok) {
        expect(decision.request.status).toBe("approved");
        expect(decision.effectedBooking).toBeUndefined();
      }
      expect(store.getBooking(booking.id)!.status).toBe("cancelled");
      expect(store.getSlot("slot-mon")!.currentBookings).toBe(0);
      // slot-tue is still full with t2 + t3 (not t1)
      expect(store.getSlot("slot-tue")!.currentBookings).toBe(2);
    });
  });

  describe("decideRequest — reject", () => {
    it("stamps request as rejected, leaves booking confirmed, slot stays held", async () => {
      const booking = await setupBooking();
      const reqRes = await bookings.requestCancel(booking.id, "t1", "Sick");
      if (!reqRes.ok) throw new Error("setup failed");

      const decision = await bookings.decideRequest(
        reqRes.request.id,
        "c1",
        "reject",
        "Come anyway"
      );

      expect(decision.ok).toBe(true);
      if (decision.ok) {
        expect(decision.request.status).toBe("rejected");
        expect(decision.request.decisionNote).toBe("Come anyway");
      }
      expect(store.getBooking(booking.id)!.status).toBe("confirmed");
      expect(store.getSlot("slot-mon")!.currentBookings).toBe(1);
    });
  });

  describe("decideRequest — guards", () => {
    it("rejects when request not found", async () => {
      const r = await bookings.decideRequest("nope", "c1", "approve");
      expect(r).toMatchObject({ ok: false, error: "NOT_FOUND" });
    });

    it("rejects when request not pending", async () => {
      const booking = await setupBooking();
      const reqRes = await bookings.requestCancel(booking.id, "t1", "Sick");
      if (!reqRes.ok) throw new Error("setup failed");
      await bookings.decideRequest(reqRes.request.id, "c1", "approve");

      const r2 = await bookings.decideRequest(reqRes.request.id, "c1", "approve");
      expect(r2).toMatchObject({ ok: false, error: "REQUEST_NOT_PENDING" });
    });
  });

  describe("dashboard exposure", () => {
    it("listPendingRequests returns the request once submitted", async () => {
      const booking = await setupBooking();
      await bookings.requestCancel(booking.id, "t1", "Sick");
      const pending = await store.listPendingRequests();
      expect(pending).toHaveLength(1);
    });
  });
});
