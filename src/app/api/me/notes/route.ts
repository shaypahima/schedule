import { NextRequest, NextResponse } from "next/server";
import { requireActiveTrainee } from "@/lib/auth/require";
import { listVisibleNotesForTrainee } from "@/lib/services/notes-repo";

export async function GET(request: NextRequest) {
  const r = await requireActiveTrainee(request);
  if ("error" in r) return r.error;

  const limit = parseInt(
    new URL(request.url).searchParams.get("limit") ?? "10",
    10
  );
  const notes = await listVisibleNotesForTrainee(r.trainee.userId, limit);
  return NextResponse.json({ notes });
}
