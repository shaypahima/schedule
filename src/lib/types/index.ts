export interface TimePeriod {
  start: Date;
  end: Date;
}

export interface FreeBusyResponse {
  busy: TimePeriod[];
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: Date;
  end: Date;
}

export interface CreateEventParams {
  summary: string;
  start: Date;
  end: Date;
}

export type UserRole = "coach" | "trainee";

export interface Profile {
  id: string;
  name: string;
  role: UserRole;
  isRecurring: boolean;
  preferredDay: number | null; // 0=Sun..5=Fri
  preferredTime: string | null; // HH:mm
  isActive: boolean;
  createdAt: Date;
}

export interface Slot {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  capacity: number;
  lockoutOverride: boolean;
  currentBookings: number;
  version?: number; // optimistic locking
}

export type BookingStatus = "confirmed" | "cancelled" | "no_show";

export interface Booking {
  id: string;
  slotId: string;
  traineeId: string;
  googleEventId: string | null;
  isAutoBooked: boolean;
  status: BookingStatus;
  createdAt: Date;
  reminderSentAt: Date | null;
}

export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export interface ChangeRequest {
  id: string;
  bookingId: string;
  /** null = bare cancel; set = reschedule (cancel old + book new on approval). */
  requestedNewSlotId: string | null;
  reason: string;
  status: ChangeRequestStatus;
  decisionNote: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
}

export interface EditLog {
  id: string;
  traineeId: string;
  weekStart: string; // YYYY-MM-DD (Sunday)
  editCount: number;
}
