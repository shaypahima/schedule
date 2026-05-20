import { NextRequest, NextResponse } from "next/server";
import { getCalendarService, getContainer } from "@/lib/services";
import { generateAvailableSlots } from "@/lib/services/slot-availability";
import { israelSlotToUTC } from "@/lib/services/israel-time";
import { getJwtSession } from "@/lib/services/jwt-session";

export async function GET(request: NextRequest) {
  const session = await getJwtSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const { store } = getContainer();
  const existingSlots = await store.getAllSlotsForDate(date);

  const slots = generateAvailableSlots(date, busy, existingSlots);

  return NextResponse.json({ date, slots });
}
