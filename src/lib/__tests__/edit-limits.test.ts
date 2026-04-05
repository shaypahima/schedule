import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MockBookingStore,
  BookingService,
  BookingError,
  getWeekStart,
} from "@/lib/services/booking-service";

describe("getWeekStart", () => {
  it("returns Sunday for a Wednesday", () => {
    // 2026-04-08 is Wednesday, week starts 2026-04-05 (Sunday)
    expect(getWeekStart("2026-04-08")).toBe("2026-04-05");
  });

  it("returns same day for a Sunday", () => {
    expect(getWeekStart("2026-04-05")).toBe("2026-04-05");
  });

  it("returns previous Sunday for a Saturday", () => {
    // 2026-04-11 is Saturday, week starts 2026-04-05
    expect(getWeekStart("2026-04-11")).toBe("2026-04-05");
  });
});

describe("Edit limits", () => {
  let store: MockBookingStore;
  let service: BookingService;

  beforeEach(() => {
    store = new MockBookingStore();
    service = new BookingService(store);
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));

    // Add slots for the same week (2026-04-05 is Sunday)
    for (let i = 5; i <= 10; i++) {
      store.addSlot({
        id: `slot-${i}`,
        date: `2026-04-${String(i).padStart(2, "0")}`,
        startTime: "10:00",
        capacity: 2,
        lockoutOverride: false,
        currentBookings: 0,
      });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows first cancel", async () => {
    const booking = await service.book("t1", "slot-5");
    await service.cancel(booking.id, "t1");
    expect(store.getBooking(booking.id)!.status).toBe("cancelled");
  });

  it("allows 3 cancels in a week", async () => {
    for (let i = 5; i <= 7; i++) {
      const b = await service.book("t1", `slot-${i}`);
      await service.cancel(b.id, "t1");
    }
    // All 3 should succeed
    expect(service.getRemainingEdits("t1", "2026-04-05")).toBe(0);
  });

  it("blocks 4th cancel in same week", async () => {
    for (let i = 5; i <= 7; i++) {
      const b = await service.book("t1", `slot-${i}`);
      await service.cancel(b.id, "t1");
    }
    const b4 = await service.book("t1", "slot-8");
    await expect(service.cancel(b4.id, "t1")).rejects.toThrow("Edit limit reached");
  });

  it("auto-booked cancel is exempt from edit limit", async () => {
    // Exhaust edit limit
    for (let i = 5; i <= 7; i++) {
      const b = await service.book("t1", `slot-${i}`);
      await service.cancel(b.id, "t1");
    }

    // Create auto-booked booking directly in store
    const autoBooking = {
      id: "auto-1",
      slotId: "slot-8",
      traineeId: "t1",
      googleEventId: null,
      isAutoBooked: true,
      status: "confirmed" as const,
      createdAt: new Date(),
    };
    store.addBooking(autoBooking);
    store.updateSlot({ ...store.getSlot("slot-8")!, currentBookings: 1 });

    // Should succeed despite limit reached
    await service.cancel("auto-1", "t1");
    expect(store.getBooking("auto-1")!.status).toBe("cancelled");
  });

  it("getRemainingEdits returns correct count", () => {
    expect(service.getRemainingEdits("t1", "2026-04-05")).toBe(3);
  });
});

describe("Reschedule", () => {
  let store: MockBookingStore;
  let service: BookingService;

  beforeEach(() => {
    store = new MockBookingStore();
    service = new BookingService(store);
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));

    store.addSlot({
      id: "slot-old",
      date: "2026-04-06",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    store.addSlot({
      id: "slot-new",
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

  it("reschedule cancels old and books new", async () => {
    const old = await service.book("t1", "slot-old");
    const newBooking = await service.reschedule(old.id, "t1", "slot-new");

    expect(store.getBooking(old.id)!.status).toBe("cancelled");
    expect(newBooking.slotId).toBe("slot-new");
    expect(newBooking.status).toBe("confirmed");
  });

  it("reschedule counts as 1 edit, not 2", async () => {
    const old = await service.book("t1", "slot-old");
    await service.reschedule(old.id, "t1", "slot-new");

    expect(service.getRemainingEdits("t1", "2026-04-05")).toBe(2);
  });

  it("reschedule fails if edit limit reached", async () => {
    // Use up 3 edits
    for (let i = 0; i < 3; i++) {
      store.addSlot({
        id: `temp-${i}`,
        date: "2026-04-06",
        startTime: `${10 + i}:00`,
        capacity: 2,
        lockoutOverride: false,
        currentBookings: 0,
      });
      const b = await service.book("t1", `temp-${i}`);
      await service.cancel(b.id, "t1");
    }

    const booking = await service.book("t1", "slot-old");
    await expect(
      service.reschedule(booking.id, "t1", "slot-new")
    ).rejects.toThrow("Edit limit reached");
    // Old booking should still be confirmed (atomic — no partial state)
    expect(store.getBooking(booking.id)!.status).toBe("confirmed");
  });

  it("reschedule fails if new slot is full", async () => {
    store.updateSlot({ ...store.getSlot("slot-new")!, currentBookings: 2 });
    const old = await service.book("t1", "slot-old");

    await expect(
      service.reschedule(old.id, "t1", "slot-new")
    ).rejects.toThrow("Slot is full");
  });
});
