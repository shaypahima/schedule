import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireActiveTrainee } from "@/lib/auth/require";

/** Trainee dashboard view — booking-derived stats + most-recent visible note. */
export async function GET(request: NextRequest) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const { traineeRead } = getContainer();
  const view = await traineeRead.dashboard({
    userId: r.trainee.userId,
    createdAt: r.trainee.createdAt,
  });
  return NextResponse.json(view);
}
