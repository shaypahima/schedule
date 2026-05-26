import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireActiveTrainee } from "@/lib/auth/require";

interface Body {
  feedback?: Record<string, unknown> | null;
  coachNotes?: string | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const { bookingId } = await params;
  const { store, progress } = getContainer();

  const booking = await store.getBooking(bookingId);
  if (!booking || booking.traineeId !== r.trainee.userId) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Booking not found" },
      { status: 404 }
    );
  }

  const body = (await request.json()) as Body;
  // Trainee may only write feedback. Coach notes are coach-only (different route).
  const row = await progress.upsertSessionLog(bookingId, {
    feedback: body.feedback ?? null,
  });
  return NextResponse.json({ sessionLog: row });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const { bookingId } = await params;
  const { store, progress } = getContainer();

  const booking = await store.getBooking(bookingId);
  if (!booking || booking.traineeId !== r.trainee.userId) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Booking not found" },
      { status: 404 }
    );
  }

  const row = await progress.getSessionLog(bookingId);
  return NextResponse.json({ sessionLog: row ?? null });
}
