import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireCoach } from "@/lib/auth/require";
import { inviteTraineeByEmail, resendInvite } from "@/lib/services/trainee-invite";

export async function GET(request: NextRequest) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { coachRead } = getContainer();
  const filterParam = new URL(request.url).searchParams.get("filter");
  const filter = filterParam === "unbooked" ? "unbooked-this-week" : "all";

  const summaries = await coachRead.getTraineesList(filter);

  if (filter === "unbooked-this-week") {
    return NextResponse.json({
      trainees: summaries.map((s) => ({ id: s.id, name: s.name })),
    });
  }

  return NextResponse.json({
    trainees: summaries.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      isRecurring: s.isRecurring,
      preferredDay: s.preferredDay,
      preferredTime: s.preferredTime,
      isActive: s.status !== "deactivated" && s.status !== "rejected",
      status: s.status,
      lastWeightKg: s.lastWeightKg,
      weightTrend14d: s.weightTrend14d,
      lastMeasurementAt: s.lastMeasurementAt,
      attendanceRate: s.attendanceRate,
    })),
  });
}

export async function POST(request: NextRequest) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const body = await request.json();
  const { email, name, isRecurring, preferredDay, preferredTime, resend } = body as {
    email?: string;
    name?: string;
    isRecurring?: boolean;
    preferredDay?: number | null;
    preferredTime?: string | null;
    resend?: boolean;
  };

  if (!email || !name) {
    return NextResponse.json({ error: "email and name required" }, { status: 400 });
  }

  try {
    if (resend) {
      await resendInvite(email);
      return NextResponse.json({ ok: true });
    }
    const profile = await inviteTraineeByEmail({
      email,
      name,
      isRecurring,
      preferredDay,
      preferredTime,
    });
    return NextResponse.json(profile, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 409 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { id, ...updates } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    const { auth, store, bookings } = getContainer();
    const profile = await auth.updateTrainee(id, updates);

    if (updates.isActive === false) {
      const allBookings = await store.getAllBookings();
      const active = allBookings.filter(
        (b) => b.traineeId === id && b.status === "confirmed"
      );
      for (const b of active) {
        await bookings.cancel(b.id, id, { bypass: true });
      }
    }

    return NextResponse.json({ ...profile, cancelledBookings: updates.isActive === false ? undefined : 0 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 404 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    await getContainer().auth.deleteTrainee(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 409 }
    );
  }
}
