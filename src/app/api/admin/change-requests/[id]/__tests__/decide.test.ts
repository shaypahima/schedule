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

import { POST as decide } from "../decide/route";
import { getContainer, resetContainer } from "@/lib/services";
import type { Profile } from "@/lib/auth/profile-repo";

const coach: Profile = {
  userId: "c1",
  email: "coach@example.com",
  phone: null,
  name: "Coach",
  role: "coach",
  status: "active",
  hasIntro: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const trainee: Profile = {
  ...coach,
  userId: "t1",
  email: "t1@example.com",
  name: "Alice",
  role: "trainee",
};

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/change-requests/x/decide", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", authorization: "Bearer jwt" },
  });
}

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

async function setupRequest(
  kind: "cancel" | "reschedule" = "cancel"
): Promise<string> {
  const { store, bookings } = getContainer();
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
  const b = await bookings.book("t1", "slot-mon");
  if (!b.ok) throw new Error("setup failed");
  const r =
    kind === "cancel"
      ? await bookings.requestCancel(b.booking.id, "t1", "Sick")
      : await bookings.requestReschedule(b.booking.id, "t1", "slot-tue", "Move");
  if (!r.ok) throw new Error("setup request failed");
  return r.request.id;
}

describe("POST /api/admin/change-requests/:id/decide", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));
    resetContainer();
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockResolvedValue(coach);
  });

  afterEach(() => {
    vi.useRealTimers();
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("approves cancel: returns 200, request status approved, booking cancelled", async () => {
    const reqId = await setupRequest("cancel");

    const res = await decide(makeReq({ decision: "approve" }), paramsFor(reqId));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.request.status).toBe("approved");
    expect(body.request.decidedBy).toBe("c1");
  });

  it("approves reschedule: returns 200 + effectedBooking on new slot", async () => {
    const reqId = await setupRequest("reschedule");

    const res = await decide(makeReq({ decision: "approve" }), paramsFor(reqId));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.request.status).toBe("approved");
    expect(body.effectedBooking).not.toBeNull();
    expect(body.effectedBooking.slotId).toBe("slot-tue");
  });

  it("rejects: returns 200, request status rejected, booking stays confirmed", async () => {
    const reqId = await setupRequest("cancel");

    const res = await decide(
      makeReq({ decision: "reject", note: "Come anyway" }),
      paramsFor(reqId)
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.request.status).toBe("rejected");
    expect(body.request.decisionNote).toBe("Come anyway");
  });

  it("400 when decision is missing or invalid", async () => {
    const reqId = await setupRequest("cancel");
    const res = await decide(makeReq({ decision: "maybe" }), paramsFor(reqId));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("DECISION_REQUIRED");
  });

  it("403 when caller is not coach", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(trainee);
    const reqId = await setupRequest("cancel");
    const res = await decide(makeReq({ decision: "approve" }), paramsFor(reqId));
    expect(res.status).toBe(403);
  });

  it("404 when request not found", async () => {
    const res = await decide(makeReq({ decision: "approve" }), paramsFor("ghost"));
    expect(res.status).toBe(404);
  });

  it("409 when request already decided", async () => {
    const reqId = await setupRequest("cancel");
    await decide(makeReq({ decision: "approve" }), paramsFor(reqId));
    const res2 = await decide(makeReq({ decision: "approve" }), paramsFor(reqId));
    expect(res2.status).toBe(409);
    expect((await res2.json()).error).toBe("REQUEST_NOT_PENDING");
  });
});
