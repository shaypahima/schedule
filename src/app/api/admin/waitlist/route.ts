import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireCoach } from "@/lib/auth/require";

/** Coach view: waitlist size per slot for a date. Slots without entries are omitted. */
export async function GET(request: NextRequest) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const date = request.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "INVALID_DATE" }, { status: 400 });
  }

  const { store, waitlist } = getContainer();
  const slots = await store.getAllSlotsForDate(date);
  const counts = await waitlist.countsForSlots(slots.map((s) => s.id));
  return NextResponse.json({ counts });
}
