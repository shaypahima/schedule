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

import { GET } from "../route";
import { getContainer, resetContainer } from "@/lib/services";
import type { Profile } from "@/lib/auth/profile-repo";

const trainee: Profile = {
  userId: "t1",
  email: "t1@example.com",
  phone: null,
  name: "Alice",
  role: "trainee",
  status: "active",
  hasIntro: true,
  createdAt: "2026-01-01T00:00:00Z",
};

const req = () =>
  new NextRequest("http://localhost/api/me/history", {
    headers: { authorization: "Bearer jwt" },
  });

describe("GET /api/me/history", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-08T06:00:00Z"));
    resetContainer();
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(trainee);
  });

  afterEach(() => {
    vi.useRealTimers();
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("returns empty history when no bookings", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.history).toEqual([]);
  });

  it("returns all bookings (confirmed + cancelled + no_show) newest first", async () => {
    const { store, bookings } = getContainer();
    for (const [id, date] of [
      ["s1", "2026-04-01"], // past
      ["s2", "2026-04-05"], // past
      ["s3", "2026-04-20"], // future
    ] as const) {
      store.upsertSlot({
        id,
        date,
        startTime: "10:00",
        capacity: 2,
        lockoutOverride: false,
        currentBookings: 0,
      });
    }
    const b1 = await bookings.book("t1", "s1", { bypass: true });
    const b2 = await bookings.book("t1", "s2", { bypass: true });
    const b3 = await bookings.book("t1", "s3", { bypass: true });
    if (!b1.ok || !b2.ok || !b3.ok) throw new Error("setup failed");
    await bookings.markNoShow(b2.booking.id);
    await bookings.cancel(b3.booking.id, "t1");

    const res = await GET(req());
    const body = await res.json();
    expect(body.history).toHaveLength(3);
    // Newest first
    expect(body.history[0].slotId).toBe("s3");
    expect(body.history[0].status).toBe("cancelled");
    expect(body.history[1].slotId).toBe("s2");
    expect(body.history[1].status).toBe("no_show");
    expect(body.history[2].slotId).toBe("s1");
    expect(body.history[2].status).toBe("confirmed");
  });

  it("flags isPast correctly", async () => {
    const { store, bookings } = getContainer();
    store.upsertSlot({
      id: "s-past",
      date: "2026-04-01",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    store.upsertSlot({
      id: "s-future",
      date: "2026-04-30",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    await bookings.book("t1", "s-past", { bypass: true });
    await bookings.book("t1", "s-future", { bypass: true });

    const res = await GET(req());
    const body = await res.json();
    const past = body.history.find((h: { slotId: string }) => h.slotId === "s-past");
    const future = body.history.find((h: { slotId: string }) => h.slotId === "s-future");
    expect(past.isPast).toBe(true);
    expect(future.isPast).toBe(false);
  });

  it("only returns the caller's bookings", async () => {
    const { store, bookings } = getContainer();
    store.upsertSlot({
      id: "s1",
      date: "2026-04-01",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    await bookings.book("t1", "s1", { bypass: true });
    await bookings.book("t2", "s1", { bypass: true });

    const res = await GET(req());
    const body = await res.json();
    expect(body.history).toHaveLength(1);
  });

  it("returns 403 for non-active trainee", async () => {
    mockLoadProfile.mockResolvedValue({ ...trainee, status: "pending" });
    const res = await GET(req());
    expect(res.status).toBe(403);
  });
});
