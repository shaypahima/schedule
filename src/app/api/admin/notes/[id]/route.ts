import { NextRequest, NextResponse } from "next/server";
import { requireCoach } from "@/lib/auth/require";
import { updateNote, deleteNote } from "@/lib/services/notes-repo";

export async function PATCH(
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
  try {
    const note = await updateNote(id, body);
    return NextResponse.json({ note });
  } catch (e) {
    return NextResponse.json(
      { error: "UPDATE_FAILED", message: (e as Error).message },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;
  const { id } = await params;
  try {
    await deleteNote(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: "DELETE_FAILED", message: (e as Error).message },
      { status: 500 }
    );
  }
}
