import { NextRequest, NextResponse } from "next/server";
import { getCalendarService } from "@/lib/services";
import { generateAvailableSlots } from "@/lib/services/slot-availability";
import { israelSlotToUTC } from "@/lib/services/israel-time";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date query param required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  // Build day boundaries in Israel timezone (DST-aware)
  const dayStart = israelSlotToUTC(date, "00:00");
  const dayEnd = israelSlotToUTC(date, "23:59");

  const calendar = getCalendarService();
  const { busy } = await calendar.getFreeBusy(dayStart, dayEnd);

  // TODO: Phase 3+ will fetch existing slots/bookings from Supabase
  // For now, pass empty existing slots (all slots have default capacity)
  const existingSlots: [] = [];

  const slots = generateAvailableSlots(date, busy, existingSlots);

  return NextResponse.json({ date, slots });
}
