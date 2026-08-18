import type { Slot } from "@/lib/types";
import type { BookingStore } from "./booking-store";
import type { NotificationService } from "./notification";
import { israelSlotToUTC } from "./israel-time";

/**
 * Waitlist — notify-all, first-to-book wins (ADR-0012).
 *
 * A waitlist entry is a notification subscription, NOT a reservation: joining
 * holds nothing, leaving costs nothing, and entries expire silently at slot
 * start. Bookings stays the only authority on who gets a freed spot.
 */

export interface WaitlistEntry {
  id: string;
  slotId: string;
  traineeId: string;
  createdAt: Date;
}

/** Storage seam — one adapter per driver (mock / pg / supabase). */
export interface WaitlistStore {
  /** Idempotent: re-joining returns the existing entry. */
  add(slotId: string, traineeId: string): Promise<WaitlistEntry> | WaitlistEntry;
  remove(slotId: string, traineeId: string): Promise<void> | void;
  listTraineeIdsForSlot(slotId: string): Promise<string[]> | string[];
  listSlotIdsForTrainee(traineeId: string): Promise<string[]> | string[];
  countsForSlots(slotIds: string[]): Promise<Record<string, number>> | Record<string, number>;
}

export type WaitlistError_Code = "NOT_FOUND" | "NOT_FULL" | "PAST_SLOT";

export type WaitlistResult =
  | { ok: true }
  | { ok: false; error: WaitlistError_Code; message: string };

export interface Waitlist {
  join(traineeId: string, slotId: string): Promise<WaitlistResult>;
  leave(traineeId: string, slotId: string): Promise<void>;
  /** Slot ids the trainee is waitlisted on (future slots only). */
  slotIdsFor(traineeId: string): Promise<string[]>;
  /** Coach view: waitlist size per slot, batched. */
  countsForSlots(slotIds: string[]): Promise<Record<string, number>>;
  /** Hook fired by Bookings when a spot frees up — notifies every entry. */
  spotOpened(slot: Slot): Promise<void>;
  /** Hook fired by Bookings on successful booking — clears the booker's entry. */
  booked(slotId: string, traineeId: string): Promise<void>;
}

export function makeWaitlist(
  wstore: WaitlistStore,
  store: BookingStore,
  notifier: NotificationService
): Waitlist {
  function hasStarted(slot: Slot, now = new Date()): boolean {
    return israelSlotToUTC(slot.date, slot.startTime).getTime() <= now.getTime();
  }

  return {
    async join(traineeId, slotId) {
      const slot = await store.getSlot(slotId);
      if (!slot) return { ok: false, error: "NOT_FOUND", message: "Slot not found" };
      if (hasStarted(slot)) {
        return { ok: false, error: "PAST_SLOT", message: "Slot already started" };
      }
      if (slot.currentBookings < slot.capacity) {
        return { ok: false, error: "NOT_FULL", message: "Slot has free capacity — book it" };
      }
      await wstore.add(slotId, traineeId);
      return { ok: true };
    },

    async leave(traineeId, slotId) {
      await wstore.remove(slotId, traineeId);
    },

    async slotIdsFor(traineeId) {
      const ids = await wstore.listSlotIdsForTrainee(traineeId);
      if (ids.length === 0) return ids;
      const slots = await store.getSlotsByIds(ids);
      const future = new Set(slots.filter((s) => !hasStarted(s)).map((s) => s.id));
      return ids.filter((id) => future.has(id));
    },

    async countsForSlots(slotIds) {
      return wstore.countsForSlots(slotIds);
    },

    async spotOpened(slot) {
      if (hasStarted(slot)) return;
      const traineeIds = await wstore.listTraineeIdsForSlot(slot.id);
      for (const traineeId of traineeIds) {
        try {
          await notifier.notifySpotOpened({
            traineeId,
            slotDate: slot.date,
            slotTime: slot.startTime,
          });
        } catch {
          // one bad device must not starve the rest
        }
      }
    },

    async booked(slotId, traineeId) {
      await wstore.remove(slotId, traineeId);
    },
  };
}

/** In-memory adapter for dev/testing. */
export class MockWaitlistStore implements WaitlistStore {
  private entries = new Map<string, WaitlistEntry>(); // key slotId:traineeId

  private key(slotId: string, traineeId: string) {
    return `${slotId}:${traineeId}`;
  }

  add(slotId: string, traineeId: string): WaitlistEntry {
    const k = this.key(slotId, traineeId);
    const existing = this.entries.get(k);
    if (existing) return { ...existing };
    const entry: WaitlistEntry = {
      id: `wl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      slotId,
      traineeId,
      createdAt: new Date(),
    };
    this.entries.set(k, entry);
    return { ...entry };
  }

  remove(slotId: string, traineeId: string): void {
    this.entries.delete(this.key(slotId, traineeId));
  }

  listTraineeIdsForSlot(slotId: string): string[] {
    return Array.from(this.entries.values())
      .filter((e) => e.slotId === slotId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((e) => e.traineeId);
  }

  listSlotIdsForTrainee(traineeId: string): string[] {
    return Array.from(this.entries.values())
      .filter((e) => e.traineeId === traineeId)
      .map((e) => e.slotId);
  }

  countsForSlots(slotIds: string[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const id of slotIds) {
      const n = this.listTraineeIdsForSlot(id).length;
      if (n > 0) out[id] = n;
    }
    return out;
  }
}
