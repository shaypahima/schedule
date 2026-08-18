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

import { POST, DELETE } from "../route";
import { GET as GET_MY_WAITLIST } from "@/app/api/me/waitlist/route";
import { getContainer, resetContainer } from "@/lib/services";
import { MockBookingStore } from "@/lib/services/booking-store";
import type { Profile } from "@/lib/auth/profile-repo";

/** Test container always runs the Mock store (MOCK_SERVICES=true). */
const mockStore = () => getContainer().store as MockBookingStore;

const trainee: Profile = {
  userId: "t1",
  email: "t1@example.com",
  phone: null,
  name: "מתאמן",
  role: "trainee",
  status: "active",
  hasIntro: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const FULL = {
  id: "slot-full",
  date: "2030-01-06",
  startTime: "10:00",
  capacity: 2,
  lockoutOverride: false,
  currentBookings: 2,
};

function req(method: string, slotId: string) {
  return new NextRequest(`http://localhost/api/slots/${slotId}/waitlist`, {
    method,
    headers: { authorization: "Bearer jwt" },
  });
}

function params(slotId: string) {
  return { params: Promise.resolve({ id: slotId }) };
}

describe("slot waitlist routes", () => {
  beforeEach(() => {
    resetContainer();
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(trainee);
    mockStore().addSlot({ ...FULL });
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("trainee joins a full slot, sees it under /api/me/waitlist, then leaves", async () => {
    const join = await POST(req("POST", FULL.id), params(FULL.id));
    expect(join.status).toBe(201);

    const list = await GET_MY_WAITLIST(
      new NextRequest("http://localhost/api/me/waitlist", {
        headers: { authorization: "Bearer jwt" },
      })
    );
    expect(list.status).toBe(200);
    expect((await list.json()).slotIds).toEqual([FULL.id]);

    const leave = await DELETE(req("DELETE", FULL.id), params(FULL.id));
    expect(leave.status).toBe(200);

    const after = await GET_MY_WAITLIST(
      new NextRequest("http://localhost/api/me/waitlist", {
        headers: { authorization: "Bearer jwt" },
      })
    );
    expect((await after.json()).slotIds).toEqual([]);
  });

  it("joining a slot with free capacity returns 409 NOT_FULL", async () => {
    mockStore().addSlot({ ...FULL, id: "slot-open", currentBookings: 1 });
    const res = await POST(req("POST", "slot-open"), params("slot-open"));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("NOT_FULL");
  });

  it("joining an unknown slot returns 404", async () => {
    const res = await POST(req("POST", "nope"), params("nope"));
    expect(res.status).toBe(404);
  });

  it("requires an active trainee", async () => {
    mockJwtSession.mockResolvedValue(null);
    const res = await POST(req("POST", FULL.id), params(FULL.id));
    expect(res.status).toBe(401);
  });
});
