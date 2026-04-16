import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/route-guard";
import { getContainer } from "@/lib/services";
import { todayIL } from "@/lib/services/israel-time";

export async function POST(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { slotId } = await request.json();
  if (!slotId) {
    return NextResponse.json({ error: "slotId required" }, { status: 400 });
  }

  const { tx } = getContainer();
  const result = await tx.book(session.id, slotId, {
    traineeName: session.name,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 409 });
  }
  return NextResponse.json({ booking: result.booking }, { status: 201 });
}

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { store, limits } = getContainer();
  const bookings = store.getTraineeBookings(session.id);
  const today = todayIL();
  const remainingEdits = limits.getRemainingEdits(session.id, today);
  return NextResponse.json({ bookings, remainingEdits });
}

export async function PATCH(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { bookingId, newSlotId } = await request.json();
  if (!bookingId || !newSlotId) {
    return NextResponse.json(
      { error: "bookingId and newSlotId required" },
      { status: 400 }
    );
  }

  const { tx } = getContainer();
  const result = await tx.reschedule(bookingId, session.id, newSlotId, {
    traineeName: session.name,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 409 });
  }
  return NextResponse.json({ booking: result.booking });
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuth();
  if (error) return error;

  const { bookingId } = await request.json();
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }

  const { tx } = getContainer();
  const result = await tx.cancel(bookingId, session.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 409 });
  }
  return NextResponse.json({ success: true });
}
