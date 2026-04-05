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

export type UserRole = "admin" | "trainee";

export interface Profile {
  id: string;
  phone: string;
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

export interface Booking {
  id: string;
  slotId: string;
  traineeId: string;
  googleEventId: string | null;
  isAutoBooked: boolean;
  status: "confirmed" | "cancelled";
  createdAt: Date;
}

export interface EditLog {
  id: string;
  traineeId: string;
  weekStart: string; // YYYY-MM-DD (Sunday)
  editCount: number;
}
