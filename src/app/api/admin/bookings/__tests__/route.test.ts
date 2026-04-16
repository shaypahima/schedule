import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockSession = vi.fn();
vi.mock("@/lib/services/session", () => ({
  getSession: () => mockSession(),
}));

process.env.MOCK_SERVICES = "true";

import { POST, DELETE, GET } from "../route";
import { getContainer, resetContainer } from "@/lib/services";

const adminSession = {
  id: "coach-1",
  name: "Coach",
  role: "admin",
  phone: "050-0000000",
};

const traineeSession = {
  id: "t1",
  name: "Alice",
  role: "trainee",
  phone: "050-1234567",
};

function makeRequest(body: Record<string, unknown>, method = "POST") {
  return new NextRequest("http://localhost/api/admin/bookings", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
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
    mockSession.mockReset();
  });

  it("returns 403 for non-admin", async () => {
    mockSession.mockResolvedValue(traineeSession);
    const res = await POST(
      makeRequest({ traineeId: "t1", slotId: "slot-6", traineeName: "Alice" })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Admin only");
  });

  it("returns 401 for unauthenticated", async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(
      makeRequest({ traineeId: "t1", slotId: "slot-6" })
    );
    expect(res.status).toBe(401);
  });

  it("admin books trainee into slot", async () => {
    mockSession.mockResolvedValue(adminSession);
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
    mockSession.mockReset();
  });

  it("admin cancels a booking", async () => {
    mockSession.mockResolvedValue(adminSession);

    // Book first
    const bookRes = await POST(
      makeRequest({ traineeId: "t1", slotId: "slot-6", traineeName: "Alice" })
    );
    const { booking } = await bookRes.json();

    // Cancel
    const res = await DELETE(
      makeRequest({ bookingId: booking.id }, "DELETE")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify cancelled in store
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
    mockSession.mockReset();
  });

  it("returns all confirmed bookings", async () => {
    mockSession.mockResolvedValue(adminSession);

    // Book a trainee
    await POST(
      makeRequest({ traineeId: "t1", slotId: "slot-6", traineeName: "Alice" })
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bookings.length).toBe(1);
    expect(body.bookings[0].traineeId).toBe("t1");
    expect(body.bookings[0].status).toBe("confirmed");
  });
});
