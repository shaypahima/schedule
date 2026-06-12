import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockJwtSession = vi.fn();
const mockLoadProfile = vi.fn();

vi.mock("@/lib/services/jwt-session", () => ({
  getJwtSession: (req: NextRequest) => mockJwtSession(req),
}));

vi.mock("@/lib/auth/profile-repo", () => ({
  loadProfile: (id: string) => mockLoadProfile(id),
}));

process.env.MOCK_SERVICES = "true";

import { PATCH } from "../route";
import { getContainer, resetContainer } from "@/lib/services";
import { MockAuthService } from "@/lib/supabase/auth-service";
import type { Profile as AuthProfile } from "@/lib/auth/profile-repo";

const coach: AuthProfile = {
  userId: "c1",
  email: "coach@example.com",
  phone: null,
  name: "Coach",
  role: "coach",
  status: "active",
  hasIntro: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const patchReq = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/admin/trainees", {
    method: "PATCH",
    headers: { authorization: "Bearer jwt", "content-type": "application/json" },
    body: JSON.stringify(body),
  });

function seedTrainee(id: string, name: string) {
  const { auth } = getContainer();
  (auth as MockAuthService)._seedTrainee({
    id,
    name,
    role: "trainee",
    isRecurring: false,
    preferredDay: null,
    preferredTime: null,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  });
}

async function bookSlotFor(traineeId: string, slotId: string, date: string) {
  const { store, bookings } = getContainer();
  if (!(await store.getSlot(slotId))) {
    store.upsertSlot({
      id: slotId,
      date,
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
  }
  const r = await bookings.book(traineeId, slotId, { bypass: true });
  if (!r.ok) throw new Error(`setup booking failed: ${r.error}`);
  return r.booking.id;
}

describe("PATCH /api/admin/trainees (deactivation cascade)", () => {
  beforeEach(() => {
    resetContainer();
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockResolvedValue(coach);
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("deactivating a trainee cancels their confirmed bookings", async () => {
    seedTrainee("t1", "Dana");
    const b1 = await bookSlotFor("t1", "slot-a", "2026-07-01");
    const b2 = await bookSlotFor("t1", "slot-b", "2026-07-02");

    const res = await PATCH(patchReq({ id: "t1", isActive: false }));
    expect(res.status).toBe(200);

    const { store } = getContainer();
    expect((await store.getBooking(b1))?.status).toBe("cancelled");
    expect((await store.getBooking(b2))?.status).toBe("cancelled");
  });

  it("cascade frees the slot's capacity", async () => {
    seedTrainee("t1", "Dana");
    await bookSlotFor("t1", "slot-a", "2026-07-01");

    await PATCH(patchReq({ id: "t1", isActive: false }));

    const { store } = getContainer();
    expect((await store.getSlot("slot-a"))?.currentBookings).toBe(0);
  });

  it("does not touch other trainees' bookings in the same slot", async () => {
    seedTrainee("t1", "Dana");
    seedTrainee("t2", "Noa");
    await bookSlotFor("t1", "slot-a", "2026-07-01");
    const other = await bookSlotFor("t2", "slot-a", "2026-07-01");

    await PATCH(patchReq({ id: "t1", isActive: false }));

    const { store } = getContainer();
    expect((await store.getBooking(other))?.status).toBe("confirmed");
    expect((await store.getSlot("slot-a"))?.currentBookings).toBe(1);
  });

  it("re-activating (isActive: true) leaves bookings alone", async () => {
    seedTrainee("t1", "Dana");
    const b1 = await bookSlotFor("t1", "slot-a", "2026-07-01");

    const res = await PATCH(patchReq({ id: "t1", isActive: true }));
    expect(res.status).toBe(200);

    const { store } = getContainer();
    expect((await store.getBooking(b1))?.status).toBe("confirmed");
  });

  it("returns 403 for non-coach caller", async () => {
    mockLoadProfile.mockResolvedValue({ ...coach, userId: "t9", role: "trainee" });
    const res = await PATCH(patchReq({ id: "t1", isActive: false }));
    expect(res.status).toBe(403);
  });
});
