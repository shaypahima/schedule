import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MockBookingStore,
  BookingService,
  BookingError,
} from "@/lib/services/booking-service";
import { MockNotificationService } from "@/lib/services/notification";

describe("Concurrency - optimistic locking", () => {
  let store: MockBookingStore;
  let service: BookingService;

  beforeEach(() => {
    store = new MockBookingStore();
    service = new BookingService(store);
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

  it("concurrent last-spot bookings: one succeeds, one fails", async () => {
    // Simulate two concurrent bookings for the last spot
    const results = await Promise.allSettled([
      service.book("t1", "slot-last"),
      service.book("t2", "slot-last"),
    ]);

    const successes = results.filter((r) => r.status === "fulfilled");
    const failures = results.filter((r) => r.status === "rejected");

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const failReason = (failures[0] as PromiseRejectedResult).reason;
    expect(failReason).toBeInstanceOf(BookingError);
  });

  it("no partial booking state on conflict", async () => {
    const results = await Promise.allSettled([
      service.book("t1", "slot-last"),
      service.book("t2", "slot-last"),
    ]);

    // The slot should have exactly 2 bookings (capacity)
    const slot = store.getSlot("slot-last");
    expect(slot!.currentBookings).toBe(2);

    // Only 1 confirmed booking should exist in the store
    const confirmed = store
      .getConfirmedBookingsForSlot("slot-last")
      .filter((b) => b.status === "confirmed");
    expect(confirmed).toHaveLength(1);
  });
});

describe("Coach notifications", () => {
  let store: MockBookingStore;
  let notifier: MockNotificationService;
  let service: BookingService;

  beforeEach(() => {
    store = new MockBookingStore();
    notifier = new MockNotificationService();
    service = new BookingService(store, undefined, notifier);
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
    const booking = await service.book("t1", "slot-1");
    await service.cancel(booking.id, "t1");

    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0].type).toBe("cancel");
    expect(notifier.sent[0].slotDate).toBe("2026-04-06");
  });

  it("notifies coach on reschedule", async () => {
    const booking = await service.book("t1", "slot-1");
    await service.reschedule(booking.id, "t1", "slot-2");

    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0].type).toBe("reschedule");
    expect(notifier.sent[0].newSlotDate).toBe("2026-04-07");
  });

  it("does not notify on initial booking", async () => {
    await service.book("t1", "slot-1");
    expect(notifier.sent).toHaveLength(0);
  });
});
