import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MockBookingStore,
  BookingService,
} from "@/lib/services/booking-service";

describe("2/week booking limit", () => {
  let store: MockBookingStore;
  let service: BookingService;

  beforeEach(() => {
    store = new MockBookingStore();
    service = new BookingService(store);

    // Set time well before all slots to avoid lockout
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));

    // Slots in same week (Sun 2026-04-05 through Fri 2026-04-10)
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

  it("allows first booking", async () => {
    const b = await service.book("t1", "slot-5");
    expect(b.status).toBe("confirmed");
  });

  it("allows second booking same week", async () => {
    await service.book("t1", "slot-5");
    const b2 = await service.book("t1", "slot-6");
    expect(b2.status).toBe("confirmed");
  });

  it("blocks third booking same week", async () => {
    await service.book("t1", "slot-5");
    await service.book("t1", "slot-6");
    await expect(service.book("t1", "slot-7")).rejects.toThrow(
      "Max 2 sessions per week"
    );
  });

  it("auto-booked sessions count toward 2/week limit", async () => {
    // Add two auto-booked directly
    for (let i = 0; i < 2; i++) {
      store.addBooking({
        id: `auto-${i}`,
        slotId: `slot-${5 + i}`,
        traineeId: "t1",
        googleEventId: null,
        isAutoBooked: true,
        status: "confirmed",
        createdAt: new Date(),
      });
      store.updateSlot({
        ...store.getSlot(`slot-${5 + i}`)!,
        currentBookings: 1,
      });
    }

    await expect(service.book("t1", "slot-7")).rejects.toThrow(
      "Max 2 sessions per week"
    );
  });

  it("allows booking in different week", async () => {
    await service.book("t1", "slot-5");
    await service.book("t1", "slot-6");

    // Add slot in next week
    store.addSlot({
      id: "slot-next-week",
      date: "2026-04-12", // Sunday of next week
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });

    const b = await service.book("t1", "slot-next-week");
    expect(b.status).toBe("confirmed");
  });

  it("cancelled booking frees up toward limit", async () => {
    const b1 = await service.book("t1", "slot-5");
    await service.book("t1", "slot-6");
    await service.cancel(b1.id, "t1");
    // Now should allow a 3rd booking since one was cancelled
    const b3 = await service.book("t1", "slot-7");
    expect(b3.status).toBe("confirmed");
  });
});

describe("7-hour lockout", () => {
  let store: MockBookingStore;
  let service: BookingService;

  beforeEach(() => {
    store = new MockBookingStore();
    service = new BookingService(store);
  });

  it("allows booking more than 7 hours before session", async () => {
    // Session at 2026-04-06 17:00 Israel time
    store.addSlot({
      id: "slot-future",
      date: "2026-04-06",
      startTime: "17:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });

    // Mock "now" to 2026-04-06 09:59 Israel (7h01m before)
    vi.setSystemTime(new Date("2026-04-06T06:59:00Z")); // 09:59 Israel

    const b = await service.book("t1", "slot-future");
    expect(b.status).toBe("confirmed");

    vi.useRealTimers();
  });

  it("blocks booking within 7 hours of session", async () => {
    store.addSlot({
      id: "slot-soon",
      date: "2026-04-06",
      startTime: "17:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });

    // Mock "now" to 2026-04-06 10:01 Israel (6h59m before)
    vi.setSystemTime(new Date("2026-04-06T07:01:00Z")); // 10:01 Israel

    await expect(service.book("t1", "slot-soon")).rejects.toThrow(
      "within 7 hours"
    );

    vi.useRealTimers();
  });

  it("blocks cancel within 7 hours of session", async () => {
    store.addSlot({
      id: "slot-locked",
      date: "2026-04-06",
      startTime: "17:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });

    // Book well in advance
    vi.setSystemTime(new Date("2026-04-05T06:00:00Z")); // day before
    const b = await service.book("t1", "slot-locked");

    // Try cancel within lockout
    vi.setSystemTime(new Date("2026-04-06T11:00:00Z")); // 14:00 Israel, 3h before
    await expect(service.cancel(b.id, "t1")).rejects.toThrow("within 7 hours");

    vi.useRealTimers();
  });

  it("blocks reschedule within 7 hours of old session", async () => {
    store.addSlot({
      id: "slot-old",
      date: "2026-04-06",
      startTime: "17:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    store.addSlot({
      id: "slot-new",
      date: "2026-04-08",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });

    vi.setSystemTime(new Date("2026-04-05T06:00:00Z"));
    const b = await service.book("t1", "slot-old");

    vi.setSystemTime(new Date("2026-04-06T11:00:00Z")); // within lockout
    await expect(
      service.reschedule(b.id, "t1", "slot-new")
    ).rejects.toThrow("within 7 hours");

    vi.useRealTimers();
  });

  it("allows action exactly at 7 hours before", async () => {
    store.addSlot({
      id: "slot-edge",
      date: "2026-04-06",
      startTime: "17:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });

    // Exactly 7 hours before = 10:00 Israel = 07:00 UTC
    vi.setSystemTime(new Date("2026-04-06T07:00:00Z"));

    const b = await service.book("t1", "slot-edge");
    expect(b.status).toBe("confirmed");

    vi.useRealTimers();
  });

  it("lockoutOverride bypasses lockout", async () => {
    store.addSlot({
      id: "slot-override",
      date: "2026-04-06",
      startTime: "17:00",
      capacity: 2,
      lockoutOverride: true,
      currentBookings: 0,
    });

    vi.setSystemTime(new Date("2026-04-06T13:00:00Z")); // 1h before
    const b = await service.book("t1", "slot-override");
    expect(b.status).toBe("confirmed");

    vi.useRealTimers();
  });
});
