import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { todayIL, isLockedOut } from "@/lib/services/israel-time";
import { requireActiveTrainee } from "@/lib/auth/require";

const LOCKOUT_HOURS = 7;

export async function POST(request: NextRequest) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const { slotId } = await request.json();
  if (!slotId) return NextResponse.json({ error: "slotId required" }, { status: 400 });

  const { tx } = getContainer();
  const result = await tx.book(r.trainee.userId, slotId, { traineeName: r.trainee.name });
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 409 });
  return NextResponse.json({ booking: result.booking }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const { store, limits } = getContainer();
  const bookings = await store.getTraineeBookings(r.trainee.userId);

  const enriched = await Promise.all(
    bookings.map(async (b) => {
      const slot = await store.getSlot(b.slotId);
      const isLocked = slot
        ? !slot.lockoutOverride && isLockedOut(slot.date, slot.startTime, LOCKOUT_HOURS)
        : false;
      return {
        ...b,
        slot: slot ? { date: slot.date, startTime: slot.startTime } : null,
        isLocked,
      };
    })
  );

  const remainingEdits = await limits.getRemainingEdits(r.trainee.userId, todayIL());
  return NextResponse.json({ bookings: enriched, remainingEdits });
}

export async function PATCH(request: NextRequest) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const { bookingId, newSlotId } = await request.json();
  if (!bookingId || !newSlotId) {
    return NextResponse.json({ error: "bookingId and newSlotId required" }, { status: 400 });
  }

  const { tx } = getContainer();
  const result = await tx.reschedule(bookingId, r.trainee.userId, newSlotId, { traineeName: r.trainee.name });
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 409 });
  return NextResponse.json({ booking: result.booking });
}

export async function DELETE(request: NextRequest) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const { bookingId } = await request.json();
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

  const { tx } = getContainer();
  const result = await tx.cancel(bookingId, r.trainee.userId);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 409 });
  return NextResponse.json({ success: true });
}
