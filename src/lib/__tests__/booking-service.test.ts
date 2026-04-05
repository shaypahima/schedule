import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MockBookingStore,
  BookingService,
  BookingError,
} from "@/lib/services/booking-service";

describe("BookingService", () => {
  let store: MockBookingStore;
  let service: BookingService;

  beforeEach(() => {
    store = new MockBookingStore();
    service = new BookingService(store);
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));

    // Seed a slot with capacity 2 and 0 bookings
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

  describe("book", () => {
    it("creates a booking for a valid slot", async () => {
      const booking = await service.book("trainee-001", "slot-1");
      expect(booking.slotId).toBe("slot-1");
      expect(booking.traineeId).toBe("trainee-001");
      expect(booking.status).toBe("confirmed");
    });

    it("increments current bookings on the slot", async () => {
      await service.book("trainee-001", "slot-1");
      const slot = store.getSlot("slot-1");
      expect(slot!.currentBookings).toBe(1);
    });

    it("allows a second trainee to book the same slot", async () => {
      await service.book("trainee-001", "slot-1");
      const booking2 = await service.book("trainee-002", "slot-1");
      expect(booking2.status).toBe("confirmed");
      expect(store.getSlot("slot-1")!.currentBookings).toBe(2);
    });

    it("rejects booking when slot is full", async () => {
      await service.book("trainee-001", "slot-1");
      await service.book("trainee-002", "slot-1");

      await expect(service.book("trainee-003", "slot-1")).rejects.toThrow(
        BookingError
      );
      await expect(service.book("trainee-003", "slot-1")).rejects.toThrow(
        "Slot is full"
      );
    });

    it("rejects if trainee already booked this slot", async () => {
      await service.book("trainee-001", "slot-1");
      await expect(service.book("trainee-001", "slot-1")).rejects.toThrow(
        "Already booked"
      );
    });

    it("rejects booking for non-existent slot", async () => {
      await expect(
        service.book("trainee-001", "non-existent")
      ).rejects.toThrow("Slot not found");
    });

    it("works with capacity override of 3", async () => {
      store.addSlot({
        id: "slot-3cap",
        date: "2026-04-05",
        startTime: "11:00",
        capacity: 3,
        lockoutOverride: false,
        currentBookings: 0,
      });

      await service.book("trainee-001", "slot-3cap");
      await service.book("trainee-002", "slot-3cap");
      const b3 = await service.book("trainee-003", "slot-3cap");
      expect(b3.status).toBe("confirmed");

      await expect(service.book("trainee-004", "slot-3cap")).rejects.toThrow(
        "Slot is full"
      );
    });
  });

  describe("cancel", () => {
    it("cancels an existing booking", async () => {
      const booking = await service.book("trainee-001", "slot-1");
      await service.cancel(booking.id, "trainee-001");

      const updated = store.getBooking(booking.id);
      expect(updated!.status).toBe("cancelled");
    });

    it("decrements slot bookings on cancel", async () => {
      const booking = await service.book("trainee-001", "slot-1");
      await service.cancel(booking.id, "trainee-001");
      expect(store.getSlot("slot-1")!.currentBookings).toBe(0);
    });

    it("rejects cancel by different trainee", async () => {
      const booking = await service.book("trainee-001", "slot-1");
      await expect(
        service.cancel(booking.id, "trainee-002")
      ).rejects.toThrow("Not your booking");
    });

    it("rejects cancel of non-existent booking", async () => {
      await expect(
        service.cancel("non-existent", "trainee-001")
      ).rejects.toThrow("Booking not found");
    });

    it("allows re-booking after cancel", async () => {
      const booking = await service.book("trainee-001", "slot-1");
      await service.cancel(booking.id, "trainee-001");
      const newBooking = await service.book("trainee-001", "slot-1");
      expect(newBooking.status).toBe("confirmed");
    });
  });

  describe("getTraineeBookings", () => {
    it("returns only confirmed bookings for a trainee", async () => {
      const b1 = await service.book("trainee-001", "slot-1");

      store.addSlot({
        id: "slot-2",
        date: "2026-04-05",
        startTime: "14:00",
        capacity: 2,
        lockoutOverride: false,
        currentBookings: 0,
      });
      const b2 = await service.book("trainee-001", "slot-2");
      await service.cancel(b1.id, "trainee-001");

      const bookings = store.getTraineeBookings("trainee-001");
      expect(bookings.length).toBe(1);
      expect(bookings[0].id).toBe(b2.id);
    });

    it("does not return other trainees bookings", async () => {
      await service.book("trainee-001", "slot-1");
      const bookings = store.getTraineeBookings("trainee-002");
      expect(bookings.length).toBe(0);
    });
  });
});
