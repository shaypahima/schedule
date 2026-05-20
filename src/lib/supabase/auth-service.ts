import { SupabaseClient } from "@supabase/supabase-js";
import { AuthService } from "@/lib/services/auth";
import { Profile, UserRole } from "@/lib/types";

/**
 * Supabase-backed AuthService using phone OTP via Supabase Auth
 * and a `profiles` table for app-specific user data.
 */
export class SupabaseAuthService implements AuthService {
  constructor(private db: SupabaseClient, private admin: SupabaseClient = db) {}

  async sendOtp(phone: string): Promise<void> {
    const { error } = await this.db.auth.signInWithOtp({ phone });
    if (error) throw new Error(error.message);
  }

  async verifyOtp(phone: string, code: string): Promise<Profile> {
    const { data, error } = await this.db.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("Verification failed");

    // Ensure profile exists
    const profile = await this.getOrCreateProfile(data.user.id, phone);
    return profile;
  }

  async getCurrentUser(): Promise<Profile | null> {
    const { data: { user } } = await this.db.auth.getUser();
    if (!user) return null;

    const { data } = await this.db
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return data ? this.mapProfile(data) : null;
  }

  async signOut(): Promise<void> {
    await this.db.auth.signOut();
  }

  async getTrainees(): Promise<Profile[]> {
    const { data } = await this.db
      .from("profiles")
      .select("*")
      .eq("role", "trainee")
      .order("name");

    return (data ?? []).map((p: Record<string, unknown>) => this.mapProfile(p));
  }

  async inviteTrainee(phone: string, name: string): Promise<Profile> {
    // Create auth user via admin API (service role key required)
    const { data: authData, error: authError } = await this.admin.auth.admin.createUser({
      phone,
      phone_confirm: true,
    });
    if (authError) throw new Error(authError.message);

    // Create profile row
    const { data, error } = await this.admin
      .from("profiles")
      .insert({
        id: authData.user.id,
        phone,
        name,
        role: "trainee",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapProfile(data);
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
    return this.mapProfile(data);
  }

  // --- Helpers ---

  private async getOrCreateProfile(userId: string, phone: string): Promise<Profile> {
    const { data: existing } = await this.db
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (existing) return this.mapProfile(existing);

    // First login — create profile
    const { data, error } = await this.db
      .from("profiles")
      .insert({
        id: userId,
        phone,
        name: phone, // default name to phone, coach can update
        role: "trainee",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapProfile(data);
  }

  private mapProfile(row: Record<string, unknown>): Profile & { email?: string | null; status?: string } {
    return {
      id: row.id as string,
      phone: (row.phone as string) ?? "",
      name: row.name as string,
      role: row.role as UserRole,
      isRecurring: (row.is_recurring as boolean) ?? false,
      preferredDay: row.preferred_day as number | null,
      preferredTime: row.preferred_time
        ? String(row.preferred_time).slice(0, 5)
        : null,
      isActive: (row.is_active as boolean) ?? true,
      createdAt: new Date(row.created_at as string),
      email: (row.email as string | null) ?? null,
      status: (row.status as string) ?? ((row.is_active as boolean) ? "active" : "deactivated"),
    };
  }
}
