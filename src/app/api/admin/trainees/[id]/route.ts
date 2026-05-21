import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireCoach } from "@/lib/auth/require";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { id } = await params;
  const { coachRead } = getContainer();

  const detail = await coachRead.getTraineeDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Trainee not found" }, { status: 404 });
  }

  // Map to the existing response shape for mobile compatibility.
  return NextResponse.json({
    trainee: {
      id: detail.trainee.id,
      name: detail.trainee.name,
      isRecurring: detail.trainee.isRecurring,
      preferredDay: detail.trainee.preferredDay,
      preferredTime: detail.trainee.preferredTime,
      isActive:
        detail.trainee.status !== "deactivated" &&
        detail.trainee.status !== "rejected",
    },
    sessions: detail.recentBookings.map((e) => ({
      bookingId: e.bookingId,
      slotId: e.slotId,
      date: e.slotDate,
      startTime: e.slotTime,
      isAutoBooked: e.isAutoBooked,
      createdAt: e.startsAt,
    })),
    remainingEdits: detail.remainingEdits,
    weekBookingsCount: detail.weekBookingsCount,
  });
}
