import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MockBookingStore } from "@/lib/services/booking-store";
import { makeBookings, Bookings } from "@/lib/services/bookings";
import { MockNotificationService } from "@/lib/services/notification";

describe("Concurrency - optimistic locking", () => {
  let store: MockBookingStore;
  let bookings: Bookings;

  beforeEach(() => {
    store = new MockBookingStore();
    bookings = makeBookings(store, null, null);
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));

    store.addSlot({
      id: "slot-last",
      date: "2026-04-06",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 1, // 1 spot left
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("concurrent last-spot bookings: one succeeds, one returns CONFLICT or SLOT_FULL", async () => {
    const results = await Promise.all([
      bookings.book("t1", "slot-last"),
      bookings.book("t2", "slot-last"),
    ]);

    const successes = results.filter((r) => r.ok);
    const failures = results.filter((r) => !r.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    if (!failures[0].ok) {
      expect(["CONFLICT", "SLOT_FULL"]).toContain(failures[0].error);
    }
  });

  it("no partial booking state on conflict", async () => {
    await Promise.all([
      bookings.book("t1", "slot-last"),
      bookings.book("t2", "slot-last"),
    ]);

    const slot = store.getSlot("slot-last");
    expect(slot!.currentBookings).toBe(2);

    const confirmed = store
      .getConfirmedBookingsForSlot("slot-last")
      .filter((b) => b.status === "confirmed");
    expect(confirmed).toHaveLength(1);
  });
});

describe("Coach notifications", () => {
  let store: MockBookingStore;
  let notifier: MockNotificationService;
  let bookings: Bookings;

  beforeEach(() => {
    store = new MockBookingStore();
    notifier = new MockNotificationService();
    bookings = makeBookings(store, null, notifier);
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));

    store.addSlot({
      id: "slot-1",
      date: "2026-04-06",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    store.addSlot({
      id: "slot-2",
      date: "2026-04-07",
      startTime: "14:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("notifies coach on cancel", async () => {
    const b = await bookings.book("t1", "slot-1");
    if (!b.ok) throw new Error("Setup failed");
    await bookings.cancel(b.booking.id, "t1");

    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0].type).toBe("cancel");
    expect(notifier.sent[0].slotDate).toBe("2026-04-06");
  });

  it("notifies coach on reschedule", async () => {
    const b = await bookings.book("t1", "slot-1");
    if (!b.ok) throw new Error("Setup failed");
    await bookings.reschedule(b.booking.id, "t1", "slot-2");

    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0].type).toBe("reschedule");
    expect(notifier.sent[0].newSlotDate).toBe("2026-04-07");
  });

  it("does not notify on initial booking", async () => {
    await bookings.book("t1", "slot-1");
    expect(notifier.sent).toHaveLength(0);
  });
});
