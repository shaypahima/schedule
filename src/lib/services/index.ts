import { GoogleCalendarService } from "./google-calendar";
import { MockGoogleCalendarService } from "./mock-google-calendar";
import { RealGoogleCalendarService } from "./real-google-calendar";
import { InMemoryTokenStore, TokenStore } from "./token-store";
import { AuthService } from "./auth";
import { MockAuthService } from "./mock-auth";
import { BookingStore, MockBookingStore } from "./booking-service";
import { NotificationService, MockNotificationService } from "./notification";
import { createBookingTransaction, BookingTransaction } from "./booking-transaction";
import { createWeeklyLimits, WeeklyLimits } from "./weekly-limits";
import { SupabaseBookingStore } from "@/lib/supabase/booking-store";
import { SupabaseAuthService } from "@/lib/supabase/auth-service";
import { SupabaseDevAuthService } from "@/lib/supabase/dev-auth-service";
import { getSupabaseClient, getSupabaseAdminClient } from "@/lib/supabase/client";

/** Fully mocked (in-memory, no DB) — for tests */
function isFullMock() {
  return process.env.MOCK_SERVICES === "true";
}

function isMockCalendar() {
  return isFullMock() || process.env.MOCK_CALENDAR === "true";
}

function isMockAuth() {
  return isFullMock() || process.env.MOCK_AUTH === "true";
}

let calendarService: GoogleCalendarService;
let realCalendarService: RealGoogleCalendarService | null = null;
let tokenStore: TokenStore;
let authService: AuthService;
let bookingStore: BookingStore;
let notificationService: NotificationService;

export function getTokenStore(): TokenStore {
  if (!tokenStore) {
    tokenStore = new InMemoryTokenStore();
  }
  return tokenStore;
}

export function getCalendarService(): GoogleCalendarService {
  if (!calendarService) {
    if (isMockCalendar()) {
      calendarService = new MockGoogleCalendarService();
    } else {
      calendarService = new RealGoogleCalendarService(getTokenStore());
    }
  }
  return calendarService;
}

export function getRealCalendarService(): RealGoogleCalendarService | null {
  if (isMockCalendar()) return null;
  if (!realCalendarService) {
    realCalendarService = new RealGoogleCalendarService(getTokenStore());
  }
  return realCalendarService;
}

export function getAuthService(): AuthService {
  if (!authService) {
    if (isFullMock()) {
      // Tests: fully in-memory
      authService = new MockAuthService();
    } else if (isMockAuth()) {
      // Dev: real DB profiles, bypass OTP
      authService = new SupabaseDevAuthService(getSupabaseClient());
    } else {
      // Production: real Supabase Auth with OTP (anon for sign-in, admin for invite)
      authService = new SupabaseAuthService(getSupabaseClient(), getSupabaseAdminClient());
    }
  }
  return authService;
}

export function getBookingStore(): BookingStore {
  if (!bookingStore) {
    if (isFullMock()) {
      bookingStore = new MockBookingStore();
    } else {
      // Service-role client: backend is trusted; route guards enforce
      // role + identity before we hit the store. RLS would otherwise
      // reject queries from the anon client (no auth.uid()).
      bookingStore = new SupabaseBookingStore(getSupabaseAdminClient());
    }
  }
  return bookingStore;
}

export function getNotificationService(): NotificationService {
  if (!notificationService) {
    notificationService = new MockNotificationService();
  }
  return notificationService;
}

// --- Container: unified facade over deep modules ---

export interface Container {
  tx: BookingTransaction;
  limits: WeeklyLimits;
  store: BookingStore;
  auth: AuthService;
}

let _container: Container | null = null;

export function getContainer(overrides?: Partial<Container>): Container {
  if (overrides) {
    const base = buildContainer();
    return { ...base, ...overrides };
  }
  if (!_container) {
    _container = buildContainer();
  }
  return _container;
}

export function resetContainer(): void {
  _container = null;
  calendarService = undefined!;
  realCalendarService = null;
  tokenStore = undefined!;
  authService = undefined!;
  bookingStore = undefined!;
  notificationService = undefined!;
}

function buildContainer(): Container {
  const store = getBookingStore();
  const limits = createWeeklyLimits(store);
  const calendar = isMockCalendar() ? null : getCalendarService();
  const notifier = getNotificationService();
  const tx = createBookingTransaction(store, limits, calendar, notifier);
  const auth = getAuthService();
  return { tx, limits, store, auth };
}
