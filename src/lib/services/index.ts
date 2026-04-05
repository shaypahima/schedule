import { GoogleCalendarService } from "./google-calendar";
import { MockGoogleCalendarService } from "./mock-google-calendar";
import { RealGoogleCalendarService } from "./real-google-calendar";
import { InMemoryTokenStore, TokenStore } from "./token-store";
import { AuthService } from "./auth";
import { MockAuthService } from "./mock-auth";
import { BookingService, BookingStore, MockBookingStore } from "./booking-service";
import { NotificationService, MockNotificationService } from "./notification";

const isMock = process.env.MOCK_SERVICES === "true";

let calendarService: GoogleCalendarService;
let realCalendarService: RealGoogleCalendarService | null = null;
let tokenStore: TokenStore;
let authService: AuthService;
let bookingStore: BookingStore;
let notificationService: NotificationService;
let bookingService: BookingService;

export function getTokenStore(): TokenStore {
  if (!tokenStore) {
    // TODO: Replace with Supabase-backed store in Phase 3 (Supabase integration)
    tokenStore = new InMemoryTokenStore();
  }
  return tokenStore;
}

export function getCalendarService(): GoogleCalendarService {
  if (!calendarService) {
    if (isMock) {
      calendarService = new MockGoogleCalendarService();
    } else {
      calendarService = new RealGoogleCalendarService(getTokenStore());
    }
  }
  return calendarService;
}

/**
 * Returns the real calendar service for OAuth2 flows.
 * Returns null if in mock mode.
 */
export function getRealCalendarService(): RealGoogleCalendarService | null {
  if (isMock) return null;
  if (!realCalendarService) {
    realCalendarService = new RealGoogleCalendarService(getTokenStore());
  }
  return realCalendarService;
}

export function getAuthService(): AuthService {
  if (!authService) {
    if (isMock) {
      authService = new MockAuthService();
    } else {
      throw new Error("Real auth service not yet implemented");
    }
  }
  return authService;
}

export function getBookingStore(): BookingStore {
  if (!bookingStore) {
    if (isMock) {
      bookingStore = new MockBookingStore();
    } else {
      throw new Error("Real booking store not yet implemented");
    }
  }
  return bookingStore;
}

export function getNotificationService(): NotificationService {
  if (!notificationService) {
    // TODO: replace with real email/push service in production
    notificationService = new MockNotificationService();
  }
  return notificationService;
}

export function getBookingService(): BookingService {
  if (!bookingService) {
    const calendar = isMock ? undefined : getCalendarService();
    bookingService = new BookingService(
      getBookingStore(),
      calendar,
      getNotificationService()
    );
  }
  return bookingService;
}
