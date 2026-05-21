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

  const { bookings } = getContainer();
  const result = await bookings.book(traineeId, slotId, { bypass: true, traineeName });
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

  const { bookings } = getContainer();
  const result = await bookings.cancel(bookingId, "", { bypass: true });
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 409 });
  return NextResponse.json({ success: true });
}

/** Admin: get bookings (optionally filtered by date) */
export async function GET(request: NextRequest) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { coachRead } = getContainer();
  const date = new URL(request.url).searchParams.get("date");

  if (date) {
    const roster = await coachRead.getDayBookings(date);
    // Preserve the legacy response shape for mobile compatibility.
    return NextResponse.json({
      bookings: roster.map((e) => ({
        id: e.bookingId,
        slotId: e.slotId,
        traineeId: e.trainee.id,
        traineeName: e.trainee.name,
        slotDate: e.slotDate,
        startTime: e.slotTime,
        status: e.status,
        isAutoBooked: e.isAutoBooked,
      })),
    });
  }

  // No date filter: flatten across all days (rare path; mobile uses date filter).
  const { store, auth } = getContainer();
  const all = await store.getAllBookings();
  const confirmed = all.filter((b) => b.status === "confirmed");
  const trainees = await auth.getTrainees();
  const nameMap = new Map(trainees.map((t) => [t.id, t.name]));
  const enriched = [];
  for (const b of confirmed) {
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
