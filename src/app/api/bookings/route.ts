import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/services/session";
import { getBookingService, getBookingStore } from "@/lib/services";
import { BookingError, getWeekStart } from "@/lib/services/booking-service";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { slotId } = await request.json();
  if (!slotId) {
    return NextResponse.json({ error: "slotId required" }, { status: 400 });
  }

  try {
    const booking = await getBookingService().book(session.id, slotId, session.name);
    return NextResponse.json(booking, { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const bookings = getBookingStore().getTraineeBookings(session.id);
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = getWeekStart(today);
  const remainingEdits = getBookingService().getRemainingEdits(session.id, weekStart);
  return NextResponse.json({ bookings, remainingEdits });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { bookingId, newSlotId } = await request.json();
  if (!bookingId || !newSlotId) {
    return NextResponse.json({ error: "bookingId and newSlotId required" }, { status: 400 });
  }

  try {
    const booking = await getBookingService().reschedule(
      bookingId, session.id, newSlotId, session.name
    );
    return NextResponse.json(booking);
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { bookingId } = await request.json();
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }

  try {
    await getBookingService().cancel(bookingId, session.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}
