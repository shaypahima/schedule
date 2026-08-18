import { CoachNote } from "@/lib/types";
import { pickAdapter } from "./driver";
import { PgNotesRepo } from "@/lib/pg/notes-repo";
import { SupabaseNotesRepo } from "@/lib/supabase/notes-repo";

/**
 * NotesRepo — coach_notes persistence. Adapters carry only SQL/SDK;
 * validation and trimming happen here, above the seam.
 */
export interface NotesRepo {
  listForTrainee(traineeId: string): Promise<CoachNote[]>;
  listVisibleForTrainee(traineeId: string, limit: number): Promise<CoachNote[]>;
  create(input: { traineeId: string; body: string; visibleToTrainee: boolean }): Promise<CoachNote>;
  update(id: string, patch: { body?: string; visibleToTrainee?: boolean }): Promise<CoachNote>;
  delete(id: string): Promise<void>;
}

let repo: NotesRepo | undefined;

function getRepo(): NotesRepo {
  return (repo ??= pickAdapter<NotesRepo>({
    pg: () => new PgNotesRepo(),
    supabase: () => new SupabaseNotesRepo(),
  }));
}

/** Test seam: override the adapter (pass undefined to restore driver selection). */
export function setNotesRepo(override: NotesRepo | undefined): void {
  repo = override;
}

export async function listNotesForTrainee(traineeId: string): Promise<CoachNote[]> {
  return getRepo().listForTrainee(traineeId);
}

export async function listVisibleNotesForTrainee(
  traineeId: string,
  limit = 10
): Promise<CoachNote[]> {
  return getRepo().listVisibleForTrainee(traineeId, limit);
}

export async function createNote(input: {
  traineeId: string;
  body: string;
  visibleToTrainee: boolean;
}): Promise<CoachNote> {
  const trimmed = input.body.trim();
  if (!trimmed) throw new Error("body required");
  return getRepo().create({ ...input, body: trimmed });
}

export async function updateNote(
  id: string,
  patch: { body?: string; visibleToTrainee?: boolean }
): Promise<CoachNote> {
  let trimmedBody: string | undefined;
  if (patch.body !== undefined) {
    trimmedBody = patch.body.trim();
    if (!trimmedBody) throw new Error("body cannot be empty");
  }
  return getRepo().update(id, { body: trimmedBody, visibleToTrainee: patch.visibleToTrainee });
}

export async function deleteNote(id: string): Promise<void> {
  return getRepo().delete(id);
}
