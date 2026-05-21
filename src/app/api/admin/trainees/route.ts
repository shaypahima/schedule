import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { todayIL, weekStartForDate } from "@/lib/services/israel-time";
import { requireCoach } from "@/lib/auth/require";
import { inviteTraineeByEmail, resendInvite } from "@/lib/services/trainee-invite";

export async function GET(request: NextRequest) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { auth, store } = getContainer();
  const trainees = await auth.getTrainees();
  const filter = new URL(request.url).searchParams.get("filter");

  if (filter === "unbooked") {
    const today = todayIL();
    const weekStart = weekStartForDate(today);
    const active = trainees.filter((t) => t.isActive);
    const unbooked = [];
    for (const t of active) {
      const weekBookings = await store.getTraineeBookingsForWeek(t.id, weekStart);
      if (weekBookings.length === 0) {
        unbooked.push({ id: t.id, name: t.name });
      }
    }
    return NextResponse.json({ trainees: unbooked });
  }

  return NextResponse.json({
    trainees: trainees.map((t) => {
      const tt = t as typeof t & { status?: string; email?: string };
      return {
        id: t.id,
        name: t.name,
        email: tt.email ?? null,
        isRecurring: t.isRecurring,
        preferredDay: t.preferredDay,
        preferredTime: t.preferredTime,
        isActive: t.isActive,
        status: tt.status ?? (t.isActive ? "active" : "deactivated"),
      };
    }),
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
    const { auth, store, tx } = getContainer();
    const profile = await auth.updateTrainee(id, updates);

    if (updates.isActive === false) {
      const allBookings = await store.getAllBookings();
      const active = allBookings.filter(
        (b) => b.traineeId === id && b.status === "confirmed"
      );
      for (const b of active) {
        await tx.cancel(b.id, id, { bypass: true });
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
