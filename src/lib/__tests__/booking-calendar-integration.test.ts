import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MockBookingStore,
  BookingService,
} from "@/lib/services/booking-service";
import { MockGoogleCalendarService } from "@/lib/services/mock-google-calendar";

describe("BookingService with calendar write-back", () => {
  let store: MockBookingStore;
  let calendar: MockGoogleCalendarService;
  let service: BookingService;

  beforeEach(() => {
    store = new MockBookingStore();
    calendar = new MockGoogleCalendarService();
    service = new BookingService(store, calendar);
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));

    store.addSlot({
      id: "slot-1",
      date: "2026-04-05",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("book with calendar", () => {
    it("creates a Google Calendar event on booking", async () => {
      const booking = await service.book("trainee-001", "slot-1", "Alice");
      expect(booking.googleEventId).toBeTruthy();
      expect(calendar.getEvents()).toHaveLength(1);
    });

    it("event has trainee name as summary", async () => {
      await service.book("trainee-001", "slot-1", "Alice");
      const events = calendar.getEvents();
      expect(events[0].summary).toBe("Alice");
    });

    it("event is 60 minutes at correct time", async () => {
      await service.book("trainee-001", "slot-1", "Alice");
      const event = calendar.getEvents()[0];
      const diffMs = event.end.getTime() - event.start.getTime();
      expect(diffMs).toBe(60 * 60 * 1000);
    });

    it("stores google_event_id on booking record", async () => {
      const booking = await service.book("trainee-001", "slot-1", "Alice");
      const stored = store.getBooking(booking.id);
      expect(stored!.googleEventId).toBe(booking.googleEventId);
    });

    it("still works without calendar service (no write-back)", async () => {
      const serviceNoCalendar = new BookingService(store);
      const booking = await serviceNoCalendar.book("trainee-001", "slot-1");
      expect(booking.googleEventId).toBeNull();
    });
  });

  describe("cancel with calendar", () => {
    it("deletes Google Calendar event on cancel", async () => {
      const booking = await service.book("trainee-001", "slot-1", "Alice");
      expect(calendar.getEvents()).toHaveLength(1);

      await service.cancel(booking.id, "trainee-001");
      expect(calendar.getEvents()).toHaveLength(0);
    });

    it("cancel works even if no google event id", async () => {
      const serviceNoCalendar = new BookingService(store);
      const booking = await serviceNoCalendar.book("trainee-001", "slot-1");
      // Now cancel with calendar-enabled service - should not throw
      const serviceWithCalendar = new BookingService(store, calendar);
      await serviceWithCalendar.cancel(booking.id, "trainee-001");
      expect(store.getBooking(booking.id)!.status).toBe("cancelled");
    });
  });
});
