import { Profile, UserRole } from "@/lib/types";

export interface AuthService {
  /** Send OTP to phone number */
  sendOtp(phone: string): Promise<void>;

  /** Verify OTP and return user profile */
  verifyOtp(phone: string, code: string): Promise<Profile>;

  /** Get current user profile (null if not logged in) */
  getCurrentUser(): Promise<Profile | null>;

  /** Sign out */
  signOut(): Promise<void>;

  /** List all trainees */
  getTrainees(): Promise<Profile[]>;

  /** Invite new trainee by phone */
  inviteTrainee(phone: string, name: string): Promise<Profile>;

  /** Update trainee recurring settings */
  updateTrainee(id: string, updates: {
    isRecurring?: boolean;
    preferredDay?: number | null;
    preferredTime?: string | null;
    isActive?: boolean;
    name?: string;
  }): Promise<Profile>;
}

export interface MockUser {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
}
