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
import { createNote, setNotesRepo } from "@/lib/services/notes-repo";
import type { Profile as AuthProfile } from "@/lib/auth/profile-repo";
import { FakeNotesRepo } from "@/__tests__/helpers/fake-notes-repo";

const trainee: AuthProfile = {
  userId: "t1",
  email: "t1@example.com",
  phone: null,
  name: "Dana",
  role: "trainee",
  status: "active",
  hasIntro: true,
  createdAt: "2026-01-01T00:00:00Z",
};

const req = (qs = "") =>
  new NextRequest(`http://localhost/api/me/notes${qs}`, {
    headers: { authorization: "Bearer jwt" },
  });

describe("GET /api/me/notes (coach-note visibility)", () => {
  beforeEach(() => {
    setNotesRepo(new FakeNotesRepo());
    mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
    mockLoadProfile.mockResolvedValue(trainee);
  });

  afterEach(() => {
    setNotesRepo(undefined);
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("returns only notes flagged visible-to-trainee", async () => {
    await createNote({ traineeId: "t1", body: "שיפור בטכניקה", visibleToTrainee: true });
    await createNote({ traineeId: "t1", body: "private coach memo", visibleToTrainee: false });

    const res = await GET(req());
    expect(res.status).toBe(200);
    const { notes } = await res.json();
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toBe("שיפור בטכניקה");
  });

  it("never returns another trainee's notes, even visible ones", async () => {
    await createNote({ traineeId: "t2", body: "note for someone else", visibleToTrainee: true });

    const res = await GET(req());
    const { notes } = await res.json();
    expect(notes).toHaveLength(0);
  });

  it("respects the limit query param, newest first", async () => {
    await createNote({ traineeId: "t1", body: "oldest", visibleToTrainee: true });
    await createNote({ traineeId: "t1", body: "middle", visibleToTrainee: true });
    await createNote({ traineeId: "t1", body: "newest", visibleToTrainee: true });

    const res = await GET(req("?limit=2"));
    const { notes } = await res.json();
    expect(notes.map((n: { body: string }) => n.body)).toEqual(["newest", "middle"]);
  });
});
