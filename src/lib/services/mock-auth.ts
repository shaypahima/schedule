import { Profile } from "@/lib/types";
import { AuthService, MockUser } from "./auth";

const MOCK_USERS: MockUser[] = [
  { id: "admin-001", phone: "+972500000000", name: "Coach", role: "admin" },
  { id: "trainee-001", phone: "+972500000001", name: "Avi Cohen", role: "trainee" },
  { id: "trainee-002", phone: "+972500000002", name: "Dana Levi", role: "trainee" },
  { id: "trainee-003", phone: "+972500000003", name: "Yael Mizrahi", role: "trainee" },
];

export class MockAuthService implements AuthService {
  private currentUser: Profile | null = null;
  private users: MockUser[];

  constructor(users?: MockUser[]) {
    this.users = users ?? MOCK_USERS;
  }

  async sendOtp(_phone: string): Promise<void> {
    // In mock mode, OTP is always "000000"
  }

  async verifyOtp(phone: string, _code: string): Promise<Profile> {
    // Any code works in mock mode
    const user = this.users.find((u) => u.phone === phone);
    if (!user) {
      // Auto-create trainee for unknown phone numbers
      const newUser: MockUser = {
        id: `trainee-auto-${Date.now()}`,
        phone,
        name: `Trainee ${phone.slice(-4)}`,
        role: "trainee",
      };
      this.users.push(newUser);
      this.currentUser = this.toProfile(newUser);
      return this.currentUser;
    }

    this.currentUser = this.toProfile(user);
    return this.currentUser;
  }

  async getCurrentUser(): Promise<Profile | null> {
    return this.currentUser;
  }

  async signOut(): Promise<void> {
    this.currentUser = null;
  }

  async getTrainees(): Promise<Profile[]> {
    return this.users
      .filter((u) => u.role === "trainee")
      .map((u) => this.toProfileWithOverrides(u));
  }

  async inviteTrainee(phone: string, name: string): Promise<Profile> {
    const existing = this.users.find((u) => u.phone === phone);
    if (existing) throw new Error("Phone already registered");
    const user: MockUser = {
      id: `trainee-${Date.now()}`,
      phone,
      name,
      role: "trainee",
    };
    this.users.push(user);
    return this.toProfile(user);
  }

  async updateTrainee(id: string, updates: {
    isRecurring?: boolean;
    preferredDay?: number | null;
    preferredTime?: string | null;
    isActive?: boolean;
    name?: string;
  }): Promise<Profile> {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new Error("Trainee not found");
    if (updates.name !== undefined) user.name = updates.name;
    const profile = this.toProfile(user);
    if (updates.isRecurring !== undefined) profile.isRecurring = updates.isRecurring;
    if (updates.preferredDay !== undefined) profile.preferredDay = updates.preferredDay;
    if (updates.preferredTime !== undefined) profile.preferredTime = updates.preferredTime;
    if (updates.isActive !== undefined) profile.isActive = updates.isActive;
    // Store the extended profile data — in mock mode we keep a map
    this.profileOverrides.set(id, profile);
    return profile;
  }

  private profileOverrides = new Map<string, Profile>();

  private toProfileWithOverrides(user: MockUser): Profile {
    const override = this.profileOverrides.get(user.id);
    if (override) return { ...override, name: user.name };
    return this.toProfile(user);
  }

  /** Set current user directly (for testing) */
  setCurrentUser(user: MockUser): void {
    this.currentUser = this.toProfile(user);
  }

  private toProfile(user: MockUser): Profile {
    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      isRecurring: false,
      preferredDay: null,
      preferredTime: null,
      isActive: true,
      createdAt: new Date(),
    };
  }
}
