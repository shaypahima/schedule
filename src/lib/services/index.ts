import { GoogleCalendarService } from "./google-calendar";
import { MockGoogleCalendarService } from "./mock-google-calendar";
import { AuthService } from "./auth";
import { MockAuthService } from "./mock-auth";
import { BookingService, BookingStore, MockBookingStore } from "./booking-service";

const isMock = process.env.MOCK_SERVICES === "true";

let calendarService: GoogleCalendarService;
let authService: AuthService;
let bookingStore: BookingStore;
let bookingService: BookingService;

export function getCalendarService(): GoogleCalendarService {
  if (!calendarService) {
    if (isMock) {
      calendarService = new MockGoogleCalendarService();
    } else {
      throw new Error("Real Google Calendar service not yet implemented");
    }
  }
  return calendarService;
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

export function getBookingService(): BookingService {
  if (!bookingService) {
    bookingService = new BookingService(getBookingStore());
  }
  return bookingService;
}
