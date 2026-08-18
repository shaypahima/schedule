import type { ReminderKind } from "@/lib/types";

export interface NotificationPayload {
  type: "cancel" | "reschedule" | "booking";
  traineeName: string;
  slotDate: string;
  slotTime: string;
  newSlotDate?: string;
  newSlotTime?: string;
}

export interface TraineeReminderPayload {
  traineeId: string;
  slotDate: string;
  slotTime: string;
  kind: ReminderKind;
}

export interface SpotOpenedPayload {
  traineeId: string;
  slotDate: string;
  slotTime: string;
}

export interface NotificationService {
  notifyCoach(payload: NotificationPayload): Promise<void>;
  /**
   * Send reminder push to the trainee. Kind decides the copy:
   *   reminder_24h → "מחר בשעה HH:MM נפגשים..."
   *   reminder_2h  → "בעוד שעתיים אימון. נתראה!"
   *   post_session → "איך הרגשת? תיעוד קצר עוזר..."
   */
  notifyTrainee(payload: TraineeReminderPayload): Promise<void>;
  /** Waitlist (ADR-0012): a spot freed up — first to book wins. */
  notifySpotOpened(payload: SpotOpenedPayload): Promise<void>;
}

const HEBREW_COPY: Record<ReminderKind, (slotTime: string) => string> = {
  reminder_24h: (t) => `מחר בשעה ${t} נפגשים. כל עדכון, עכשיו זה הזמן.`,
  reminder_2h: () => `בעוד שעתיים אימון. נתראה!`,
  post_session: () => `איך הרגשת? תיעוד קצר עוזר לך לראות את ההתקדמות.`,
};

export function renderReminderCopy(payload: TraineeReminderPayload): string {
  return HEBREW_COPY[payload.kind](payload.slotTime);
}

export function renderSpotOpenedCopy(payload: SpotOpenedPayload): string {
  const [, m, d] = payload.slotDate.split("-").map(Number);
  return `מקום התפנה באימון ב-${d}.${m} בשעה ${payload.slotTime}. הראשון שקובע — זוכה.`;
}

/**
 * Mock notification service — logs to console in dev.
 * Replace with FCM in production (#36).
 */
export class MockNotificationService implements NotificationService {
  public sent: NotificationPayload[] = [];
  public sentToTrainee: TraineeReminderPayload[] = [];
  public sentSpotOpened: SpotOpenedPayload[] = [];

  async notifyCoach(payload: NotificationPayload): Promise<void> {
    this.sent.push(payload);
    console.log(`[Notify Coach] ${payload.type}: ${payload.traineeName} - ${payload.slotDate} ${payload.slotTime}`);
  }

  async notifyTrainee(payload: TraineeReminderPayload): Promise<void> {
    this.sentToTrainee.push(payload);
    console.log(
      `[Notify Trainee] ${payload.kind}: ${payload.traineeId} - ${payload.slotDate} ${payload.slotTime} — ${renderReminderCopy(payload)}`
    );
  }

  async notifySpotOpened(payload: SpotOpenedPayload): Promise<void> {
    this.sentSpotOpened.push(payload);
    console.log(
      `[Notify Trainee] spot_opened: ${payload.traineeId} - ${payload.slotDate} ${payload.slotTime} — ${renderSpotOpenedCopy(payload)}`
    );
  }
}
