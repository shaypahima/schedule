import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockJwtSession = vi.fn();
const mockFindProfile = vi.fn();

vi.mock("@/lib/services/jwt-session", () => ({
  getJwtSession: (req: NextRequest) => mockJwtSession(req),
}));

vi.mock("@/lib/services/profile-repo", () => ({
  findProfile: (id: string) => mockFindProfile(id),
  createProfile: vi.fn(),
}));

process.env.MOCK_SERVICES = "true";

import { POST, DELETE, GET } from "../route";
import { getContainer, resetContainer } from "@/lib/services";

const adminProfile = {
  id: "coach-1",
  email: "coach@example.com",
  name: "Coach",
  role: "admin" as const,
};

const traineeProfile = {
  id: "t1",
  email: "t1@example.com",
  name: "Alice",
  role: "trainee" as const,
};

function asAdmin() {
  mockJwtSession.mockResolvedValue({ userId: "coach-1", email: "coach@example.com" });
  mockFindProfile.mockResolvedValue(adminProfile);
}

function asTrainee() {
  mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
  mockFindProfile.mockResolvedValue(traineeProfile);
}

function makeRequest(body: Record<string, unknown>, method = "POST") {
  return new NextRequest("http://localhost/api/admin/bookings", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", authorization: "Bearer jwt" },
  });
}

describe("POST /api/admin/bookings", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));
    resetContainer();
    const { store } = getContainer();
    store.upsertSlot({
      id: "slot-6",
      date: "2026-04-06",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    mockJwtSession.mockReset();
    mockFindProfile.mockReset();
  });

  it("returns 403 for non-admin", async () => {
    asTrainee();
    const res = await POST(
      makeRequest({ traineeId: "t1", slotId: "slot-6", traineeName: "Alice" })
    );
    expect(res.status).toBe(403);
  });

  it("returns 401 for unauthenticated", async () => {
    mockJwtSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ traineeId: "t1", slotId: "slot-6" }));
    expect(res.status).toBe(401);
  });

  it("admin books trainee into slot", async () => {
    asAdmin();
    const res = await POST(
      makeRequest({ traineeId: "t1", slotId: "slot-6", traineeName: "Alice" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.booking.traineeId).toBe("t1");
    expect(body.booking.slotId).toBe("slot-6");
    expect(body.booking.status).toBe("confirmed");
  });
});

describe("DELETE /api/admin/bookings", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));
    resetContainer();
    const { store } = getContainer();
    store.upsertSlot({
      id: "slot-6",
      date: "2026-04-06",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    mockJwtSession.mockReset();
    mockFindProfile.mockReset();
  });

  it("admin cancels a booking", async () => {
    asAdmin();

    const bookRes = await POST(
      makeRequest({ traineeId: "t1", slotId: "slot-6", traineeName: "Alice" })
    );
    const { booking } = await bookRes.json();

    const res = await DELETE(makeRequest({ bookingId: booking.id }, "DELETE"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const { store } = getContainer();
    expect(store.getBooking(booking.id)!.status).toBe("cancelled");
  });
});

describe("GET /api/admin/bookings", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));
    resetContainer();
    const { store } = getContainer();
    store.upsertSlot({
      id: "slot-6",
      date: "2026-04-06",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    mockJwtSession.mockReset();
    mockFindProfile.mockReset();
  });

  it("returns all confirmed bookings", async () => {
    asAdmin();

    await POST(
      makeRequest({ traineeId: "t1", slotId: "slot-6", traineeName: "Alice" })
    );

    const req = new NextRequest("http://localhost/api/admin/bookings", {
      headers: { authorization: "Bearer jwt" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bookings.length).toBe(1);
    expect(body.bookings[0].traineeId).toBe("t1");
    expect(body.bookings[0].status).toBe("confirmed");
  });
});
