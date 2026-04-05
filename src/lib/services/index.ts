import { GoogleCalendarService } from "./google-calendar";
import { MockGoogleCalendarService } from "./mock-google-calendar";
import { AuthService } from "./auth";
import { MockAuthService } from "./mock-auth";

const isMock = process.env.MOCK_SERVICES === "true";

let calendarService: GoogleCalendarService;
let authService: AuthService;

export function getCalendarService(): GoogleCalendarService {
  if (!calendarService) {
    if (isMock) {
      calendarService = new MockGoogleCalendarService();
    } else {
      // TODO: Real Google Calendar service (Phase 4)
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
      // TODO: Real Supabase auth service (Phase 3)
      throw new Error("Real auth service not yet implemented");
    }
  }
  return authService;
}
