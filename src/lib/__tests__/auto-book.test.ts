import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MockBookingStore,
  BookingService,
} from "@/lib/services/booking-service";
import { MockGoogleCalendarService } from "@/lib/services/mock-google-calendar";
import { autoBookRecurring, RecurringTrainee } from "@/lib/services/auto-book";

describe("Auto-book cron", () => {
  let store: MockBookingStore;
  let calendar: MockGoogleCalendarService;
  let service: BookingService;

  const recurringTrainees: RecurringTrainee[] = [
    { id: "t1", name: "Avi", preferredDay: 1, preferredTime: "10:00" }, // Mon
    { id: "t2", name: "Dana", preferredDay: 2, preferredTime: "14:00" }, // Tue
  ];

  beforeEach(() => {
    store = new MockBookingStore();
    calendar = new MockGoogleCalendarService();
    service = new BookingService(store, calendar);
    // Set time before the week to avoid lockout
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));

    // Create slots for the upcoming week (Apr 5 Sun - Apr 10 Fri)
    for (let day = 5; day <= 10; day++) {
      const date = `2026-04-${String(day).padStart(2, "0")}`;
      // Mon=6, Tue=7
      store.addSlot({
        id: `slot-${date}-10:00`,
        date,
        startTime: "10:00",
        capacity: 2,
        lockoutOverride: false,
        currentBookings: 0,
      });
      store.addSlot({
        id: `slot-${date}-14:00`,
        date,
        startTime: "14:00",
        capacity: 2,
        lockoutOverride: false,
        currentBookings: 0,
      });
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("books recurring trainees into their preferred slots", async () => {
    const results = await autoBookRecurring(
      recurringTrainees,
      service,
      store,
      "2026-04-05" // week start (Sunday)
    );

    expect(results).toHaveLength(2);
    expect(results[0].traineeId).toBe("t1");
    expect(results[0].success).toBe(true);
    expect(results[1].traineeId).toBe("t2");
    expect(results[1].success).toBe(true);
  });

  it("marks bookings as auto-booked", async () => {
    const results = await autoBookRecurring(
      recurringTrainees,
      service,
      store,
      "2026-04-05"
    );

    for (const r of results) {
      if (r.bookingId) {
        const booking = store.getBooking(r.bookingId);
        expect(booking?.isAutoBooked).toBe(true);
      }
    }
  });

  it("creates Google Calendar events", async () => {
    await autoBookRecurring(recurringTrainees, service, store, "2026-04-05");
    expect(calendar.getEvents()).toHaveLength(2);
    expect(calendar.getEvents()[0].summary).toBe("Avi");
  });

  it("skips when preferred slot is full", async () => {
    // Fill Mon 10:00 slot
    store.updateSlot({
      ...store.getSlot("slot-2026-04-06-10:00")!,
      currentBookings: 2,
    });

    const results = await autoBookRecurring(
      recurringTrainees,
      service,
      store,
      "2026-04-05"
    );

    const aviResult = results.find((r) => r.traineeId === "t1");
    expect(aviResult?.success).toBe(false);
    expect(aviResult?.reason).toContain("full");
  });

  it("skips when trainee already has 2 bookings this week", async () => {
    // Pre-book t1 into 2 slots
    await service.book("t1", "slot-2026-04-05-10:00");
    await service.book("t1", "slot-2026-04-05-14:00");

    const results = await autoBookRecurring(
      [recurringTrainees[0]],
      service,
      store,
      "2026-04-05"
    );

    expect(results[0].success).toBe(false);
    expect(results[0].reason).toContain("2 sessions");
  });

  it("auto-booked counts toward 2/week", async () => {
    await autoBookRecurring(
      [recurringTrainees[0]],
      service,
      store,
      "2026-04-05"
    );

    // Book one more manually
    await service.book("t1", "slot-2026-04-05-14:00");

    // Third should fail
    await expect(
      service.book("t1", "slot-2026-04-07-10:00")
    ).rejects.toThrow("Max 2 sessions per week");
  });

  it("does not count toward 3-edit limit", async () => {
    await autoBookRecurring(
      [recurringTrainees[0]],
      service,
      store,
      "2026-04-05"
    );

    // Edit count should still be 3 remaining
    expect(service.getRemainingEdits("t1", "2026-04-05")).toBe(3);
  });
});
