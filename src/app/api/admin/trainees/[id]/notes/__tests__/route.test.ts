import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockJwtSession = vi.fn();
const mockLoadProfile = vi.fn();
const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockListVisible = vi.fn();

vi.mock("@/lib/services/jwt-session", () => ({
  getJwtSession: (req: NextRequest) => mockJwtSession(req),
}));

vi.mock("@/lib/auth/profile-repo", () => ({
  loadProfile: (id: string) => mockLoadProfile(id),
}));

vi.mock("@/lib/services/notes-repo", () => ({
  listNotesForTrainee: (id: string) => mockList(id),
  listVisibleNotesForTrainee: (id: string, limit?: number) => mockListVisible(id, limit),
  createNote: (input: unknown) => mockCreate(input),
  updateNote: (id: string, patch: unknown) => mockUpdate(id, patch),
  deleteNote: (id: string) => mockDelete(id),
}));

import { GET as listForTrainee, POST as createForTrainee } from "../route";
import { PATCH as patchNote, DELETE as deleteNote } from "../../../../notes/[id]/route";
import { GET as listVisibleForMe } from "../../../../../me/notes/route";
import type { Profile } from "@/lib/auth/profile-repo";

const coach: Profile = {
  userId: "c1",
  email: "coach@example.com",
  phone: null,
  name: "Coach",
  role: "coach",
  status: "active",
  hasIntro: false,
  createdAt: "2026-01-01T00:00:00Z",
};

const trainee: Profile = { ...coach, userId: "t1", role: "trainee" };

const note = {
  id: "note-1",
  traineeId: "t1",
  body: "Great session",
  visibleToTrainee: true,
  createdAt: new Date("2026-04-06T10:00:00Z"),
  updatedAt: new Date("2026-04-06T10:00:00Z"),
};

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) });

function adminReq(method: string, body?: unknown, path = "/api/admin/trainees/t1/notes") {
  return new NextRequest(`http://localhost${path}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json", authorization: "Bearer jwt" },
  });
}

describe("Notes endpoints (Phase 17)", () => {
  beforeEach(() => {
    mockJwtSession.mockResolvedValue({ userId: "c1", email: "coach@example.com" });
    mockLoadProfile.mockResolvedValue(coach);
  });

  afterEach(() => {
    mockJwtSession.mockReset();
    mockLoadProfile.mockReset();
    mockList.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
    mockListVisible.mockReset();
  });

  describe("GET /api/admin/trainees/:id/notes", () => {
    it("lists all notes for trainee (coach view, includes private)", async () => {
      mockList.mockResolvedValue([note, { ...note, id: "note-2", visibleToTrainee: false }]);
      const res = await listForTrainee(adminReq("GET"), paramsFor("t1"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.notes).toHaveLength(2);
      expect(mockList).toHaveBeenCalledWith("t1");
    });

    it("returns 403 for non-coach", async () => {
      mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
      mockLoadProfile.mockResolvedValue(trainee);
      const res = await listForTrainee(adminReq("GET"), paramsFor("t1"));
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/admin/trainees/:id/notes", () => {
    it("creates a note with visible_to_trainee defaulting to false", async () => {
      mockCreate.mockResolvedValue(note);
      const res = await createForTrainee(
        adminReq("POST", { body: "Solid work today" }),
        paramsFor("t1")
      );
      expect(res.status).toBe(201);
      expect(mockCreate).toHaveBeenCalledWith({
        traineeId: "t1",
        body: "Solid work today",
        visibleToTrainee: false,
      });
    });

    it("honors visibleToTrainee=true when supplied", async () => {
      mockCreate.mockResolvedValue({ ...note, visibleToTrainee: true });
      await createForTrainee(
        adminReq("POST", { body: "Great session!", visibleToTrainee: true }),
        paramsFor("t1")
      );
      expect(mockCreate).toHaveBeenCalledWith({
        traineeId: "t1",
        body: "Great session!",
        visibleToTrainee: true,
      });
    });

    it("rejects 400 when body is empty", async () => {
      const res = await createForTrainee(
        adminReq("POST", { body: "   " }),
        paramsFor("t1")
      );
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("BODY_REQUIRED");
    });

    it("returns 403 for trainee caller", async () => {
      mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
      mockLoadProfile.mockResolvedValue(trainee);
      const res = await createForTrainee(
        adminReq("POST", { body: "Hello" }),
        paramsFor("t1")
      );
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/admin/notes/:id", () => {
    it("updates body and visibility", async () => {
      mockUpdate.mockResolvedValue({ ...note, body: "Updated", visibleToTrainee: false });
      const res = await patchNote(
        adminReq("PATCH", { body: "Updated", visibleToTrainee: false }, "/api/admin/notes/note-1"),
        paramsFor("note-1")
      );
      expect(res.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith("note-1", { body: "Updated", visibleToTrainee: false });
    });

    it("returns 400 when update repo throws (empty body)", async () => {
      mockUpdate.mockRejectedValue(new Error("body cannot be empty"));
      const res = await patchNote(
        adminReq("PATCH", { body: "  " }, "/api/admin/notes/note-1"),
        paramsFor("note-1")
      );
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/admin/notes/:id", () => {
    it("deletes a note", async () => {
      mockDelete.mockResolvedValue(undefined);
      const res = await deleteNote(
        adminReq("DELETE", undefined, "/api/admin/notes/note-1"),
        paramsFor("note-1")
      );
      expect(res.status).toBe(200);
      expect(mockDelete).toHaveBeenCalledWith("note-1");
    });
  });

  describe("GET /api/me/notes (trainee, visible only)", () => {
    function meReq() {
      return new NextRequest("http://localhost/api/me/notes", {
        headers: { authorization: "Bearer jwt" },
      });
    }

    it("lists only visible notes for the calling trainee", async () => {
      mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
      mockLoadProfile.mockResolvedValue(trainee);
      mockListVisible.mockResolvedValue([note]);

      const res = await listVisibleForMe(meReq());

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.notes).toHaveLength(1);
      expect(mockListVisible).toHaveBeenCalledWith("t1", 10);
    });

    it("returns 403 when pending trainee tries to read notes", async () => {
      mockJwtSession.mockResolvedValue({ userId: "t1", email: "t1@example.com" });
      mockLoadProfile.mockResolvedValue({ ...trainee, status: "pending" });
      const res = await listVisibleForMe(meReq());
      expect(res.status).toBe(403);
    });
  });
});
