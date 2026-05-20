import { describe, it, expect, beforeEach } from "vitest";
import { MockBookingStore } from "@/lib/services/booking-service";
import { MockNotificationService } from "@/lib/services/notification";
import { sendDueReminders } from "@/lib/services/reminders";
import { israelSlotToUTC } from "@/lib/services/israel-time";

describe("sendDueReminders", () => {
  let store: MockBookingStore;
  let notifier: MockNotificationService;
  const slotDate = "2026-05-22";
  const slotTime = "10:00";
  // 10:00 Asia/Jerusalem on the slot day, minus 62 minutes → inside [60,65) window
  const now = new Date(
    israelSlotToUTC(slotDate, slotTime).getTime() - 62 * 60 * 1000
  );

  function seedConfirmed(id: string, reminderSentAt: Date | null = null) {
    store.addSlot({
      id: `slot-${slotDate}-${slotTime}`,
      date: slotDate,
      startTime: slotTime,
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 1,
    });
    store.addBooking({
      id,
      slotId: `slot-${slotDate}-${slotTime}`,
      traineeId: "t1",
      googleEventId: null,
      isAutoBooked: false,
      status: "confirmed",
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      reminderSentAt,
    });
  }

  beforeEach(() => {
    store = new MockBookingStore();
    notifier = new MockNotificationService();
  });

  it("notifies trainee and stamps reminder_sent_at for bookings in the window", async () => {
    seedConfirmed("b1");

    const result = await sendDueReminders(store, notifier, now);

    expect(notifier.sentToTrainee).toHaveLength(1);
    expect(notifier.sentToTrainee[0]).toMatchObject({
      traineeId: "t1",
      slotDate,
      slotTime,
    });
    expect(result.sent).toBe(1);
    expect(store.getBooking("b1")!.reminderSentAt).toBeInstanceOf(Date);
  });

  it("skips bookings already stamped with reminder_sent_at", async () => {
    seedConfirmed("b1", new Date(now.getTime() - 5 * 60 * 1000));

    const result = await sendDueReminders(store, notifier, now);

    expect(notifier.sentToTrainee).toHaveLength(0);
    expect(result.sent).toBe(0);
  });

  it("skips cancelled bookings", async () => {
    seedConfirmed("b1");
    const b = store.getBooking("b1")!;
    store.updateBooking({ ...b, status: "cancelled" });

    const result = await sendDueReminders(store, notifier, now);

    expect(notifier.sentToTrainee).toHaveLength(0);
    expect(result.sent).toBe(0);
  });

  it("skips bookings outside the window (too soon — slot 30 min away)", async () => {
    seedConfirmed("b1");
    const earlyNow = new Date(
      israelSlotToUTC(slotDate, slotTime).getTime() - 30 * 60 * 1000
    );

    const result = await sendDueReminders(store, notifier, earlyNow);

    expect(notifier.sentToTrainee).toHaveLength(0);
    expect(result.sent).toBe(0);
  });

  it("skips bookings outside the window (too far — slot 90 min away)", async () => {
    seedConfirmed("b1");
    const farNow = new Date(
      israelSlotToUTC(slotDate, slotTime).getTime() - 90 * 60 * 1000
    );

    const result = await sendDueReminders(store, notifier, farNow);

    expect(notifier.sentToTrainee).toHaveLength(0);
    expect(result.sent).toBe(0);
  });

  it("includes slot at exactly 60 min away (window start inclusive)", async () => {
    seedConfirmed("b1");
    const exactly60 = new Date(
      israelSlotToUTC(slotDate, slotTime).getTime() - 60 * 60 * 1000
    );

    const result = await sendDueReminders(store, notifier, exactly60);

    expect(result.sent).toBe(1);
  });

  it("excludes slot at exactly 65 min away (window end exclusive)", async () => {
    seedConfirmed("b1");
    const exactly65 = new Date(
      israelSlotToUTC(slotDate, slotTime).getTime() - 65 * 60 * 1000
    );

    const result = await sendDueReminders(store, notifier, exactly65);

    expect(result.sent).toBe(0);
  });

  it("processes multiple due bookings in the same run", async () => {
    store.addSlot({
      id: `slot-${slotDate}-${slotTime}`,
      date: slotDate,
      startTime: slotTime,
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 2,
    });
    for (const tid of ["t1", "t2"]) {
      store.addBooking({
        id: `b-${tid}`,
        slotId: `slot-${slotDate}-${slotTime}`,
        traineeId: tid,
        googleEventId: null,
        isAutoBooked: false,
        status: "confirmed",
        createdAt: new Date(now.getTime() - 86_400_000),
        reminderSentAt: null,
      });
    }

    const result = await sendDueReminders(store, notifier, now);

    expect(result.sent).toBe(2);
    expect(notifier.sentToTrainee).toHaveLength(2);
  });

  it("does not double-send on a repeat run (idempotent across runs)", async () => {
    seedConfirmed("b1");

    await sendDueReminders(store, notifier, now);
    const second = await sendDueReminders(store, notifier, now);

    expect(second.sent).toBe(0);
    expect(notifier.sentToTrainee).toHaveLength(1);
  });
});
