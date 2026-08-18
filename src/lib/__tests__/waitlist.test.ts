import { describe, it, expect, beforeEach } from "vitest";
import { MockBookingStore } from "../services/booking-store";
import { MockNotificationService } from "../services/notification";
import { makeWaitlist, MockWaitlistStore, Waitlist } from "../services/waitlist";
import { makeBookings, Bookings } from "../services/bookings";
import type { Slot } from "@/lib/types";

const FULL_SLOT: Slot = {
  id: "slot-2030-01-06-10:00",
  date: "2030-01-06",
  startTime: "10:00",
  capacity: 2,
  currentBookings: 2,
  lockoutOverride: false,
};

describe("Waitlist", () => {
  let store: MockBookingStore;
  let wstore: MockWaitlistStore;
  let notifier: MockNotificationService;
  let waitlist: Waitlist;

  beforeEach(() => {
    store = new MockBookingStore();
    wstore = new MockWaitlistStore();
    notifier = new MockNotificationService();
    waitlist = makeWaitlist(wstore, store, notifier);
    store.addSlot(FULL_SLOT);
  });

  it("trainee joins a full slot and sees it in their waitlist", async () => {
    const r = await waitlist.join("t1", FULL_SLOT.id);
    expect(r.ok).toBe(true);
    expect(await waitlist.slotIdsFor("t1")).toEqual([FULL_SLOT.id]);
  });

  it("joining a slot with free capacity is rejected — book instead", async () => {
    store.addSlot({ ...FULL_SLOT, id: "slot-open", currentBookings: 1 });
    const r = await waitlist.join("t1", "slot-open");
    expect(r).toMatchObject({ ok: false, error: "NOT_FULL" });
    expect(await waitlist.slotIdsFor("t1")).toEqual([]);
  });

  it("leaving removes the entry", async () => {
    await waitlist.join("t1", FULL_SLOT.id);
    await waitlist.leave("t1", FULL_SLOT.id);
    expect(await waitlist.slotIdsFor("t1")).toEqual([]);
  });

  it("a slot whose start time passed cannot be joined and drops out of the trainee's list", async () => {
    const past: Slot = { ...FULL_SLOT, id: "slot-past", date: "2020-01-06" };
    store.addSlot(past);
    const r = await waitlist.join("t1", "slot-past");
    expect(r).toMatchObject({ ok: false, error: "PAST_SLOT" });

    // An entry created while the slot was still future expires silently once
    // the slot starts — seeded at the storage seam to simulate time passing.
    wstore.add("slot-past", "t1");
    await waitlist.join("t1", FULL_SLOT.id);
    expect(await waitlist.slotIdsFor("t1")).toEqual([FULL_SLOT.id]);
  });

  describe("spot-opened fan-out via Bookings", () => {
    let bookings: Bookings;

    beforeEach(() => {
      bookings = makeBookings(store, null, notifier, waitlist);
      store.addSlot({ ...FULL_SLOT, id: "slot-w", currentBookings: 0 });
    });

    it("cancellation notifies every waitlisted trainee", async () => {
      const a = await bookings.book("t-a", "slot-w", { bypass: true });
      await bookings.book("t-b", "slot-w", { bypass: true });
      if (!a.ok) throw new Error("seed booking failed");

      await waitlist.join("t1", "slot-w");
      await waitlist.join("t2", "slot-w");

      const r = await bookings.cancel(a.booking.id, "t-a");
      expect(r.ok).toBe(true);

      const notified = notifier.sentSpotOpened.map((p) => p.traineeId).sort();
      expect(notified).toEqual(["t1", "t2"]);
      expect(notifier.sentSpotOpened[0]).toMatchObject({
        slotDate: "2030-01-06",
        slotTime: "10:00",
      });
    });

    it("coach-approved cancel request notifies the waitlist", async () => {
      const a = await bookings.book("t-a", "slot-w", { bypass: true });
      await bookings.book("t-b", "slot-w", { bypass: true });
      if (!a.ok) throw new Error("seed booking failed");
      await waitlist.join("t1", "slot-w");

      const req = await bookings.requestCancel(a.booking.id, "t-a", "סיבה");
      if (!req.ok) throw new Error("request failed");
      const d = await bookings.decideRequest(req.request.id, "coach", "approve");
      expect(d.ok).toBe(true);

      expect(notifier.sentSpotOpened.map((p) => p.traineeId)).toEqual(["t1"]);
    });

    it("reschedule frees the old slot and notifies its waitlist", async () => {
      store.addSlot({ ...FULL_SLOT, id: "slot-target", currentBookings: 0 });
      const a = await bookings.book("t-a", "slot-w", { bypass: true });
      await bookings.book("t-b", "slot-w", { bypass: true });
      if (!a.ok) throw new Error("seed booking failed");
      await waitlist.join("t1", "slot-w");

      const r = await bookings.reschedule(a.booking.id, "t-a", "slot-target");
      expect(r.ok).toBe(true);

      expect(notifier.sentSpotOpened.map((p) => p.traineeId)).toEqual(["t1"]);
    });

    it("booking the slot clears the booker's entry — they are not notified on the next opening", async () => {
      const a = await bookings.book("t-a", "slot-w", { bypass: true });
      const b = await bookings.book("t-b", "slot-w", { bypass: true });
      if (!a.ok || !b.ok) throw new Error("seed booking failed");
      await waitlist.join("t1", "slot-w");
      await waitlist.join("t2", "slot-w");

      // First opening: t1 wins the race and books.
      await bookings.cancel(a.booking.id, "t-a");
      notifier.sentSpotOpened = [];
      const won = await bookings.book("t1", "slot-w");
      expect(won.ok).toBe(true);

      // Second opening: only t2 is still waitlisted.
      await bookings.cancel(b.booking.id, "t-b");
      expect(notifier.sentSpotOpened.map((p) => p.traineeId)).toEqual(["t2"]);
    });
  });
});
