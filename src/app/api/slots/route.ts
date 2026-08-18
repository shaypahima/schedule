import { NextRequest, NextResponse } from "next/server";
import { requireCoachOrActiveTrainee } from "@/lib/auth/require";
import { getDaySlots } from "@/lib/slots/board";

export async function GET(request: NextRequest) {
  const r = await requireCoachOrActiveTrainee(request);
  if ("error" in r) return r.error;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date query param required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  const slots = await getDaySlots(date);

  return NextResponse.json({ date, slots });
}
