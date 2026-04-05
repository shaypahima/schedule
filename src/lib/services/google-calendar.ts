import { FreeBusyResponse, CalendarEvent, CreateEventParams } from "@/lib/types";

export interface GoogleCalendarService {
  /** Get busy periods for a date range */
  getFreeBusy(start: Date, end: Date): Promise<FreeBusyResponse>;

  /** Create a calendar event, returns event ID */
  createEvent(params: CreateEventParams): Promise<CalendarEvent>;

  /** Delete a calendar event by ID */
  deleteEvent(eventId: string): Promise<void>;
}
