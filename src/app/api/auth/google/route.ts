import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/route-guard";
import { getRealCalendarService } from "@/lib/services";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const calendarService = getRealCalendarService();
  if (!calendarService) {
    return NextResponse.json(
      { error: "Google Calendar not configured" },
      { status: 500 }
    );
  }

  const url = calendarService.getAuthUrl();
  return NextResponse.redirect(url);
}
