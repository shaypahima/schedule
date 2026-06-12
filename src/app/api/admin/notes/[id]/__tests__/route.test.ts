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

import { PATCH, DELETE } from "../route";
import {
  createNote,
  listVisibleNotesForTrainee,
  setNotesRepo,
} from "@/lib/services/notes-repo";
import type { Profile as AuthProfile } from "@/lib/auth/profile-repo";
import { FakeNotesRepo } from "@/__tests__/helpers/fake-notes-repo";

const coach: AuthProfile = {
  userId: "c1",
  email: "coach@example.com",
  phone: null,
  name: "Coach",
  role: "coach",
  status: "active",
  hasIntro: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });
const patchReq = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/admin/notes/x", {
    method: "PATCH",
    headers: { authorization: "Bearer jwt", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const deleteReq = () =>
  new NextRequest("http://localhost/api/admin/notes/x", {
    method: "DELETE",
    headers: { authorization: "Bearer jwt" },
  });

describe("PATCH/DELETE /api/admin/notes/:id", () => {
  beforeEach(() => {
    setNotesRepo(new FakeNotesRepo());
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockResolvedValue(coach);
  });

  afterEach(() => {
    setNotesRepo(undefined);
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
  });

  it("flipping visible-to-trainee publishes the note to the trainee feed", async () => {
    const note = await createNote({ traineeId: "t1", body: "כל הכבוד", visibleToTrainee: false });
    expect(await listVisibleNotesForTrainee("t1")).toHaveLength(0);

    const res = await PATCH(patchReq({ visibleToTrainee: true }), paramsFor(note.id));
    expect(res.status).toBe(200);

    const visible = await listVisibleNotesForTrainee("t1");
    expect(visible.map((n) => n.id)).toEqual([note.id]);
  });

  it("rejects emptying a note's body with 400", async () => {
    const note = await createNote({ traineeId: "t1", body: "תוכן", visibleToTrainee: true });
    const res = await PATCH(patchReq({ body: "   " }), paramsFor(note.id));
    expect(res.status).toBe(400);
  });

  it("deleting a visible note removes it from the trainee feed", async () => {
    const note = await createNote({ traineeId: "t1", body: "ימחק", visibleToTrainee: true });

    const res = await DELETE(deleteReq(), paramsFor(note.id));
    expect(res.status).toBe(200);
    expect(await listVisibleNotesForTrainee("t1")).toHaveLength(0);
  });
});
