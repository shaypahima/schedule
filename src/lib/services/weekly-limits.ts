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
  assertCanBook(traineeId: string, slotDate: string): Promise<void>;
  assertCanCancel(traineeId: string, slotDate: string, isAutoBooked?: boolean): Promise<void>;
  assertCanReschedule(traineeId: string, slotDate: string, isAutoBooked?: boolean): Promise<void>;
  trackEdit(traineeId: string, slotDate: string, isAutoBooked?: boolean): Promise<void>;
  status(traineeId: string, slotDate: string): Promise<WeeklyLimitsStatus>;
  getRemainingEdits(traineeId: string, weekStart: string): Promise<number>;
}

export function createWeeklyLimits(store: BookingStore): WeeklyLimits {
  async function editsUsed(traineeId: string, weekStart: string): Promise<number> {
    const log = await store.getEditLog(traineeId, weekStart);
    return log?.editCount ?? 0;
  }

  async function bookingsUsed(traineeId: string, weekStart: string): Promise<number> {
    const bookings = await store.getTraineeBookingsForWeek(traineeId, weekStart);
    return bookings.length;
  }

  async function checkBookingLimit(traineeId: string, slotDate: string): Promise<void> {
    const ws = weekStartForDate(slotDate);
    if ((await bookingsUsed(traineeId, ws)) >= MAX_SESSIONS_PER_WEEK) {
      throw new BookingError("Max 2 sessions per week");
    }
  }

  async function checkEditLimit(traineeId: string, slotDate: string, isAutoBooked?: boolean): Promise<void> {
    if (isAutoBooked) return;
    const ws = weekStartForDate(slotDate);
    const remaining = MAX_EDITS_PER_WEEK - (await editsUsed(traineeId, ws));
    if (remaining <= 0) {
      throw new BookingError("Edit limit reached (3/week)");
    }
  }

  return {
    async assertCanBook(traineeId, slotDate) {
      await checkBookingLimit(traineeId, slotDate);
    },

    async assertCanCancel(traineeId, slotDate, isAutoBooked) {
      await checkEditLimit(traineeId, slotDate, isAutoBooked);
    },

    async assertCanReschedule(traineeId, slotDate, isAutoBooked) {
      await checkEditLimit(traineeId, slotDate, isAutoBooked);
    },

    async trackEdit(traineeId, slotDate, isAutoBooked) {
      if (isAutoBooked) return;
      const ws = weekStartForDate(slotDate);
      await store.incrementEditCount(traineeId, ws);
    },

    async getRemainingEdits(traineeId, weekStart) {
      return MAX_EDITS_PER_WEEK - (await editsUsed(traineeId, weekStart));
    },

    async status(traineeId, slotDate) {
      const ws = weekStartForDate(slotDate);
      const bu = await bookingsUsed(traineeId, ws);
      const eu = await editsUsed(traineeId, ws);
      return {
        bookingsUsed: bu,
        bookingsLeft: Math.max(0, MAX_SESSIONS_PER_WEEK - bu),
        editsUsed: eu,
        editsLeft: Math.max(0, MAX_EDITS_PER_WEEK - eu),
      };
    },
  };
}
