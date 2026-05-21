import { NextRequest, NextResponse } from "next/server";
import { getContainer } from "@/lib/services";
import { requireCoach } from "@/lib/auth/require";

/** Admin: update slot capacity or lockout override */
export async function PATCH(request: NextRequest) {
  const r = await requireCoach(request);
  if ("error" in r) return r.error;

  const { slotId, date, startTime, capacity, lockoutOverride } = await request.json();
  const { store } = getContainer();

  let slot = slotId ? await store.getSlot(slotId) : undefined;

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
    await store.upsertSlot(slot);
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
  await store.upsertSlot(updated);
  return NextResponse.json(updated);
}
