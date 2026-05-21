import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { todayIL, weekStartForDate } from "@/lib/services/israel-time";
import { requireCoach } from "@/lib/auth/require";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { id } = await params;
  const { auth, store, limits } = getContainer();

  // Find trainee profile
  const trainees = await auth.getTrainees();
  const trainee = trainees.find((t) => t.id === id);
  if (!trainee) {
    return NextResponse.json({ error: "Trainee not found" }, { status: 404 });
  }

  // Get all bookings for this trainee, join with slot info
  const allBookings = await store.getAllBookings();
  const traineeBookings = allBookings
    .filter((b) => b.traineeId === id && b.status === "confirmed")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Enrich with slot date/time
  const sessions = [];
  for (const booking of traineeBookings.slice(0, 10)) {
    const slot = await store.getSlot(booking.slotId);
    sessions.push({
      bookingId: booking.id,
      slotId: booking.slotId,
      date: slot?.date ?? null,
      startTime: slot?.startTime ?? null,
      isAutoBooked: booking.isAutoBooked,
      createdAt: booking.createdAt,
    });
  }

  // Remaining edits this week
  const today = todayIL();
  const weekStart = weekStartForDate(today);
  const remainingEdits = await limits.getRemainingEdits(id, weekStart);

  // Current week bookings count
  const weekBookings = await store.getTraineeBookingsForWeek(id, weekStart);

  return NextResponse.json({
    trainee: {
      id: trainee.id,
      name: trainee.name,
      isRecurring: trainee.isRecurring,
      preferredDay: trainee.preferredDay,
      preferredTime: trainee.preferredTime,
      isActive: trainee.isActive,
    },
    sessions,
    remainingEdits,
    weekBookingsCount: weekBookings.length,
  });
}
