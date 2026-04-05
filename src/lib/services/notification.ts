export interface NotificationPayload {
  type: "cancel" | "reschedule" | "booking";
  traineeName: string;
  slotDate: string;
  slotTime: string;
  newSlotDate?: string;
  newSlotTime?: string;
}

export interface NotificationService {
  notifyCoach(payload: NotificationPayload): Promise<void>;
}

/**
 * Mock notification service — logs to console in dev.
 * Replace with email/push in production.
 */
export class MockNotificationService implements NotificationService {
  public sent: NotificationPayload[] = [];

  async notifyCoach(payload: NotificationPayload): Promise<void> {
    this.sent.push(payload);
    console.log(`[Notify Coach] ${payload.type}: ${payload.traineeName} - ${payload.slotDate} ${payload.slotTime}`);
  }
}
