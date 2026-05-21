import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireCoach } from "@/lib/auth/require";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { id } = await params;
  const body = (await request.json()) as {
    decision?: "approve" | "reject";
    note?: string;
  };

  if (body.decision !== "approve" && body.decision !== "reject") {
    return NextResponse.json(
      { error: "DECISION_REQUIRED", message: "decision must be 'approve' or 'reject'" },
      { status: 400 }
    );
  }

  const { bookings } = getContainer();
  const result = await bookings.decideRequest(
    id,
    r.coach.userId,
    body.decision,
    body.note?.trim() ?? undefined
  );
  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: result.error, message: result.message }, { status });
  }
  return NextResponse.json({
    request: result.request,
    effectedBooking: result.effectedBooking ?? null,
  });
}
