import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mockListVisible = vi.fn();
vi.mock("@/lib/services/notes-repo", () => ({
  listVisibleNotesForTrainee: (id: string, limit?: number) =>
    mockListVisible(id, limit),
}));

import { MockBookingStore } from "@/lib/services/booking-store";
import { makeBookings } from "@/lib/services/bookings";
import { makeTraineeReadModel } from "@/lib/services/trainee-read";

describe("TraineeReadModel.dashboard", () => {
  let store: MockBookingStore;
  let bookings: ReturnType<typeof makeBookings>;
  let read: ReturnType<typeof makeTraineeReadModel>;

  const addSlot = (id: string, date: string, time = "10:00") =>
    store.addSlot({
      id,
      date,
      startTime: time,
      capacity: 2,
      lockoutOverride: false,
      currentBookings: 0,
    });

  const run = () =>
    read.dashboard({ userId: "t1", createdAt: "2026-01-01T00:00:00Z" });

  beforeEach(() => {
    vi.setSystemTime(new Date("2026-04-08T06:00:00Z"));
    store = new MockBookingStore();
    bookings = makeBookings(store, null, null);
    read = makeTraineeReadModel(store, bookings);
    mockListVisible.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    mockListVisible.mockReset();
  });

  it("returns zeros with no bookings; attendance defaults to 1", async () => {
    const v = await run();
    expect(v.sessionsThisMonth).toBe(0);
    expect(v.pastConfirmed).toBe(0);
    expect(v.noShows).toBe(0);
    expect(v.attendanceRate).toBe(1);
    expect(v.currentStreak).toBe(0);
    expect(v.nextSessionAt).toBeNull();
    expect(v.recentVisibleNote).toBeNull();
  });

  it("counts an upcoming confirmed booking as nextSessionAt + sessionsThisMonth", async () => {
    addSlot("future", "2026-04-20");
    await bookings.book("t1", "future", { bypass: true });
    const v = await run();
    expect(v.sessionsThisMonth).toBe(1);
    expect(v.nextSessionAt).not.toBeNull();
  });

  it("rolls past confirmed + no_show into attendance rate", async () => {
    addSlot("attended", "2026-04-06");
    addSlot("noshow", "2026-04-07");
    const b1 = await bookings.book("t1", "attended", { bypass: true });
    const b2 = await bookings.book("t1", "noshow", { bypass: true });
    if (!b1.ok || !b2.ok) throw new Error("setup");
    await bookings.markNoShow(b2.booking.id);
    const v = await run();
    expect(v.pastConfirmed).toBe(1);
    expect(v.noShows).toBe(1);
    expect(v.attendanceRate).toBeCloseTo(0.5, 5);
  });

  it("streak: a trailing no_show breaks the run to 0", async () => {
    addSlot("s1", "2026-04-01");
    addSlot("s2", "2026-04-03");
    addSlot("s3", "2026-04-05");
    await bookings.book("t1", "s1", { bypass: true });
    await bookings.book("t1", "s2", { bypass: true });
    const b3 = await bookings.book("t1", "s3", { bypass: true });
    if (!b3.ok) throw new Error("setup");
    await bookings.markNoShow(b3.booking.id);
    expect((await run()).currentStreak).toBe(0);
  });

  it("streak: counts the uninterrupted trailing run of confirmed", async () => {
    addSlot("s1", "2026-04-01");
    addSlot("s2", "2026-04-03");
    addSlot("s3", "2026-04-05");
    const b1 = await bookings.book("t1", "s1", { bypass: true });
    await bookings.book("t1", "s2", { bypass: true });
    await bookings.book("t1", "s3", { bypass: true });
    if (!b1.ok) throw new Error("setup");
    await bookings.markNoShow(b1.booking.id);
    expect((await run()).currentStreak).toBe(2);
  });

  it("memberSinceDays from createdAt, whole days", async () => {
    expect((await run()).memberSinceDays).toBe(97); // 2026-01-01 → 2026-04-08
  });

  it("surfaces the most recent visible note", async () => {
    mockListVisible.mockResolvedValue([
      { id: "n1", body: "Great work!", createdAt: "2026-04-07T12:00:00Z" },
    ]);
    const v = await run();
    expect(v.recentVisibleNote?.body).toBe("Great work!");
  });

  it("resolves slots via one batched read — zero per-item getSlot", async () => {
    addSlot("a", "2026-04-01");
    addSlot("b", "2026-04-20");
    await bookings.book("t1", "a", { bypass: true });
    await bookings.book("t1", "b", { bypass: true });
    const spy = vi.spyOn(store, "getSlot");
    await run();
    expect(spy).not.toHaveBeenCalled();
  });
});
