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
