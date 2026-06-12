import { SupabaseClient } from "@supabase/supabase-js";
import { AuthService } from "@/lib/services/auth";
import { Profile } from "@/lib/types";
import { mapProfileRow } from "@/lib/services/row-mappers";

/**
 * Supabase-backed AuthService. Login itself is handled by the mobile app via
 * Supabase Auth SDK + JWT bearer; this service exposes only what the backend
 * still needs server-side (current-user lookup, trainee CRUD).
 */
export class SupabaseAuthService implements AuthService {
  constructor(private db: SupabaseClient, private admin: SupabaseClient = db) {}

  async getCurrentUser(): Promise<Profile | null> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) return null;

    const { data } = await this.admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return data ? mapProfileRow(data) : null;
  }

  async signOut(): Promise<void> {
    await this.db.auth.signOut();
  }

  async getTrainees(): Promise<Profile[]> {
    const { data } = await this.admin
      .from("profiles")
      .select("*")
      .eq("role", "trainee")
      .order("name");

    return (data ?? []).map((p: Record<string, unknown>) => mapProfileRow(p));
  }

  async deleteTrainee(id: string): Promise<void> {
    const { data: profile } = await this.admin
      .from("profiles")
      .select("is_active")
      .eq("id", id)
      .single();
    if (!profile) throw new Error("Trainee not found");
    if (profile.is_active) throw new Error("Cannot delete active trainee");

    const { error } = await this.admin
      .from("profiles")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async updateTrainee(
    id: string,
    updates: {
      isRecurring?: boolean;
      preferredDay?: number | null;
      preferredTime?: string | null;
      isActive?: boolean;
      name?: string;
    }
  ): Promise<Profile> {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.isRecurring !== undefined) dbUpdates.is_recurring = updates.isRecurring;
    if (updates.preferredDay !== undefined) dbUpdates.preferred_day = updates.preferredDay;
    if (updates.preferredTime !== undefined) dbUpdates.preferred_time = updates.preferredTime;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.name !== undefined) dbUpdates.name = updates.name;

    const { data, error } = await this.admin
      .from("profiles")
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Trainee not found");
    return mapProfileRow(data);
  }

}

/**
 * In-memory AuthService for tests. Reset on every test container build.
 * No OTP — the mobile flow holds login; this just simulates the profile read API.
 */
export class MockAuthService implements AuthService {
  private trainees = new Map<string, Profile>();

  async getCurrentUser(): Promise<Profile | null> {
    return null;
  }

  async signOut(): Promise<void> {
    /* no-op */
  }

  async getTrainees(): Promise<Profile[]> {
    return Array.from(this.trainees.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  async deleteTrainee(id: string): Promise<void> {
    const t = this.trainees.get(id);
    if (!t) throw new Error("Trainee not found");
    if (t.isActive) throw new Error("Cannot delete active trainee");
    this.trainees.delete(id);
  }

  async updateTrainee(
    id: string,
    updates: {
      isRecurring?: boolean;
      preferredDay?: number | null;
      preferredTime?: string | null;
      isActive?: boolean;
      name?: string;
    }
  ): Promise<Profile> {
    const existing = this.trainees.get(id);
    if (!existing) throw new Error("Trainee not found");
    const next: Profile = {
      ...existing,
      ...(updates.isRecurring !== undefined && { isRecurring: updates.isRecurring }),
      ...(updates.preferredDay !== undefined && { preferredDay: updates.preferredDay }),
      ...(updates.preferredTime !== undefined && { preferredTime: updates.preferredTime }),
      ...(updates.isActive !== undefined && { isActive: updates.isActive }),
      ...(updates.name !== undefined && { name: updates.name }),
    };
    this.trainees.set(id, next);
    return next;
  }

  /** Test helper: seed a trainee. Not part of the public AuthService interface. */
  _seedTrainee(profile: Profile): void {
    this.trainees.set(profile.id, profile);
  }
}
