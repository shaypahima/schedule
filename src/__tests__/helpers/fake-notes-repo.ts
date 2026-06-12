import type { NotesRepo } from "@/lib/services/notes-repo";
import { CoachNote } from "@/lib/types";

/** In-memory NotesRepo with the same visibility semantics as the SQL adapters. */
export class FakeNotesRepo implements NotesRepo {
  private notes = new Map<string, CoachNote>();
  private seq = 0;

  async listForTrainee(traineeId: string): Promise<CoachNote[]> {
    return [...this.notes.values()]
      .filter((n) => n.traineeId === traineeId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async listVisibleForTrainee(traineeId: string, limit: number): Promise<CoachNote[]> {
    return (await this.listForTrainee(traineeId))
      .filter((n) => n.visibleToTrainee)
      .slice(0, limit);
  }

  async create(input: {
    traineeId: string;
    body: string;
    visibleToTrainee: boolean;
  }): Promise<CoachNote> {
    const now = new Date(Date.now() + this.seq++); // unique, ordered timestamps
    const note: CoachNote = {
      id: `n${this.seq}`,
      traineeId: input.traineeId,
      body: input.body,
      visibleToTrainee: input.visibleToTrainee,
      createdAt: now,
      updatedAt: now,
    };
    this.notes.set(note.id, note);
    return { ...note };
  }

  async update(
    id: string,
    patch: { body?: string; visibleToTrainee?: boolean }
  ): Promise<CoachNote> {
    const n = this.notes.get(id);
    if (!n) throw new Error("updateNote failed: not found");
    const next = {
      ...n,
      ...(patch.body !== undefined && { body: patch.body }),
      ...(patch.visibleToTrainee !== undefined && { visibleToTrainee: patch.visibleToTrainee }),
      updatedAt: new Date(),
    };
    this.notes.set(id, next);
    return { ...next };
  }

  async delete(id: string): Promise<void> {
    this.notes.delete(id);
  }
}
