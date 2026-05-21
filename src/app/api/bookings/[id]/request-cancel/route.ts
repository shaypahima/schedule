import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireActiveTrainee } from "@/lib/auth/require";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const { id } = await params;
  const body = (await request.json()) as { reason?: string };
  const reason = (body.reason ?? "").trim();
  if (!reason) {
    return NextResponse.json({ error: "REASON_REQUIRED" }, { status: 400 });
  }

  const { bookings } = getContainer();
  const result = await bookings.requestCancel(id, r.trainee.userId, reason);
  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 409;
    return NextResponse.json({ error: result.error, message: result.message }, { status });
  }
  return NextResponse.json({ request: result.request }, { status: 201 });
}
