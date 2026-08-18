/**
 * CoachReadModel — read-only, view-shaped queries for the coach UI.
 *
 * Lives alongside (not inside) BookingStore: BookingStore is the write boundary,
 * CoachReadModel is the read side. Write API churns with booking invariants;
 * read API churns with coach screens. Decoupling them keeps each focused.
 *
 * Each method returns a fully denormalized DTO that maps 1:1 to a coach screen.
 * Routes are dumb pass-throughs: auth check, call method, return JSON.
 *
 * `getPendingChangeRequests()` returns [] until Phase 15 lands the table.
 * `getCoachDashboard().pendingChangeRequests / noShowsThisWeek` are 0
 * until Phase 15/16 wire their data.
 */

export type RosterEntry = {
  bookingId: string;
  slotId: string;
  startsAt: string; // ISO
  slotDate: string; // YYYY-MM-DD
  slotTime: string; // HH:mm
  trainee: { id: string; name: string };
  status: "confirmed" | "cancelled" | "no_show";
  isAutoBooked: boolean;
};

export type TraineeSummary = {
  id: string;
  name: string;
  email: string | null;
  status: "pending" | "active" | "rejected" | "deactivated";
  isRecurring: boolean;
  preferredDay: number | null;
  preferredTime: string | null;
  bookedThisWeek: boolean;
  lastSessionAt: string | null; // ISO of most-recent confirmed past slot
  lastWeightKg: number | null; // most-recent logged weight, null if never logged
  weightTrend14d: "up" | "flat" | "down" | null; // vs a >=14d-older point; null if insufficient data
  lastMeasurementAt: string | null; // ISO of most-recent measurement (any kind)
  attendanceRate: number | null; // 0..1 over past bookings; null if no past sessions yet
  /**
   * At-risk signal (#83). "no_shows" = 2+ no-shows in the trailing 4 weeks
   * (wins over inactive); "inactive" = no session in 14+ days AND nothing
   * upcoming. null = healthy, or not an active trainee.
   */
  atRisk: "inactive" | "no_shows" | null;
};

export type TraineeDetailView = {
  trainee: TraineeSummary;
  recentBookings: RosterEntry[]; // last 10 confirmed bookings
  attendanceRate: number; // 0..1, derived from past confirmed vs no_show
  remainingEdits: number;
  weekBookingsCount: number;
};

export type ChangeRequestEntry = {
  id: string;
  requestedAt: string;
  reason: string;
  trainee: { id: string; name: string };
  fromSlot: { id: string; startsAt: string };
  toSlot: { id: string; startsAt: string } | null;
};

/** One calendar month of held-session aggregates (#84). */
export type MonthlyStats = {
  sessionsHeld: number; // past confirmed (attended) sessions in the month
  noShows: number;
  attendanceRate: number | null; // held / (held + noShows); null when no past sessions
  activeTrainees: number; // distinct trainees with a held or no-show session
};

export type DashboardView = {
  pendingApprovals: number;
  pendingChangeRequests: number; // 0 until Phase 15
  noShowsThisWeek: number; // 0 until Phase 16
  /** Current calendar month + previous (null when previous month was empty). */
  monthly: MonthlyStats & { prev: MonthlyStats | null };
  todayRoster: RosterEntry[];
  urgentRequests: ChangeRequestEntry[]; // [] until Phase 15
};

export type TraineesFilter = "all" | "pending" | "active" | "unbooked-this-week";

export type PendingApprovalView = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  introText: string | null;
  introSubmittedAt: string | null;
};

export interface CoachReadModel {
  getCoachDashboard(): Promise<DashboardView>;
  getTraineesList(filter?: TraineesFilter): Promise<TraineeSummary[]>;
  getTraineeDetail(traineeId: string): Promise<TraineeDetailView | null>;
  getDayBookings(date: string): Promise<RosterEntry[]>;
  /** Phase 14: list trainees in `pending` who have submitted their intro. */
  getPendingApprovals(): Promise<PendingApprovalView[]>;
  /** Phase 15 wires this once booking_change_request lands. Returns [] today. */
  getPendingChangeRequests(): Promise<ChangeRequestEntry[]>;
}
