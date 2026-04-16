import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/route-guard";
import { getContainer } from "@/lib/services";

/** Admin: update slot capacity or lockout override */
export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { slotId, date, startTime, capacity, lockoutOverride } = await request.json();
  const { store } = getContainer();

  let slot = slotId ? store.getSlot(slotId) : undefined;

  // If slot doesn't exist yet, create it
  if (!slot && date && startTime) {
    const id = `slot-${date}-${startTime}`;
    slot = {
      id,
      date,
      startTime,
      capacity: capacity ?? 2,
      lockoutOverride: lockoutOverride ?? false,
      currentBookings: 0,
    };
    store.upsertSlot(slot);
    return NextResponse.json(slot);
  }

  if (!slot) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }

  const updated = {
    ...slot,
    ...(capacity !== undefined && { capacity }),
    ...(lockoutOverride !== undefined && { lockoutOverride }),
  };
  store.upsertSlot(updated);
  return NextResponse.json(updated);
}
