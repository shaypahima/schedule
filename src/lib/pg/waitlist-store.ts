import type { WaitlistEntry, WaitlistStore } from "@/lib/services/waitlist";
import { mapWaitlistRow } from "@/lib/services/row-mappers";
import { pgQuery } from "./client";

/** Native-Postgres WaitlistStore (local dev). */
export class PgWaitlistStore implements WaitlistStore {
  async add(slotId: string, traineeId: string): Promise<WaitlistEntry> {
    const rows = await pgQuery<Record<string, unknown>>(
      `insert into slot_waitlist (slot_id, trainee_id)
         values ($1, $2)
         on conflict (slot_id, trainee_id) do update set slot_id = excluded.slot_id
         returning *`,
      [slotId, traineeId],
    );
    return mapWaitlistRow(rows[0]);
  }

  async remove(slotId: string, traineeId: string): Promise<void> {
    await pgQuery(
      "delete from slot_waitlist where slot_id = $1 and trainee_id = $2",
      [slotId, traineeId],
    );
  }

  async listTraineeIdsForSlot(slotId: string): Promise<string[]> {
    const rows = await pgQuery<{ trainee_id: string }>(
      "select trainee_id from slot_waitlist where slot_id = $1 order by created_at",
      [slotId],
    );
    return rows.map((r) => r.trainee_id);
  }

  async listSlotIdsForTrainee(traineeId: string): Promise<string[]> {
    const rows = await pgQuery<{ slot_id: string }>(
      "select slot_id from slot_waitlist where trainee_id = $1",
      [traineeId],
    );
    return rows.map((r) => r.slot_id);
  }

  async countsForSlots(slotIds: string[]): Promise<Record<string, number>> {
    if (slotIds.length === 0) return {};
    const rows = await pgQuery<{ slot_id: string; n: string }>(
      "select slot_id, count(*) as n from slot_waitlist where slot_id = any($1) group by slot_id",
      [slotIds],
    );
    const out: Record<string, number> = {};
    for (const r of rows) out[r.slot_id] = Number(r.n);
    return out;
  }
}
