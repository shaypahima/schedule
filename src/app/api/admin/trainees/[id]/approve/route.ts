import { NextRequest, NextResponse } from "next/server";
import { requireCoach } from "@/lib/auth/require";
import { approveTrainee } from "@/lib/coach/approvals";

const STATUS: Record<string, number> = {
  NOT_FOUND: 404,
  NOT_A_TRAINEE: 400,
  NOT_PENDING: 409,
  INTRO_MISSING: 409,
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { id } = await params;
  const result = await approveTrainee(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: STATUS[result.error] });
  }

  return NextResponse.json({ ok: true });
}
