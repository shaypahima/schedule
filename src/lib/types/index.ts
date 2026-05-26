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

export type ReminderKind = "reminder_24h" | "reminder_2h" | "post_session";

export interface Booking {
  id: string;
  slotId: string;
  traineeId: string;
  googleEventId: string | null;
  isAutoBooked: boolean;
  status: BookingStatus;
  createdAt: Date;
  reminder24hSentAt: Date | null;
  reminder2hSentAt: Date | null;
  postSessionPromptSentAt: Date | null;
}

export interface CoachNote {
  id: string;
  traineeId: string;
  body: string;
  visibleToTrainee: boolean;
  createdAt: Date;
  updatedAt: Date;
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

export interface MeasurementLog {
  id: string;
  traineeId: string;
  loggedAt: Date;
  weightKg: number | null;
  metrics: Record<string, unknown> | null;
  photoUrl: string | null;
  note: string | null;
}

export interface MeasurementInput {
  weightKg?: number | null;
  metrics?: Record<string, unknown> | null;
  photoUrl?: string | null;
  note?: string | null;
  /** Override the logged_at timestamp (e.g., post-session prompt uses session end). Defaults to now. */
  loggedAt?: Date;
}

export interface SessionLog {
  bookingId: string;
  feedback: Record<string, unknown> | null;
  coachNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionLogInput {
  feedback?: Record<string, unknown> | null;
  coachNotes?: string | null;
}
