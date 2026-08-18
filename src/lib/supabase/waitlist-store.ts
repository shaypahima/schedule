import type { WaitlistEntry, WaitlistStore } from "@/lib/services/waitlist";
import { mapWaitlistRow } from "@/lib/services/row-mappers";
import { getSupabaseAdminClient } from "./client";

/** Supabase-backed WaitlistStore. */
export class SupabaseWaitlistStore implements WaitlistStore {
  async add(slotId: string, traineeId: string): Promise<WaitlistEntry> {
    const { data, error } = await getSupabaseAdminClient()
      .from("slot_waitlist")
      .upsert(
        { slot_id: slotId, trainee_id: traineeId },
        { onConflict: "slot_id,trainee_id" },
      )
      .select("*")
      .single();
    if (error || !data) throw new Error(`waitlist add failed: ${error?.message}`);
    return mapWaitlistRow(data);
  }

  async remove(slotId: string, traineeId: string): Promise<void> {
    const { error } = await getSupabaseAdminClient()
      .from("slot_waitlist")
      .delete()
      .eq("slot_id", slotId)
      .eq("trainee_id", traineeId);
    if (error) throw new Error(`waitlist remove failed: ${error.message}`);
  }

  async listTraineeIdsForSlot(slotId: string): Promise<string[]> {
    const { data, error } = await getSupabaseAdminClient()
      .from("slot_waitlist")
      .select("trainee_id")
      .eq("slot_id", slotId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`waitlist list failed: ${error.message}`);
    return (data ?? []).map((r: { trainee_id: string }) => r.trainee_id);
  }

  async listSlotIdsForTrainee(traineeId: string): Promise<string[]> {
    const { data, error } = await getSupabaseAdminClient()
      .from("slot_waitlist")
      .select("slot_id")
      .eq("trainee_id", traineeId);
    if (error) throw new Error(`waitlist list failed: ${error.message}`);
    return (data ?? []).map((r: { slot_id: string }) => r.slot_id);
  }

  async countsForSlots(slotIds: string[]): Promise<Record<string, number>> {
    if (slotIds.length === 0) return {};
    const { data, error } = await getSupabaseAdminClient()
      .from("slot_waitlist")
      .select("slot_id")
      .in("slot_id", slotIds);
    if (error) throw new Error(`waitlist counts failed: ${error.message}`);
    const out: Record<string, number> = {};
    for (const r of (data ?? []) as Array<{ slot_id: string }>) {
      out[r.slot_id] = (out[r.slot_id] ?? 0) + 1;
    }
    return out;
  }
}
