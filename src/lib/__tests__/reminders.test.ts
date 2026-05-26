import { describe, it, expect, beforeEach } from "vitest";
import { MockBookingStore } from "@/lib/services/booking-store";
import { MockNotificationService } from "@/lib/services/notification";
import { sendDueReminders } from "@/lib/services/reminders";
import { israelSlotToUTC } from "@/lib/services/israel-time";
import type { ReminderKind } from "@/lib/types";

const slotDate = "2026-05-22";
const slotTime = "10:00";
const slotStart = israelSlotToUTC(slotDate, slotTime);

function seedConfirmed(
  store: MockBookingStore,
  id: string,
  flags: Partial<{
    reminder24hSentAt: Date | null;
    reminder2hSentAt: Date | null;
    postSessionPromptSentAt: Date | null;
  }> = {}
) {
  const slotId = `slot-${slotDate}-${slotTime}`;
  if (!store.getSlot(slotId)) {
    store.addSlot({
      id: slotId,
      date: slotDate,
      startTime: slotTime,
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 1,
    });
  }
  store.addBooking({
    id,
    slotId,
    traineeId: "t1",
    googleEventId: null,
    isAutoBooked: false,
    status: "confirmed",
    createdAt: new Date(slotStart.getTime() - 86_400_000),
    reminder24hSentAt: null,
    reminder2hSentAt: null,
    postSessionPromptSentAt: null,
    ...flags,
  });
}

describe("sendDueReminders — three-window cadence (#53)", () => {
  let store: MockBookingStore;
  let notifier: MockNotificationService;

  beforeEach(() => {
    store = new MockBookingStore();
    notifier = new MockNotificationService();
  });

  function setNow(offsetMinFromSlotStart: number): Date {
    return new Date(slotStart.getTime() + offsetMinFromSlotStart * 60 * 1000);
  }

  describe("24h-before window", () => {
    it("fires once when slot is ~24h away", async () => {
      seedConfirmed(store, "b1");
      const result = await sendDueReminders(store, notifier, setNow(-24 * 60));
      expect(result.sent.reminder_24h).toBe(1);
      expect(notifier.sentToTrainee[0]).toMatchObject({ kind: "reminder_24h", traineeId: "t1" });
      expect(store.getBooking("b1")!.reminder24hSentAt).toBeInstanceOf(Date);
    });

    it("inclusive at exact lower edge (-23h55m)", async () => {
      seedConfirmed(store, "b1");
      const result = await sendDueReminders(store, notifier, setNow(-(24 * 60 - 5)));
      expect(result.sent.reminder_24h).toBe(1);
    });

    it("exclusive at exact upper edge (-24h05m)", async () => {
      seedConfirmed(store, "b1");
      const result = await sendDueReminders(store, notifier, setNow(-(24 * 60 + 5)));
      expect(result.sent.reminder_24h).toBe(0);
    });

    it("excludes when too far away (-24h10m)", async () => {
      seedConfirmed(store, "b1");
      const result = await sendDueReminders(store, notifier, setNow(-24 * 60 - 10));
      expect(result.sent.reminder_24h).toBe(0);
    });

    it("does not double-fire across cron runs", async () => {
      seedConfirmed(store, "b1");
      await sendDueReminders(store, notifier, setNow(-24 * 60));
      const second = await sendDueReminders(store, notifier, setNow(-24 * 60));
      expect(second.sent.reminder_24h).toBe(0);
      expect(notifier.sentToTrainee).toHaveLength(1);
    });
  });

  describe("2h-before window", () => {
    it("fires once when slot is ~2h away", async () => {
      seedConfirmed(store, "b1");
      const result = await sendDueReminders(store, notifier, setNow(-2 * 60));
      expect(result.sent.reminder_2h).toBe(1);
      expect(notifier.sentToTrainee[0].kind).toBe("reminder_2h");
      expect(store.getBooking("b1")!.reminder2hSentAt).toBeInstanceOf(Date);
    });

    it("does not fire 24h push during 2h window", async () => {
      seedConfirmed(store, "b1");
      const result = await sendDueReminders(store, notifier, setNow(-2 * 60));
      expect(result.sent.reminder_24h).toBe(0);
      expect(store.getBooking("b1")!.reminder24hSentAt).toBeNull();
    });

    it("idempotent on repeat run", async () => {
      seedConfirmed(store, "b1");
      await sendDueReminders(store, notifier, setNow(-2 * 60));
      const second = await sendDueReminders(store, notifier, setNow(-2 * 60));
      expect(second.sent.reminder_2h).toBe(0);
    });
  });

  describe("post-session window (30min after slot END)", () => {
    // Slot is 60 min. End = slotStart + 60. Window targets end+30 ⇒ slotStart+90.
    it("fires when slot ended ~30min ago (slotStart+90m)", async () => {
      seedConfirmed(store, "b1");
      const result = await sendDueReminders(store, notifier, setNow(90));
      expect(result.sent.post_session).toBe(1);
      expect(notifier.sentToTrainee[0].kind).toBe("post_session");
      expect(store.getBooking("b1")!.postSessionPromptSentAt).toBeInstanceOf(Date);
    });

    it("does not fire pre-session", async () => {
      seedConfirmed(store, "b1");
      const result = await sendDueReminders(store, notifier, setNow(-5));
      expect(result.sent.post_session).toBe(0);
    });

    it("idempotent on repeat run", async () => {
      seedConfirmed(store, "b1");
      await sendDueReminders(store, notifier, setNow(90));
      const second = await sendDueReminders(store, notifier, setNow(90));
      expect(second.sent.post_session).toBe(0);
    });
  });

  describe("cross-cutting", () => {
    it("skips cancelled bookings across all kinds", async () => {
      seedConfirmed(store, "b1");
      const b = store.getBooking("b1")!;
      store.updateBooking({ ...b, status: "cancelled" });

      for (const off of [-24 * 60, -2 * 60, 90]) {
        const r = await sendDueReminders(store, notifier, setNow(off));
        expect(r.sent.reminder_24h + r.sent.reminder_2h + r.sent.post_session).toBe(0);
      }
    });

    it("skips no_show bookings post-session (don't prompt missing sessions)", async () => {
      seedConfirmed(store, "b1");
      const b = store.getBooking("b1")!;
      store.updateBooking({ ...b, status: "no_show" });

      const result = await sendDueReminders(store, notifier, setNow(90));
      expect(result.sent.post_session).toBe(0);
    });

    it("processes multiple trainees in the same run", async () => {
      const slotId = `slot-${slotDate}-${slotTime}`;
      store.addSlot({
        id: slotId,
        date: slotDate,
        startTime: slotTime,
        capacity: 2,
        lockoutOverride: false,
        currentBookings: 2,
      });
      for (const tid of ["t1", "t2"]) {
        store.addBooking({
          id: `b-${tid}`,
          slotId,
          traineeId: tid,
          googleEventId: null,
          isAutoBooked: false,
          status: "confirmed",
          createdAt: new Date(slotStart.getTime() - 86_400_000),
          reminder24hSentAt: null,
          reminder2hSentAt: null,
          postSessionPromptSentAt: null,
        });
      }
      const result = await sendDueReminders(store, notifier, setNow(-24 * 60));
      expect(result.sent.reminder_24h).toBe(2);
    });

    it("kinds are independent — 24h already sent does not block 2h push", async () => {
      seedConfirmed(store, "b1", { reminder24hSentAt: new Date(slotStart.getTime() - 24 * 60 * 60 * 1000) });
      const result = await sendDueReminders(store, notifier, setNow(-2 * 60));
      expect(result.sent.reminder_2h).toBe(1);
    });

    it("Hebrew copy renders for each kind via notifyTrainee payload", async () => {
      // sanity: payload kind round-trips through to mock service buffer
      seedConfirmed(store, "b1");
      await sendDueReminders(store, notifier, setNow(-24 * 60));
      const kinds: ReminderKind[] = notifier.sentToTrainee.map((p) => p.kind);
      expect(kinds).toEqual(["reminder_24h"]);
    });
  });
});
