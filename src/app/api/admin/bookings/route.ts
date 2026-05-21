import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireCoach } from "@/lib/auth/require";

/** Admin: add trainee to slot */
export async function POST(request: NextRequest) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { traineeId, slotId, traineeName } = await request.json();
  if (!traineeId || !slotId) {
    return NextResponse.json({ error: "traineeId and slotId required" }, { status: 400 });
  }

  const { tx } = getContainer();
  const result = await tx.book(traineeId, slotId, { bypass: true, traineeName });
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 409 });
  return NextResponse.json({ booking: result.booking }, { status: 201 });
}

/** Admin: remove trainee from slot */
export async function DELETE(request: NextRequest) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { bookingId } = await request.json();
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }

  const { tx } = getContainer();
  const result = await tx.cancel(bookingId, "", { bypass: true });
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 409 });
  return NextResponse.json({ success: true });
}

/** Admin: get bookings (optionally filtered by date) */
export async function GET(request: NextRequest) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { store, auth } = getContainer();
  const date = new URL(request.url).searchParams.get("date");

  let bookings;
  if (date) {
    const slots = await store.getAllSlotsForDate(date);
    const slotIds = new Set(slots.map((s) => s.id));
    const all = await store.getAllBookings();
    bookings = all.filter((b) => b.status === "confirmed" && slotIds.has(b.slotId));
  } else {
    const all = await store.getAllBookings();
    bookings = all.filter((b) => b.status === "confirmed");
  }

  const trainees = await auth.getTrainees();
  const nameMap = new Map(trainees.map((t) => [t.id, t.name]));

  const enriched = [];
  for (const b of bookings) {
    const slot = await store.getSlot(b.slotId);
    enriched.push({
      ...b,
      traineeName: nameMap.get(b.traineeId) ?? null,
      slotDate: slot?.date ?? null,
      startTime: slot?.startTime ?? null,
    });
  }

  return NextResponse.json({ bookings: enriched });
}
