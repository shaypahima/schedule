import {
  FreeBusyResponse,
  CalendarEvent,
  CreateEventParams,
  TimePeriod,
} from "@/lib/types";
import { GoogleCalendarService } from "./google-calendar";

export class MockGoogleCalendarService implements GoogleCalendarService {
  private busyPeriods: TimePeriod[] = [];
  private events: CalendarEvent[] = [];
  private nextId = 1;

  setBusyPeriods(periods: TimePeriod[]): void {
    this.busyPeriods = [...periods];
  }

  async getFreeBusy(start: Date, end: Date): Promise<FreeBusyResponse> {
    const allBusy = [...this.busyPeriods, ...this.events.map((e) => ({ start: e.start, end: e.end }))];

    const filtered = allBusy.filter(
      (period) => period.start < end && period.end > start
    );

    return { busy: filtered };
  }

  async createEvent(params: CreateEventParams): Promise<CalendarEvent> {
    const event: CalendarEvent = {
      id: `mock-event-${this.nextId++}`,
      summary: params.summary,
      start: params.start,
      end: params.end,
    };
    this.events.push(event);
    return event;
  }

  async deleteEvent(eventId: string): Promise<void> {
    const index = this.events.findIndex((e) => e.id === eventId);
    if (index === -1) {
      throw new Error(`Event not found: ${eventId}`);
    }
    this.events.splice(index, 1);
  }

  getEvents(): CalendarEvent[] {
    return [...this.events];
  }

  reset(): void {
    this.busyPeriods = [];
    this.events = [];
    this.nextId = 1;
  }
}
