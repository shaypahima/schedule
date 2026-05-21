import { NextRequest, NextResponse } from "next/server";
import { requireCoach } from "@/lib/auth/require";
import { listNotesForTrainee, createNote } from "@/lib/services/notes-repo";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;
  const { id } = await params;
  const notes = await listNotesForTrainee(id);
  return NextResponse.json({ notes });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;
  const { id } = await params;
  const body = (await request.json()) as {
    body?: string;
    visibleToTrainee?: boolean;
  };
  if (typeof body.body !== "string" || body.body.trim().length === 0) {
    return NextResponse.json({ error: "BODY_REQUIRED" }, { status: 400 });
  }
  try {
    const note = await createNote({
      traineeId: id,
      body: body.body,
      visibleToTrainee: body.visibleToTrainee ?? false,
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: "DB_ERROR", message: (e as Error).message },
      { status: 500 }
    );
  }
}
