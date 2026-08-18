import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGetUser = vi.fn();
const mockLoadOrProvision = vi.fn();

const mockHasSupabaseEnv = vi.fn(() => true);

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: async () => ({ auth: { getUser: mockGetUser } }),
  hasSupabaseEnv: () => mockHasSupabaseEnv(),
}));

vi.mock("../provision", () => ({
  loadOrProvisionProfile: (identity: unknown) => mockLoadOrProvision(identity),
}));

const mockRedirect = vi.fn((to: string) => {
  throw new Error(`REDIRECT:${to}`);
});

vi.mock("next/navigation", () => ({
  redirect: (to: string) => mockRedirect(to),
}));

import {
  resolveDestination,
  getWebSession,
  requireCoachSession,
  requireActiveTraineeSession,
} from "../session";
import type { WebSession } from "../session";

function session(over: Partial<WebSession> = {}): WebSession {
  return {
    userId: "u1",
    email: "t1@example.com",
    name: "Trainee",
    role: "trainee",
    status: "active",
    hasIntro: true,
    ...over,
  };
}

describe("resolveDestination", () => {
  it("sends a visitor with no session to sign-in", () => {
    expect(resolveDestination(null)).toBe("/sign-in");
  });

  it("sends the coach to the coach home", () => {
    expect(resolveDestination(session({ role: "coach" }))).toBe("/coach");
  });

  it("sends a self-signup who has not written an intro to the intro form", () => {
    expect(
      resolveDestination(session({ status: "pending", hasIntro: false })),
    ).toBe("/intro");
  });

  it("sends a self-signup awaiting review to the pending screen", () => {
    expect(
      resolveDestination(session({ status: "pending", hasIntro: true })),
    ).toBe("/pending");
  });

  it("sends a rejected self-signup to the rejected screen", () => {
    expect(resolveDestination(session({ status: "rejected" }))).toBe("/rejected");
  });

  it("keeps deactivated distinct from rejected — they are different stories", () => {
    expect(resolveDestination(session({ status: "deactivated" }))).toBe(
      "/deactivated",
    );
  });

  it("sends an active trainee to the booking home", () => {
    expect(resolveDestination(session({ status: "active" }))).toBe("/");
  });
});

describe("getWebSession", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockLoadOrProvision.mockReset();
  });

  it("has no session for an anonymous visitor, and provisions nothing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    expect(await getWebSession()).toBeNull();
    expect(mockLoadOrProvision).not.toHaveBeenCalled();
  });

  it("has no session — rather than an error — when Supabase is not configured", async () => {
    // The local Postgres path runs with no Supabase credentials at all. A
    // visitor without a dev cookie must land on sign-in, not a crash.
    mockHasSupabaseEnv.mockReturnValueOnce(false);

    expect(await getWebSession()).toBeNull();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("resolves the signed-in identity to its role and status", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1", email: "t1@example.com", user_metadata: {} } },
      error: null,
    });
    mockLoadOrProvision.mockResolvedValue({
      userId: "u1",
      email: "t1@example.com",
      phone: null,
      name: "Trainee",
      role: "trainee",
      status: "pending",
      hasIntro: false,
      createdAt: "2026-01-01T00:00:00Z",
    });

    expect(await getWebSession()).toEqual({
      userId: "u1",
      email: "t1@example.com",
      name: "Trainee",
      role: "trainee",
      status: "pending",
      hasIntro: false,
    });
  });
});

describe("page guards", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockLoadOrProvision.mockReset();
    mockRedirect.mockClear();
  });

  function signedInAs(over: Partial<WebSession>) {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "u1", email: "u1@example.com", user_metadata: {} } },
      error: null,
    });
    mockLoadOrProvision.mockResolvedValue({
      userId: "u1",
      email: "u1@example.com",
      phone: null,
      name: "Someone",
      role: "trainee",
      status: "active",
      hasIntro: true,
      createdAt: "2026-01-01T00:00:00Z",
      ...over,
    });
  }

  it("bounces a trainee off a coach page to their own home", async () => {
    signedInAs({ role: "trainee", status: "active" });

    await expect(requireCoachSession()).rejects.toThrow("REDIRECT:/");
  });

  it("lets the coach through a coach page", async () => {
    signedInAs({ role: "coach" });

    const s = await requireCoachSession();

    expect(s.role).toBe("coach");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("bounces a pending trainee off a booking page to the pending screen", async () => {
    signedInAs({ role: "trainee", status: "pending", hasIntro: true });

    await expect(requireActiveTraineeSession()).rejects.toThrow(
      "REDIRECT:/pending",
    );
  });

  it("bounces an anonymous visitor off a booking page to sign-in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(requireActiveTraineeSession()).rejects.toThrow(
      "REDIRECT:/sign-in",
    );
  });
});
