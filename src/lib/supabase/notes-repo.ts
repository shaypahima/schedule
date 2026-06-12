import { CoachNote } from "@/lib/types";
import type { NotesRepo } from "@/lib/services/notes-repo";
import { mapCoachNoteRow } from "@/lib/services/row-mappers";
import { getSupabaseAdminClient } from "./client";

/** Supabase-backed NotesRepo. */
export class SupabaseNotesRepo implements NotesRepo {
  async listForTrainee(traineeId: string): Promise<CoachNote[]> {
    const { data, error } = await getSupabaseAdminClient()
      .from("coach_notes")
      .select("*")
      .eq("trainee_id", traineeId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`listNotesForTrainee failed: ${error.message}`);
    return (data ?? []).map((r: Record<string, unknown>) => mapCoachNoteRow(r));
  }

  async listVisibleForTrainee(traineeId: string, limit: number): Promise<CoachNote[]> {
    const { data, error } = await getSupabaseAdminClient()
      .from("coach_notes")
      .select("*")
      .eq("trainee_id", traineeId)
      .eq("visible_to_trainee", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`listVisibleNotesForTrainee failed: ${error.message}`);
    return (data ?? []).map((r: Record<string, unknown>) => mapCoachNoteRow(r));
  }

  async create(input: {
    traineeId: string;
    body: string;
    visibleToTrainee: boolean;
  }): Promise<CoachNote> {
    const { data, error } = await getSupabaseAdminClient()
      .from("coach_notes")
      .insert({
        trainee_id: input.traineeId,
        body: input.body,
        visible_to_trainee: input.visibleToTrainee,
      })
      .select("*")
      .single();
    if (error || !data) throw new Error(`createNote failed: ${error?.message}`);
    return mapCoachNoteRow(data);
  }

  async update(
    id: string,
    patch: { body?: string; visibleToTrainee?: boolean },
  ): Promise<CoachNote> {
    const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.body !== undefined) dbPatch.body = patch.body;
    if (patch.visibleToTrainee !== undefined) {
      dbPatch.visible_to_trainee = patch.visibleToTrainee;
    }
    const { data, error } = await getSupabaseAdminClient()
      .from("coach_notes")
      .update(dbPatch)
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw new Error(`updateNote failed: ${error?.message}`);
    return mapCoachNoteRow(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await getSupabaseAdminClient().from("coach_notes").delete().eq("id", id);
    if (error) throw new Error(`deleteNote failed: ${error.message}`);
  }
}
