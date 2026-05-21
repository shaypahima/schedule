import { NextRequest, NextResponse } from "next/server";
import { requireCoach } from "@/lib/auth/require";
import { getRealCalendarService } from "@/lib/services";

export async function GET(request: NextRequest) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const calendar = getRealCalendarService();
  if (!calendar) {
    return NextResponse.json({ error: "Google Calendar not configured" }, { status: 500 });
  }

  return NextResponse.json({ authUrl: calendar.getAuthUrl() });
}
