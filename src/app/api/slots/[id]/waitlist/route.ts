import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireActiveTrainee } from "@/lib/auth/require";
import type { WaitlistError_Code } from "@/lib/services/waitlist";

const STATUS: Record<WaitlistError_Code, number> = {
  NOT_FOUND: 404,
  NOT_FULL: 409,
  PAST_SLOT: 409,
};

/** Join the waitlist of a full slot (ADR-0012). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const { id } = await params;
  const { waitlist } = getContainer();
  const result = await waitlist.join(r.trainee.userId, id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: STATUS[result.error] }
    );
  }
  return NextResponse.json({ joined: true }, { status: 201 });
}

/** Leave the waitlist. Idempotent — leaving when not on it is a no-op. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const { id } = await params;
  const { waitlist } = getContainer();
  await waitlist.leave(r.trainee.userId, id);
  return NextResponse.json({ left: true });
}
