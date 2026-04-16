import { BookingStore, BookingError } from "./booking-service";
import { weekStartForDate } from "./israel-time";

const MAX_SESSIONS_PER_WEEK = 2;
const MAX_EDITS_PER_WEEK = 3;

export interface WeeklyLimitsStatus {
  bookingsUsed: number;
  bookingsLeft: number;
  editsUsed: number;
  editsLeft: number;
}

export interface WeeklyLimits {
  assertCanBook(traineeId: string, slotDate: string): void;
  assertCanCancel(traineeId: string, slotDate: string, isAutoBooked?: boolean): void;
  assertCanReschedule(traineeId: string, slotDate: string, isAutoBooked?: boolean): void;
  trackEdit(traineeId: string, slotDate: string, isAutoBooked?: boolean): void;
  status(traineeId: string, slotDate: string): WeeklyLimitsStatus;
  getRemainingEdits(traineeId: string, weekStart: string): number;
}

export function createWeeklyLimits(store: BookingStore): WeeklyLimits {
  function editsUsed(traineeId: string, weekStart: string): number {
    const log = store.getEditLog(traineeId, weekStart);
    return log?.editCount ?? 0;
  }

  function bookingsUsed(traineeId: string, weekStart: string): number {
    return store.getTraineeBookingsForWeek(traineeId, weekStart).length;
  }

  function checkBookingLimit(traineeId: string, slotDate: string): void {
    const ws = weekStartForDate(slotDate);
    if (bookingsUsed(traineeId, ws) >= MAX_SESSIONS_PER_WEEK) {
      throw new BookingError("Max 2 sessions per week");
    }
  }

  function checkEditLimit(traineeId: string, slotDate: string, isAutoBooked?: boolean): void {
    if (isAutoBooked) return;
    const ws = weekStartForDate(slotDate);
    const remaining = MAX_EDITS_PER_WEEK - editsUsed(traineeId, ws);
    if (remaining <= 0) {
      throw new BookingError("Edit limit reached (3/week)");
    }
  }

  return {
    assertCanBook(traineeId, slotDate) {
      checkBookingLimit(traineeId, slotDate);
    },

    assertCanCancel(traineeId, slotDate, isAutoBooked) {
      checkEditLimit(traineeId, slotDate, isAutoBooked);
    },

    assertCanReschedule(traineeId, slotDate, isAutoBooked) {
      checkEditLimit(traineeId, slotDate, isAutoBooked);
    },

    trackEdit(traineeId, slotDate, isAutoBooked) {
      if (isAutoBooked) return;
      const ws = weekStartForDate(slotDate);
      store.incrementEditCount(traineeId, ws);
    },

    getRemainingEdits(traineeId, weekStart) {
      return MAX_EDITS_PER_WEEK - editsUsed(traineeId, weekStart);
    },

    status(traineeId, slotDate) {
      const ws = weekStartForDate(slotDate);
      const bu = bookingsUsed(traineeId, ws);
      const eu = editsUsed(traineeId, ws);
      return {
        bookingsUsed: bu,
        bookingsLeft: Math.max(0, MAX_SESSIONS_PER_WEEK - bu),
        editsUsed: eu,
        editsLeft: Math.max(0, MAX_EDITS_PER_WEEK - eu),
      };
    },
  };
}
