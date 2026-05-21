import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockJwtSession = vi.fn();
const mockLoadProfile = vi.fn();
const mockListVisible = vi.fn();

vi.mock("@/lib/services/jwt-session", () => ({
  getJwtSession: (req: NextRequest) => mockJwtSession(req),
}));

vi.mock("@/lib/auth/profile-repo", () => ({
  loadProfile: (id: string) => mockLoadProfile(id),
}));

vi.mock("@/lib/services/notes-repo", () => ({
  listVisibleNotesForTrainee: (id: string, limit?: number) =>
    mockListVisible(id, limit),
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
  new NextRequest("http://localhost/api/me/dashboard", {
    headers: { authorization: "Bearer jwt" },
  });

describe("GET /api/me/dashboard", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-08T06:00:00Z"));
    resetContainer();
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(trainee);
    mockListVisible.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
    mockListVisible.mockReset();
  });

  it("returns aggregated stats with no bookings", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionsThisMonth).toBe(0);
    expect(body.pastConfirmed).toBe(0);
    expect(body.noShows).toBe(0);
    expect(body.attendanceRate).toBe(1);
    expect(body.nextSessionAt).toBeNull();
    expect(body.recentVisibleNote).toBeNull();
    // 3-edit cap removed; Infinity serializes to null in JSON.
    expect(body.remainingEdits).toBeNull();
  });

  it("counts upcoming confirmed booking as nextSessionAt + sessionsThisMonth", async () => {
    const { store, bookings } = getContainer();
    store.upsertSlot({
      id: "slot-future",
      date: "2026-04-20",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    await bookings.book("t1", "slot-future", { bypass: true });

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionsThisMonth).toBe(1);
    expect(body.nextSessionAt).not.toBeNull();
  });

  it("rolls past confirmed + no_show into attendance rate", async () => {
    const { store, bookings } = getContainer();
    store.upsertSlot({
      id: "slot-past-attended",
      date: "2026-04-06",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    store.upsertSlot({
      id: "slot-past-noshow",
      date: "2026-04-07",
      startTime: "10:00",
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });
    const b1 = await bookings.book("t1", "slot-past-attended", { bypass: true });
    const b2 = await bookings.book("t1", "slot-past-noshow", { bypass: true });
    if (!b1.ok || !b2.ok) throw new Error("setup failed");
    await bookings.markNoShow(b2.booking.id);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pastConfirmed).toBe(1);
    expect(body.noShows).toBe(1);
    expect(body.attendanceRate).toBeCloseTo(0.5, 5);
  });

  it("surfaces the most recent visible note", async () => {
    mockListVisible.mockResolvedValue([
      {
        id: "note-1",
        body: "Great work!",
        createdAt: "2026-04-07T12:00:00Z",
      },
    ]);
    const res = await GET(req());
    const body = await res.json();
    expect(body.recentVisibleNote).not.toBeNull();
    expect(body.recentVisibleNote.body).toBe("Great work!");
  });

  it("returns 403 for non-active trainee", async () => {
    mockLoadProfile.mockResolvedValue({ ...trainee, status: "pending" });
    const res = await GET(req());
    expect(res.status).toBe(403);
  });
});
