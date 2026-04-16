import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock session — must be before route import
const mockSession = vi.fn();
vi.mock("@/lib/services/session", () => ({
  getSession: () => mockSession(),
}));

// Force mock services — must use process.env directly before imports
process.env.MOCK_SERVICES = "true";

import { POST, GET, DELETE, PATCH } from "../route";
import { getContainer, resetContainer } from "@/lib/services";

const traineeSession = {
  id: "t1",
  name: "Alice",
  role: "trainee",
  phone: "050-1234567",
};

function makeRequest(body: Record<string, unknown>, method = "POST") {
  return new NextRequest("http://localhost/api/bookings", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/bookings", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-04T06:00:00Z"));
    resetContainer();
    // Seed a slot for the coming week
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

  it("returns 401 when not authenticated", async () => {
    mockSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ slotId: "slot-6" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("books a slot and returns 201", async () => {
    mockSession.mockResolvedValue(traineeSession);
    const res = await POST(makeRequest({ slotId: "slot-6" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.booking.slotId).toBe("slot-6");
    expect(body.booking.traineeId).toBe("t1");
    expect(body.booking.status).toBe("confirmed");
  });

  it("returns 409 when slot is full", async () => {
    mockSession.mockResolvedValue(traineeSession);
    const { store } = getContainer();
    store.upsertSlot({
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
    mockSession.mockResolvedValue(traineeSession);
    const res = await POST(makeRequest({ slotId: "new-2026-04-08-14:00" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.booking.slotId).toBe("new-2026-04-08-14:00");
    // Slot should now exist in store
    const { store } = getContainer();
    const slot = store.getSlot("new-2026-04-08-14:00");
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
    mockSession.mockReset();
  });

  it("returns trainee bookings and remaining edits", async () => {
    mockSession.mockResolvedValue(traineeSession);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("bookings");
    expect(body).toHaveProperty("remainingEdits");
    expect(body.remainingEdits).toBe(3);
  });
});

describe("DELETE /api/bookings", () => {
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

  it("cancels a booking and returns 200", async () => {
    mockSession.mockResolvedValue(traineeSession);

    // Book first
    const bookRes = await POST(makeRequest({ slotId: "slot-6" }));
    const { booking } = await bookRes.json();

    // Cancel
    const res = await DELETE(
      makeRequest({ bookingId: booking.id }, "DELETE")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 409 when edit limit reached", async () => {
    mockSession.mockResolvedValue(traineeSession);

    const { store } = getContainer();
    // Add more slots for cancelling
    for (let i = 7; i <= 10; i++) {
      store.upsertSlot({
        id: `slot-${i}`,
        date: `2026-04-${String(i).padStart(2, "0")}`,
        startTime: "10:00",
        capacity: 2,
        lockoutOverride: false,
        currentBookings: 0,
      });
    }

    // Book + cancel 3 times to exhaust edits
    for (let i = 6; i <= 8; i++) {
      const br = await POST(makeRequest({ slotId: `slot-${i}` }));
      const { booking } = await br.json();
      await DELETE(makeRequest({ bookingId: booking.id }, "DELETE"));
    }

    // 4th book + cancel should fail
    const br4 = await POST(makeRequest({ slotId: "slot-9" }));
    const { booking: b4 } = await br4.json();
    const res = await DELETE(makeRequest({ bookingId: b4.id }, "DELETE"));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("Edit limit");
  });
});

describe("PATCH /api/bookings", () => {
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
    store.upsertSlot({
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
    mockSession.mockReset();
  });

  it("reschedules booking and returns 200", async () => {
    mockSession.mockResolvedValue(traineeSession);

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
    mockSession.mockResolvedValue(traineeSession);

    const { store } = getContainer();
    store.upsertSlot({
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

    // Old booking still confirmed
    const old = store.getBooking(booking.id);
    expect(old!.status).toBe("confirmed");
  });
});
