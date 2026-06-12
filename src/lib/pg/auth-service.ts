import { AuthService } from "@/lib/services/auth";
import { Profile, UserRole } from "@/lib/types";
import { pgQuery } from "./client";

/**
 * Native-Postgres AuthService (local dev). Per-request identity is resolved by
 * require.ts via the JWT + loadProfile, so getCurrentUser() is unused here
 * (returns null, like the mock). This exposes the coach-side trainee CRUD.
 */
export class PgAuthService implements AuthService {
  async getCurrentUser(): Promise<Profile | null> {
    return null;
  }

  async signOut(): Promise<void> {
    /* no-op: dev tokens are stateless */
  }

  async getTrainees(): Promise<Profile[]> {
    const rows = await pgQuery<Record<string, unknown>>(
      "select * from profiles where role = 'trainee' order by name",
    );
    return rows.map((p) => this.mapProfile(p));
  }

  async deleteTrainee(id: string): Promise<void> {
    const rows = await pgQuery<{ is_active: boolean }>(
      "select is_active from profiles where id = $1",
      [id],
    );
    if (rows.length === 0) throw new Error("Trainee not found");
    if (rows[0].is_active) throw new Error("Cannot delete active trainee");
    await pgQuery("delete from profiles where id = $1", [id]);
  }

  async updateTrainee(
    id: string,
    updates: {
      isRecurring?: boolean;
      preferredDay?: number | null;
      preferredTime?: string | null;
      isActive?: boolean;
      name?: string;
    },
  ): Promise<Profile> {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (updates.isRecurring !== undefined) sets.push(`is_recurring = $${params.push(updates.isRecurring)}`);
    if (updates.preferredDay !== undefined) sets.push(`preferred_day = $${params.push(updates.preferredDay)}`);
    if (updates.preferredTime !== undefined) sets.push(`preferred_time = $${params.push(updates.preferredTime)}`);
    if (updates.isActive !== undefined) sets.push(`is_active = $${params.push(updates.isActive)}`);
    if (updates.name !== undefined) sets.push(`name = $${params.push(updates.name)}`);
    if (sets.length === 0) {
      const cur = await pgQuery<Record<string, unknown>>("select * from profiles where id = $1", [id]);
      if (cur.length === 0) throw new Error("Trainee not found");
      return this.mapProfile(cur[0]);
    }
    params.push(id);
    const rows = await pgQuery<Record<string, unknown>>(
      `update profiles set ${sets.join(", ")} where id = $${params.length} returning *`,
      params,
    );
    if (rows.length === 0) throw new Error("Trainee not found");
    return this.mapProfile(rows[0]);
  }

  private mapProfile(row: Record<string, unknown>): Profile & { email?: string | null; status?: string } {
    return {
      id: row.id as string,
      name: row.name as string,
      role: row.role as UserRole,
      isRecurring: (row.is_recurring as boolean) ?? false,
      preferredDay: row.preferred_day as number | null,
      preferredTime: row.preferred_time ? String(row.preferred_time).slice(0, 5) : null,
      isActive: (row.is_active as boolean) ?? true,
      createdAt: new Date(row.created_at as string),
      email: (row.email as string | null) ?? null,
      status: (row.status as string) ?? ((row.is_active as boolean) ? "active" : "deactivated"),
    };
  }
}
