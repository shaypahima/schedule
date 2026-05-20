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
}

export interface NotificationService {
  notifyCoach(payload: NotificationPayload): Promise<void>;
  /** Send 1h-before reminder push to the trainee. */
  notifyTrainee(payload: TraineeReminderPayload): Promise<void>;
}

/**
 * Mock notification service — logs to console in dev.
 * Replace with email/push in production.
 */
export class MockNotificationService implements NotificationService {
  public sent: NotificationPayload[] = [];
  public sentToTrainee: TraineeReminderPayload[] = [];

  async notifyCoach(payload: NotificationPayload): Promise<void> {
    this.sent.push(payload);
    console.log(`[Notify Coach] ${payload.type}: ${payload.traineeName} - ${payload.slotDate} ${payload.slotTime}`);
  }

  async notifyTrainee(payload: TraineeReminderPayload): Promise<void> {
    this.sentToTrainee.push(payload);
    console.log(`[Notify Trainee] reminder: ${payload.traineeId} - ${payload.slotDate} ${payload.slotTime}`);
  }
}
