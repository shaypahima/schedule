import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MockBookingStore } from "@/lib/services/booking-store";
import { MockGoogleCalendarService } from "@/lib/services/mock-google-calendar";
import { autoBookRecurring, RecurringTrainee } from "@/lib/services/auto-book";
import { makeBookings } from "@/lib/services/bookings";

describe("Auto-book cron", () => {
  let store: MockBookingStore;
  let calendar: MockGoogleCalendarService;

  const recurringTrainees: RecurringTrainee[] = [
    { id: "t1", name: "Avi", preferredDay: 1, preferredTime: "10:00" }, // Mon
    { id: "t2", name: "Dana", preferredDay: 2, preferredTime: "14:00" }, // Tue
  ];

  function buildBookings() {
    return makeBookings(store, calendar, null);
  }

  beforeEach(() => {
    store = new MockBookingStore();
    calendar = new MockGoogleCalendarService();
    // Set time before the week to avoid lockout
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));

    // Create slots for the upcoming week (Apr 5 Sun - Apr 10 Fri)
    for (let day = 5; day <= 10; day++) {
      const date = `2026-04-${String(day).padStart(2, "0")}`;
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
    const bookings = buildBookings();
    const results = await autoBookRecurring(
      recurringTrainees, bookings, store,
      "2026-04-05"
    );

    expect(results).toHaveLength(2);
    expect(results[0].traineeId).toBe("t1");
    expect(results[0].success).toBe(true);
    expect(results[1].traineeId).toBe("t2");
    expect(results[1].success).toBe(true);
  });

  it("marks bookings as auto-booked", async () => {
    const bookings = buildBookings();
    const results = await autoBookRecurring(
      recurringTrainees, bookings, store,
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
    const bookings = buildBookings();
    await autoBookRecurring(recurringTrainees, bookings, store, "2026-04-05");
    expect(calendar.getEvents()).toHaveLength(2);
    expect(calendar.getEvents()[0].summary).toBe("Avi");
  });

  it("skips when preferred slot is full", async () => {
    store.updateSlot({
      ...store.getSlot("slot-2026-04-06-10:00")!,
      currentBookings: 2,
    });

    const bookings = buildBookings();
    const results = await autoBookRecurring(
      recurringTrainees, bookings, store,
      "2026-04-05"
    );

    const aviResult = results.find((r) => r.traineeId === "t1");
    expect(aviResult?.success).toBe(false);
    expect(aviResult?.reason).toContain("full");
  });

  it("skips when trainee already has 2 bookings this week", async () => {
    const bookings = buildBookings();
    // Pre-book t1 into 2 slots via tx
    await bookings.book("t1", "slot-2026-04-05-10:00", { bypass: true });
    await bookings.book("t1", "slot-2026-04-05-14:00", { bypass: true });

    const results = await autoBookRecurring(
      [recurringTrainees[0]], bookings, store,
      "2026-04-05"
    );

    expect(results[0].success).toBe(false);
    expect(results[0].reason).toContain("2 sessions");
  });

  it("auto-booked counts toward 2/week", async () => {
    const bookings = buildBookings();
    await autoBookRecurring(
      [recurringTrainees[0]], bookings, store,
      "2026-04-05"
    );

    // Book one more manually (no bypass)
    const r2 = await bookings.book("t1", "slot-2026-04-05-14:00", { traineeName: "Avi" });
    expect(r2.ok).toBe(true);

    // Third should fail due to weekly limit
    const r3 = await bookings.book("t1", "slot-2026-04-07-10:00", { traineeName: "Avi" });
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.error).toBe("WEEKLY_LIMIT");
  });

  it("does not count toward 3-edit limit", async () => {
    const bookings = buildBookings();
    await autoBookRecurring(
      [recurringTrainees[0]], bookings, store,
      "2026-04-05"
    );

    // Edit count should still be 3 remaining
    expect(await bookings.getRemainingEdits("t1", "2026-04-05")).toBe(3);
  });
});
