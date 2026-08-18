import { describe, it, expect, vi, beforeEach } from "vitest";

// Postgres throws 22P02 on `where id = $1` when $1 isn't a valid uuid. The
// store contract says unknown id → undefined, and client-supplied ids (e.g.
// virtual "new-<date>-<time>" slot ids) are legitimately not uuids — so the
// adapter must short-circuit instead of querying.
vi.mock("../client", () => ({ pgQuery: vi.fn() }));

import { pgQuery } from "../client";
import { PgBookingStore } from "../booking-store";

const store = new PgBookingStore();

beforeEach(() => {
  vi.mocked(pgQuery).mockReset();
  vi.mocked(pgQuery).mockRejectedValue(
    new Error('invalid input syntax for type uuid'),
  );
});

describe("PgBookingStore non-uuid id lookups", () => {
  it("getSlot returns undefined for a virtual 'new-' slot id without querying", async () => {
    await expect(store.getSlot("new-2026-06-14-10:00")).resolves.toBeUndefined();
    expect(pgQuery).not.toHaveBeenCalled();
  });

  it("getBooking returns undefined for a non-uuid id without querying", async () => {
    await expect(store.getBooking("not-a-uuid")).resolves.toBeUndefined();
    expect(pgQuery).not.toHaveBeenCalled();
  });

  it("getChangeRequest returns undefined for a non-uuid id without querying", async () => {
    await expect(store.getChangeRequest("nope")).resolves.toBeUndefined();
    expect(pgQuery).not.toHaveBeenCalled();
  });

  it("getSlot still queries for a real uuid", async () => {
    vi.mocked(pgQuery).mockResolvedValue([]);
    await expect(
      store.getSlot("11111111-1111-1111-1111-111111111111"),
    ).resolves.toBeUndefined();
    expect(pgQuery).toHaveBeenCalledOnce();
  });
});
