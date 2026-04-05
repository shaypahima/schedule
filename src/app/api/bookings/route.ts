import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/services/session";
import { getBookingService, getBookingStore } from "@/lib/services";
import { BookingError } from "@/lib/services/booking-service";

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
    const booking = await getBookingService().book(session.id, slotId);
    return NextResponse.json(booking, { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const bookings = getBookingStore().getTraineeBookings(session.id);
  return NextResponse.json({ bookings });
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
