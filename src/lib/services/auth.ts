import { Profile } from "@/lib/types";

export interface AuthService {
  /** Get current user profile (null if not logged in) */
  getCurrentUser(): Promise<Profile | null>;

  /** Sign out */
  signOut(): Promise<void>;

  /** List all trainees */
  getTrainees(): Promise<Profile[]>;

  /** Delete a deactivated trainee entirely */
  deleteTrainee(id: string): Promise<void>;

  /** Update trainee recurring settings */
  updateTrainee(id: string, updates: {
    isRecurring?: boolean;
    preferredDay?: number | null;
    preferredTime?: string | null;
    isActive?: boolean;
    name?: string;
  }): Promise<Profile>;
}
