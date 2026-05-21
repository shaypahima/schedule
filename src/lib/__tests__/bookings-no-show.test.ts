import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MockBookingStore } from "@/lib/services/booking-store";
import { makeBookings, Bookings } from "@/lib/services/bookings";

describe("Bookings — markNoShow (Phase 16)", () => {
  let store: MockBookingStore;
  let bookings: Bookings;

  beforeEach(() => {
    store = new MockBookingStore();
    bookings = makeBookings(store, null, null);
    // Set "now" to AFTER the slot date so we can mark no-show
    vi.setSystemTime(new Date("2026-04-08T06:00:00Z"));

    store.addSlot({
      id: "slot-past",
      date: "2026-04-06",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    store.addSlot({
      id: "slot-future",
      date: "2026-04-20",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flips a past confirmed booking to no_show", async () => {
    const b = await bookings.book("t1", "slot-past", { bypass: true });
    if (!b.ok) throw new Error("setup failed");

    const r = await bookings.markNoShow(b.booking.id);

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.booking.status).toBe("no_show");
    expect(store.getBooking(b.booking.id)!.status).toBe("no_show");
  });

  it("rejects marking a future slot as no-show", async () => {
    const b = await bookings.book("t1", "slot-future", { bypass: true });
    if (!b.ok) throw new Error("setup failed");

    const r = await bookings.markNoShow(b.booking.id);

    expect(r).toMatchObject({ ok: false, error: "CONFLICT" });
    expect(store.getBooking(b.booking.id)!.status).toBe("confirmed");
  });

  it("rejects when booking is already cancelled", async () => {
    const b = await bookings.book("t1", "slot-past", { bypass: true });
    if (!b.ok) throw new Error("setup failed");
    store.updateBooking({ ...b.booking, status: "cancelled" });

    const r = await bookings.markNoShow(b.booking.id);

    expect(r).toMatchObject({ ok: false, error: "NOT_FOUND" });
  });

  it("rejects when booking does not exist", async () => {
    const r = await bookings.markNoShow("ghost");
    expect(r).toMatchObject({ ok: false, error: "NOT_FOUND" });
  });
});
