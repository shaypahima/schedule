import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { getNotificationService } from "@/lib/services";
import { sendDueReminders } from "@/lib/services/reminders";
import { requireCron } from "@/lib/route-guard";

export async function GET(request: NextRequest) {
  const { error } = requireCron(request);
  if (error) return error;

  const { store } = getContainer();
  const notifier = getNotificationService();

  const result = await sendDueReminders(store, notifier, new Date());

  return NextResponse.json(result);
}
