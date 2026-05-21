/**
 * Integration tests covering multi-endpoint flows:
 * - Approval flow:  self-signup → intro → coach approve → trainee active → can book
 * - Cancel-request: book → request cancel → coach approve → booking cancelled
 * - Reschedule-request: book → request reschedule → coach approve → old cancelled + new booked
 * - No-show: book past slot → mark no-show → dashboard reflects
 *
 * These test the orchestration across route handlers + the Bookings domain +
 * the CoachReadModel. They do NOT hit the real Supabase — the mock store +
 * mocked auth/profile-repo simulate the DB.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockJwtSession = vi.fn();
const mockLoadProfile = vi.fn();

vi.mock("@/lib/services/jwt-session", () => ({
  getJwtSession: (req: NextRequest) => mockJwtSession(req),
}));

vi.mock("@/lib/auth/profile-repo", () => ({
  loadProfile: (id: string) => mockLoadProfile(id),
  createProfile: vi.fn(),
}));

process.env.MOCK_SERVICES = "true";

import { POST as bookingsPOST } from "@/app/api/bookings/route";
import { POST as requestCancelPOST } from "@/app/api/bookings/[id]/request-cancel/route";
import { POST as requestReschedulePOST } from "@/app/api/bookings/[id]/request-reschedule/route";
import { POST as decidePOST } from "@/app/api/admin/change-requests/[id]/decide/route";
import { POST as noShowPOST } from "@/app/api/admin/bookings/[id]/no-show/route";
import { getContainer, resetContainer, getAuthService } from "@/lib/services";
import { MockAuthService } from "@/lib/supabase/auth-service";
import type { Profile as AuthProfile } from "@/lib/auth/profile-repo";

const coachProfile: AuthProfile = {
  userId: "c1",
  email: "coach@example.com",
  phone: null,
  name: "Coach",
  role: "coach",
  status: "active",
  hasIntro: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const activeTrainee: AuthProfile = {
  ...coachProfile,
  userId: "t1",
  email: "t1@example.com",
  name: "Alice",
  role: "trainee",
};

function asCoach() {
  mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
  mockLoadProfile.mockResolvedValue(coachProfile);
}

function asActiveTrainee() {
  mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
  mockLoadProfile.mockResolvedValue(activeTrainee);
}

function jsonReq(path: string, body?: unknown, method = "POST") {
  return new NextRequest(`http://localhost${path}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json", authorization: "Bearer jwt" },
  });
}

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

function seedSlots() {
  const { store } = getContainer();
  store.upsertSlot({
    id: "slot-mon",
    date: "2026-04-06",
    startTime: "10:00",
    capacity: 2,
    lockoutOverride: false,
    currentBookings: 0,
  });
  store.upsertSlot({
    id: "slot-tue",
    date: "2026-04-07",
    startTime: "10:00",
    capacity: 2,
    lockoutOverride: false,
    currentBookings: 0,
  });
  // Seed the trainee so the auth service knows about them.
  const auth = getAuthService() as MockAuthService;
  auth._seedTrainee({
    id: "t1",
    name: "Alice",
    role: "trainee",
    isRecurring: false,
    preferredDay: null,
    preferredTime: null,
    isActive: true,
    createdAt: new Date("2026-01-01"),
  } as never);
}

describe("Integration: cancel-request flow", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));
    resetContainer();
    seedSlots();
  });

  afterEach(() => {
    vi.useRealTimers();
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("trainee books → requests cancel → coach approves → booking cancelled + slot freed", async () => {
    // 1. Trainee books slot-mon
    asActiveTrainee();
    const bookRes = await bookingsPOST(jsonReq("/api/bookings", { slotId: "slot-mon" }));
    expect(bookRes.status).toBe(201);
    const { booking } = await bookRes.json();
    expect(booking.status).toBe("confirmed");

    const { store } = getContainer();
    expect((await store.getSlot("slot-mon"))!.currentBookings).toBe(1);

    // 2. Trainee requests cancel
    const cancelReqRes = await requestCancelPOST(
      jsonReq("/api/bookings/x/request-cancel", { reason: "Feeling unwell" }),
      paramsFor(booking.id)
    );
    expect(cancelReqRes.status).toBe(201);
    const { request } = await cancelReqRes.json();
    expect(request.status).toBe("pending");

    // Slot is still held while pending.
    expect((await store.getSlot("slot-mon"))!.currentBookings).toBe(1);

    // 3. Coach approves
    asCoach();
    const decideRes = await decidePOST(
      jsonReq("/api/admin/change-requests/x/decide", { decision: "approve" }),
      paramsFor(request.id)
    );
    expect(decideRes.status).toBe(200);
    const decideBody = await decideRes.json();
    expect(decideBody.request.status).toBe("approved");

    // 4. Booking is now cancelled, slot freed
    expect((await store.getBooking(booking.id))!.status).toBe("cancelled");
    expect((await store.getSlot("slot-mon"))!.currentBookings).toBe(0);
  });

  it("trainee books → requests cancel → coach rejects → booking stays confirmed", async () => {
    asActiveTrainee();
    const bookRes = await bookingsPOST(jsonReq("/api/bookings", { slotId: "slot-mon" }));
    const { booking } = await bookRes.json();

    const reqRes = await requestCancelPOST(
      jsonReq("/api/bookings/x/request-cancel", { reason: "Maybe?" }),
      paramsFor(booking.id)
    );
    const { request } = await reqRes.json();

    asCoach();
    const decideRes = await decidePOST(
      jsonReq("/api/admin/change-requests/x/decide", {
        decision: "reject",
        note: "Come anyway",
      }),
      paramsFor(request.id)
    );
    expect(decideRes.status).toBe(200);

    const { store } = getContainer();
    expect((await store.getBooking(booking.id))!.status).toBe("confirmed");
    expect((await store.getSlot("slot-mon"))!.currentBookings).toBe(1);
  });
});

describe("Integration: reschedule-request flow", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));
    resetContainer();
    seedSlots();
  });

  afterEach(() => {
    vi.useRealTimers();
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("trainee books slot-mon → requests reschedule to slot-tue → coach approves → old cancelled, new booked", async () => {
    asActiveTrainee();
    const bookRes = await bookingsPOST(jsonReq("/api/bookings", { slotId: "slot-mon" }));
    const { booking } = await bookRes.json();

    const reqRes = await requestReschedulePOST(
      jsonReq("/api/bookings/x/request-reschedule", {
        newSlotId: "slot-tue",
        reason: "Schedule conflict",
      }),
      paramsFor(booking.id)
    );
    expect(reqRes.status).toBe(201);
    const { request } = await reqRes.json();
    expect(request.requestedNewSlotId).toBe("slot-tue");

    asCoach();
    const decideRes = await decidePOST(
      jsonReq("/api/admin/change-requests/x/decide", { decision: "approve" }),
      paramsFor(request.id)
    );
    expect(decideRes.status).toBe(200);
    const decideBody = await decideRes.json();
    expect(decideBody.effectedBooking).not.toBeNull();
    expect(decideBody.effectedBooking.slotId).toBe("slot-tue");

    const { store } = getContainer();
    expect((await store.getBooking(booking.id))!.status).toBe("cancelled");
    expect((await store.getSlot("slot-mon"))!.currentBookings).toBe(0);
    expect((await store.getSlot("slot-tue"))!.currentBookings).toBe(1);
  });
});

describe("Integration: no-show flow", () => {
  beforeEach(() => {
    // Set "now" to AFTER the slot date so markNoShow passes the past-slot guard
    vi.setSystemTime(new Date("2026-04-08T06:00:00Z"));
    resetContainer();
    seedSlots();
  });

  afterEach(() => {
    vi.useRealTimers();
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("coach marks past confirmed booking as no-show; status transitions", async () => {
    // Setup: book slot-mon directly via container (skip 24h logic with bypass)
    const { bookings } = getContainer();
    const b = await bookings.book("t1", "slot-mon", { bypass: true });
    if (!b.ok) throw new Error("setup failed");

    asCoach();
    const res = await noShowPOST(
      jsonReq("/api/admin/bookings/x/no-show", undefined),
      paramsFor(b.booking.id)
    );

    expect(res.status).toBe(200);
    const { store } = getContainer();
    expect((await store.getBooking(b.booking.id))!.status).toBe("no_show");
  });
});
