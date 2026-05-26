import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

process.env.MOCK_SERVICES = "true";
process.env.CRON_SECRET = "test-cron-secret";

import { GET } from "../route";
import { getContainer, resetContainer, getNotificationService } from "@/lib/services";
import { MockNotificationService } from "@/lib/services/notification";
import { israelSlotToUTC } from "@/lib/services/israel-time";

function makeRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/cron/send-reminders", { headers });
}

describe("GET /api/cron/send-reminders", () => {
  beforeEach(() => {
    resetContainer();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects without cron bearer", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("sends reminders for due bookings", async () => {
    const slotDate = "2026-05-22";
    const slotTime = "10:00";
    // freeze clock 120 min before the slot — inside the 2h-before window
    vi.setSystemTime(
      new Date(israelSlotToUTC(slotDate, slotTime).getTime() - 120 * 60 * 1000)
    );

    const { store } = getContainer();
    store.upsertSlot({
      id: `slot-${slotDate}-${slotTime}`,
      date: slotDate,
      startTime: slotTime,
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 1,
    });
    await store.addBooking({
      id: "b1",
      slotId: `slot-${slotDate}-${slotTime}`,
      traineeId: "t1",
      googleEventId: null,
      isAutoBooked: false,
      status: "confirmed",
      createdAt: new Date(),
      reminder24hSentAt: null,
      reminder2hSentAt: null,
      postSessionPromptSentAt: null,
    });

    const res = await GET(
      makeRequest({ authorization: "Bearer test-cron-secret" })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sent.reminder_2h).toBe(1);
    const notifier = getNotificationService() as MockNotificationService;
    expect(notifier.sentToTrainee).toHaveLength(1);
    expect(notifier.sentToTrainee[0].kind).toBe("reminder_2h");
  });
});
