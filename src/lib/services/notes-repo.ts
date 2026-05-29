import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { CoachNote } from "@/lib/types";
import { isPgDriver, pgQuery } from "@/lib/pg/client";

function admin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function mapNote(row: Record<string, unknown>): CoachNote {
  return {
    id: row.id as string,
    traineeId: row.trainee_id as string,
    body: row.body as string,
    visibleToTrainee: row.visible_to_trainee as boolean,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export async function listNotesForTrainee(traineeId: string): Promise<CoachNote[]> {
  if (isPgDriver()) {
    const rows = await pgQuery<Record<string, unknown>>(
      "select * from coach_notes where trainee_id = $1 order by created_at desc",
      [traineeId],
    );
    return rows.map(mapNote);
  }
  const { data, error } = await admin()
    .from("coach_notes")
    .select("*")
    .eq("trainee_id", traineeId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listNotesForTrainee failed: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapNote(r));
}

export async function listVisibleNotesForTrainee(
  traineeId: string,
  limit = 10
): Promise<CoachNote[]> {
  if (isPgDriver()) {
    const rows = await pgQuery<Record<string, unknown>>(
      `select * from coach_notes where trainee_id = $1 and visible_to_trainee = true
         order by created_at desc limit $2`,
      [traineeId, limit],
    );
    return rows.map(mapNote);
  }
  const { data, error } = await admin()
    .from("coach_notes")
    .select("*")
    .eq("trainee_id", traineeId)
    .eq("visible_to_trainee", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listVisibleNotesForTrainee failed: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapNote(r));
}

export async function createNote(input: {
  traineeId: string;
  body: string;
  visibleToTrainee: boolean;
}): Promise<CoachNote> {
  const trimmed = input.body.trim();
  if (!trimmed) throw new Error("body required");
  if (isPgDriver()) {
    const rows = await pgQuery<Record<string, unknown>>(
      `insert into coach_notes (trainee_id, body, visible_to_trainee)
         values ($1, $2, $3) returning *`,
      [input.traineeId, trimmed, input.visibleToTrainee],
    );
    return mapNote(rows[0]);
  }
  const { data, error } = await admin()
    .from("coach_notes")
    .insert({
      trainee_id: input.traineeId,
      body: trimmed,
      visible_to_trainee: input.visibleToTrainee,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`createNote failed: ${error?.message}`);
  return mapNote(data);
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
  if (isPgDriver()) {
    const sets: string[] = ["updated_at = now()"];
    const params: unknown[] = [];
    if (trimmedBody !== undefined) sets.push(`body = $${params.push(trimmedBody)}`);
    if (patch.visibleToTrainee !== undefined)
      sets.push(`visible_to_trainee = $${params.push(patch.visibleToTrainee)}`);
    params.push(id);
    const rows = await pgQuery<Record<string, unknown>>(
      `update coach_notes set ${sets.join(", ")} where id = $${params.length} returning *`,
      params,
    );
    if (rows.length === 0) throw new Error("updateNote failed: not found");
    return mapNote(rows[0]);
  }
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (trimmedBody !== undefined) dbPatch.body = trimmedBody;
  if (patch.visibleToTrainee !== undefined) {
    dbPatch.visible_to_trainee = patch.visibleToTrainee;
  }
  const { data, error } = await admin()
    .from("coach_notes")
    .update(dbPatch)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) throw new Error(`updateNote failed: ${error?.message}`);
  return mapNote(data);
}

export async function deleteNote(id: string): Promise<void> {
  if (isPgDriver()) {
    await pgQuery("delete from coach_notes where id = $1", [id]);
    return;
  }
  const { error } = await admin().from("coach_notes").delete().eq("id", id);
  if (error) throw new Error(`deleteNote failed: ${error.message}`);
}
