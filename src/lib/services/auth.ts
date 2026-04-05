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
}

export interface MockUser {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
}
