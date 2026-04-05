import { NextRequest, NextResponse } from "next/server";
import { getCalendarService } from "@/lib/services";
import { generateAvailableSlots } from "@/lib/services/slot-availability";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date query param required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  // Build day boundaries in Israel timezone (IDT = UTC+3 in summer)
  const dayStart = new Date(`${date}T00:00:00+03:00`);
  const dayEnd = new Date(`${date}T23:59:59+03:00`);

  const calendar = getCalendarService();
  const { busy } = await calendar.getFreeBusy(dayStart, dayEnd);

  // TODO: Phase 3+ will fetch existing slots/bookings from Supabase
  // For now, pass empty existing slots (all slots have default capacity)
  const existingSlots: [] = [];

  const slots = generateAvailableSlots(date, busy, existingSlots);

  return NextResponse.json({ date, slots });
}
