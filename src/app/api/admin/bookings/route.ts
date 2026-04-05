import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/services/session";
import { getBookingService, getBookingStore } from "@/lib/services";
import { BookingError } from "@/lib/services/booking-service";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  return session;
}

/** Admin: add trainee to slot */
export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { traineeId, slotId, traineeName } = await request.json();
  if (!traineeId || !slotId) {
    return NextResponse.json({ error: "traineeId and slotId required" }, { status: 400 });
  }

  try {
    const booking = await getBookingService().adminBook(traineeId, slotId, traineeName);
    return NextResponse.json(booking, { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}

/** Admin: remove trainee from slot */
export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { bookingId } = await request.json();
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }

  try {
    await getBookingService().adminCancel(bookingId);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
}

/** Admin: get all bookings */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const bookings = getBookingStore().getAllBookings().filter((b) => b.status === "confirmed");
  return NextResponse.json({ bookings });
}
