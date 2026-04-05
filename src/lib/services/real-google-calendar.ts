import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import {
  FreeBusyResponse,
  CalendarEvent,
  CreateEventParams,
} from "@/lib/types";
import { GoogleCalendarService } from "./google-calendar";
import { TokenStore } from "./token-store";

export function createOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(oauth2Client: OAuth2Client): string {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar"],
  });
}

export class RealGoogleCalendarService implements GoogleCalendarService {
  private oauth2Client: OAuth2Client;

  constructor(private tokenStore: TokenStore) {
    this.oauth2Client = createOAuth2Client();
  }

  private async ensureAuth(): Promise<void> {
    const tokens = await this.tokenStore.getTokens();
    if (!tokens) {
      throw new Error("Google Calendar not connected. Coach must authorize first.");
    }

    this.oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.expiresAt,
    });

    // Auto-refresh if expired
    if (tokens.expiresAt < Date.now()) {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      await this.tokenStore.setTokens({
        accessToken: credentials.access_token!,
        refreshToken: credentials.refresh_token || tokens.refreshToken,
        expiresAt: credentials.expiry_date || Date.now() + 3600_000,
      });
    }
  }

  async getFreeBusy(start: Date, end: Date): Promise<FreeBusyResponse> {
    await this.ensureAuth();
    const calendar = google.calendar({ version: "v3", auth: this.oauth2Client });

    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: "primary" }],
      },
    });

    const busy = (res.data.calendars?.primary?.busy || []).map((b) => ({
      start: new Date(b.start!),
      end: new Date(b.end!),
    }));

    return { busy };
  }

  async createEvent(params: CreateEventParams): Promise<CalendarEvent> {
    await this.ensureAuth();
    const calendar = google.calendar({ version: "v3", auth: this.oauth2Client });

    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: params.summary,
        start: {
          dateTime: params.start.toISOString(),
          timeZone: "Asia/Jerusalem",
        },
        end: {
          dateTime: params.end.toISOString(),
          timeZone: "Asia/Jerusalem",
        },
      },
    });

    return {
      id: res.data.id!,
      summary: res.data.summary || params.summary,
      start: new Date(res.data.start?.dateTime || params.start),
      end: new Date(res.data.end?.dateTime || params.end),
    };
  }

  async deleteEvent(eventId: string): Promise<void> {
    await this.ensureAuth();
    const calendar = google.calendar({ version: "v3", auth: this.oauth2Client });

    await calendar.events.delete({
      calendarId: "primary",
      eventId,
    });
  }

  /**
   * Exchange authorization code for tokens after OAuth2 callback
   */
  async handleAuthCallback(code: string): Promise<void> {
    const { tokens } = await this.oauth2Client.getToken(code);
    await this.tokenStore.setTokens({
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token!,
      expiresAt: tokens.expiry_date || Date.now() + 3600_000,
    });
  }

  getAuthUrl(): string {
    return getAuthUrl(this.oauth2Client);
  }

  async isConnected(): Promise<boolean> {
    const tokens = await this.tokenStore.getTokens();
    return tokens !== null;
  }
}
