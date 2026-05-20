import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { todayIL, isLockedOut } from "@/lib/services/israel-time";
import { getJwtSession } from "@/lib/services/jwt-session";
import { findProfile } from "@/lib/services/profile-repo";

const LOCKOUT_HOURS = 7;

async function authedTrainee(request: NextRequest) {
  const session = await getJwtSession(request);
  if (!session) return null;
  const profile = await findProfile(session.userId);
  if (!profile) return null;
  return profile;
}

export async function POST(request: NextRequest) {
  const profile = await authedTrainee(request);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slotId } = await request.json();
  if (!slotId) return NextResponse.json({ error: "slotId required" }, { status: 400 });

  const { tx } = getContainer();
  const result = await tx.book(profile.id, slotId, { traineeName: profile.name });
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 409 });
  return NextResponse.json({ booking: result.booking }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const profile = await authedTrainee(request);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { store, limits } = getContainer();
  const bookings = await store.getTraineeBookings(profile.id);

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

  const remainingEdits = await limits.getRemainingEdits(profile.id, todayIL());
  return NextResponse.json({ bookings: enriched, remainingEdits });
}

export async function PATCH(request: NextRequest) {
  const profile = await authedTrainee(request);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bookingId, newSlotId } = await request.json();
  if (!bookingId || !newSlotId) {
    return NextResponse.json({ error: "bookingId and newSlotId required" }, { status: 400 });
  }

  const { tx } = getContainer();
  const result = await tx.reschedule(bookingId, profile.id, newSlotId, { traineeName: profile.name });
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 409 });
  return NextResponse.json({ booking: result.booking });
}

export async function DELETE(request: NextRequest) {
  const profile = await authedTrainee(request);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bookingId } = await request.json();
  if (!bookingId) return NextResponse.json({ error: "bookingId required" }, { status: 400 });

  const { tx } = getContainer();
  const result = await tx.cancel(bookingId, profile.id);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 409 });
  return NextResponse.json({ success: true });
}
