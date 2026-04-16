import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/route-guard";
import { getContainer } from "@/lib/services";

/** Admin: add trainee to slot */
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { traineeId, slotId, traineeName } = await request.json();
  if (!traineeId || !slotId) {
    return NextResponse.json({ error: "traineeId and slotId required" }, { status: 400 });
  }

  const { tx } = getContainer();
  const result = await tx.book(traineeId, slotId, {
    bypass: true,
    traineeName,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 409 });
  }
  return NextResponse.json({ booking: result.booking }, { status: 201 });
}

/** Admin: remove trainee from slot */
export async function DELETE(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { bookingId } = await request.json();
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }

  const { tx } = getContainer();
  const result = await tx.cancel(bookingId, "", { bypass: true });
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 409 });
  }
  return NextResponse.json({ success: true });
}

/** Admin: get all bookings */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const { store } = getContainer();
  const bookings = store.getAllBookings().filter((b) => b.status === "confirmed");
  return NextResponse.json({ bookings });
}
