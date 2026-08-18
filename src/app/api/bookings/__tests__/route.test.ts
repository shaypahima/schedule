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

import { POST, GET, DELETE, PATCH } from "../route";
import { getContainer, resetContainer } from "@/lib/services";
import { MockBookingStore } from "@/lib/services/booking-store";
import type { Profile } from "@/lib/auth/require";

/** The test container always runs the Mock store (MOCK_SERVICES=true). */
const mockStore = () => getContainer().store as MockBookingStore;

const traineeProfile: Profile = {
  userId: "t1",
  email: "t1@example.com",
  phone: null,
  name: "Alice",
  role: "trainee",
  status: "active",
  hasIntro: false,
  createdAt: "2026-01-01T00:00:00Z",
};

function makeRequest(body: Record<string, unknown>, method = "POST") {
  return new NextRequest("http://localhost/api/bookings", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", authorization: "Bearer jwt" },
  });
}

function makeGetRequest() {
  return new NextRequest("http://localhost/api/bookings", {
    headers: { authorization: "Bearer jwt" },
  });
}

describe("POST /api/bookings", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));
    resetContainer();
    const store = mockStore();
    store.addSlot({
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
    mockLoadProfile.mockReset();
  });

  it("returns 401 when no JWT", async () => {
    mockJwtSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ slotId: "slot-6" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when profile is missing", async () => {
    mockJwtSession.mockResolvedValue({ userId: "ghost", email: "ghost@example.com" });
    mockLoadProfile.mockResolvedValue(null);
    const res = await POST(makeRequest({ slotId: "slot-6" }));
    expect(res.status).toBe(401);
  });

  it("books a slot and returns 201", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(traineeProfile);
    const res = await POST(makeRequest({ slotId: "slot-6" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.booking.slotId).toBe("slot-6");
    expect(body.booking.traineeId).toBe("t1");
    expect(body.booking.status).toBe("confirmed");
  });

  it("returns 409 when slot is full", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(traineeProfile);
    const store = mockStore();
    store.addSlot({
      id: "slot-6",
      date: "2026-04-06",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 2,
    });
    const res = await POST(makeRequest({ slotId: "slot-6" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("full");
  });

  it("auto-creates slot from new-* placeholder ID", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(traineeProfile);
    const res = await POST(makeRequest({ slotId: "new-2026-04-08-14:00" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    const { store } = getContainer();
    const slot = await store.getSlot(body.booking.slotId);
    expect(slot).toBeDefined();
    expect(slot!.date).toBe("2026-04-08");
    expect(slot!.startTime).toBe("14:00");
  });
});

describe("GET /api/bookings", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-06T06:00:00Z"));
    resetContainer();
  });

  afterEach(() => {
    vi.useRealTimers();
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("returns 401 when no JWT", async () => {
    mockJwtSession.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns trainee bookings and remaining edits", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(traineeProfile);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("bookings");
    expect(body).toHaveProperty("remainingEdits");
    // 3-edit cap removed; backend returns Infinity which serializes to null in JSON.
    expect(body.remainingEdits).toBeNull();
  });

  it("each booking has an isLocked flag (lockout = within 7h)", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(traineeProfile);

    // Book at a time well before the slots so book() doesn't lockout-reject.
    vi.setSystemTime(new Date("2026-04-05T06:00:00Z"));

    const store = mockStore();
    store.addSlot({
      id: "slot-soon",
      date: "2026-04-06",
      startTime: "11:00", // 08:00 UTC (UTC+3 in April)
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    store.addSlot({
      id: "slot-later",
      date: "2026-04-06",
      startTime: "19:00", // 16:00 UTC
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    await POST(makeRequest({ slotId: "slot-soon" }));
    await POST(makeRequest({ slotId: "slot-later" }));

    // Advance to 06:00 UTC on the day-of: slot-soon is in 2h (locked),
    // slot-later is in 10h (not locked).
    vi.setSystemTime(new Date("2026-04-06T06:00:00Z"));

    const res = await GET(makeGetRequest());
    const body = await res.json();
    const soon = body.bookings.find((b: { slotId: string }) => b.slotId === "slot-soon");
    const later = body.bookings.find((b: { slotId: string }) => b.slotId === "slot-later");
    expect(soon.isLocked).toBe(true);
    expect(later.isLocked).toBe(false);
  });
});

describe("DELETE /api/bookings", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));
    resetContainer();
    const store = mockStore();
    store.addSlot({
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
    mockLoadProfile.mockReset();
  });

  it("cancels a booking and returns 200", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(traineeProfile);

    const bookRes = await POST(makeRequest({ slotId: "slot-6" }));
    const { booking } = await bookRes.json();

    const res = await DELETE(makeRequest({ bookingId: booking.id }, "DELETE"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  // The 3-edit-per-week cap was removed; the 24h approval flow is now the
  // only cancel gate. Outside-window cancels are unbounded.
});

describe("PATCH /api/bookings", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));
    resetContainer();
    const store = mockStore();
    store.addSlot({
      id: "slot-6",
      date: "2026-04-06",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    store.addSlot({
      id: "slot-7",
      date: "2026-04-07",
      startTime: "14:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("reschedules booking and returns 200", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(traineeProfile);

    const bookRes = await POST(makeRequest({ slotId: "slot-6" }));
    const { booking } = await bookRes.json();

    const res = await PATCH(
      makeRequest({ bookingId: booking.id, newSlotId: "slot-7" }, "PATCH")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.booking.slotId).toBe("slot-7");
    expect(body.booking.status).toBe("confirmed");
  });

  it("returns 409 when new slot is full, old booking unchanged", async () => {
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(traineeProfile);

    const store = mockStore();
    store.addSlot({
      id: "slot-7",
      date: "2026-04-07",
      startTime: "14:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 2,
    });

    const bookRes = await POST(makeRequest({ slotId: "slot-6" }));
    const { booking } = await bookRes.json();

    const res = await PATCH(
      makeRequest({ bookingId: booking.id, newSlotId: "slot-7" }, "PATCH")
    );
    expect(res.status).toBe(409);

    const old = await store.getBooking(booking.id);
    expect(old!.status).toBe("confirmed");
  });
});
