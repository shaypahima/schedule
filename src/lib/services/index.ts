import { GoogleCalendarService } from "./google-calendar";
import { MockGoogleCalendarService } from "./mock-google-calendar";
import { RealGoogleCalendarService } from "./real-google-calendar";
import { InMemoryTokenStore, TokenStore } from "./token-store";
import { AuthService } from "./auth";
import { BookingStore, MockBookingStore } from "./booking-store";
import { NotificationService, MockNotificationService } from "./notification";
import { Bookings, makeBookings } from "./bookings";
import { CoachReadModel } from "@/lib/coach/read-model";
import { makeCoachReadModel } from "@/lib/coach/mock-read-model";
import { SupabaseBookingStore } from "@/lib/supabase/booking-store";
import { SupabaseAuthService, MockAuthService } from "@/lib/supabase/auth-service";
import { getSupabaseClient, getSupabaseAdminClient } from "@/lib/supabase/client";

function isFullMock() {
  return process.env.MOCK_SERVICES === "true";
}

function isMockCalendar() {
  return isFullMock() || process.env.MOCK_CALENDAR === "true";
}

let calendarService: GoogleCalendarService;
let realCalendarService: RealGoogleCalendarService | null = null;
let tokenStore: TokenStore;
let authService: AuthService;
let bookingStore: BookingStore;
let notificationService: NotificationService;

export function getTokenStore(): TokenStore {
  if (!tokenStore) tokenStore = new InMemoryTokenStore();
  return tokenStore;
}

export function getCalendarService(): GoogleCalendarService {
  if (!calendarService) {
    calendarService = isMockCalendar()
      ? new MockGoogleCalendarService()
      : new RealGoogleCalendarService(getTokenStore());
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
    authService = isFullMock()
      ? new MockAuthService()
      : new SupabaseAuthService(getSupabaseClient(), getSupabaseAdminClient());
  }
  return authService;
}

export function getBookingStore(): BookingStore {
  if (!bookingStore) {
    bookingStore = isFullMock()
      ? new MockBookingStore()
      : new SupabaseBookingStore(getSupabaseAdminClient());
  }
  return bookingStore;
}

export function getNotificationService(): NotificationService {
  if (!notificationService) {
    notificationService = new MockNotificationService();
  }
  return notificationService;
}

/**
 * Container — unified facade over the booking domain.
 *
 * Tests MUST use getContainer(overrides) rather than reaching for global
 * factories like getBookingStore() so the override path is honored.
 */
export interface Container {
  store: BookingStore;
  bookings: Bookings;
  auth: AuthService;
  coachRead: CoachReadModel;
}

let _container: Container | null = null;

export function getContainer(overrides?: Partial<Container>): Container {
  if (overrides) return { ...buildContainer(), ...overrides };
  if (!_container) _container = buildContainer();
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
  const calendar = isMockCalendar() ? null : getCalendarService();
  const notifier = getNotificationService();
  const bookings = makeBookings(store, calendar, notifier);
  const auth = getAuthService();
  const coachRead = makeCoachReadModel(store, auth, bookings);
  return { store, bookings, auth, coachRead };
}
