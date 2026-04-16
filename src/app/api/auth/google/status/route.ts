import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/route-guard";
import { getRealCalendarService } from "@/lib/services";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const calendarService = getRealCalendarService();
  if (!calendarService) {
    return NextResponse.json({ connected: false, mock: true });
  }

  const connected = await calendarService.isConnected();
  return NextResponse.json({ connected, mock: false });
}
