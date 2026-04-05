import { NextResponse } from "next/server";
import { getSession } from "@/lib/services/session";
import { getRealCalendarService } from "@/lib/services";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

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
