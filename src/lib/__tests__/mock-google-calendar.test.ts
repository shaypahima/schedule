import { describe, it, expect, beforeEach } from "vitest";
import { MockGoogleCalendarService } from "@/lib/services/mock-google-calendar";

describe("MockGoogleCalendarService", () => {
  let service: MockGoogleCalendarService;

  beforeEach(() => {
    service = new MockGoogleCalendarService();
  });

  describe("getFreeBusy", () => {
    it("returns empty busy array when no busy periods configured", async () => {
      const result = await service.getFreeBusy(
        new Date("2026-04-05T06:00:00"),
        new Date("2026-04-05T20:00:00")
      );
      expect(result.busy).toEqual([]);
    });

    it("returns configured busy periods within the requested range", async () => {
      const busy1 = {
        start: new Date("2026-04-05T09:00:00"),
        end: new Date("2026-04-05T10:00:00"),
      };
      const busy2 = {
        start: new Date("2026-04-05T14:00:00"),
        end: new Date("2026-04-05T15:00:00"),
      };
      service.setBusyPeriods([busy1, busy2]);

      const result = await service.getFreeBusy(
        new Date("2026-04-05T06:00:00"),
        new Date("2026-04-05T20:00:00")
      );
      expect(result.busy).toEqual([busy1, busy2]);
    });

    it("filters out busy periods outside the requested range", async () => {
      const insideRange = {
        start: new Date("2026-04-05T10:00:00"),
        end: new Date("2026-04-05T11:00:00"),
      };
      const outsideRange = {
        start: new Date("2026-04-06T10:00:00"),
        end: new Date("2026-04-06T11:00:00"),
      };
      service.setBusyPeriods([insideRange, outsideRange]);

      const result = await service.getFreeBusy(
        new Date("2026-04-05T06:00:00"),
        new Date("2026-04-05T20:00:00")
      );
      expect(result.busy).toEqual([insideRange]);
    });

    it("includes partially overlapping busy periods", async () => {
      const overlapping = {
        start: new Date("2026-04-05T05:00:00"),
        end: new Date("2026-04-05T07:00:00"),
      };
      service.setBusyPeriods([overlapping]);

      const result = await service.getFreeBusy(
        new Date("2026-04-05T06:00:00"),
        new Date("2026-04-05T20:00:00")
      );
      expect(result.busy).toEqual([overlapping]);
    });
  });

  describe("createEvent", () => {
    it("creates an event and returns it with an ID", async () => {
      const event = await service.createEvent({
        summary: "Training - John",
        start: new Date("2026-04-05T10:00:00"),
        end: new Date("2026-04-05T11:00:00"),
      });

      expect(event.id).toBeDefined();
      expect(event.summary).toBe("Training - John");
      expect(event.start).toEqual(new Date("2026-04-05T10:00:00"));
      expect(event.end).toEqual(new Date("2026-04-05T11:00:00"));
    });

    it("generates unique IDs for each event", async () => {
      const event1 = await service.createEvent({
        summary: "A",
        start: new Date("2026-04-05T10:00:00"),
        end: new Date("2026-04-05T11:00:00"),
      });
      const event2 = await service.createEvent({
        summary: "B",
        start: new Date("2026-04-05T11:00:00"),
        end: new Date("2026-04-05T12:00:00"),
      });

      expect(event1.id).not.toBe(event2.id);
    });

    it("created events appear as busy periods", async () => {
      await service.createEvent({
        summary: "Training",
        start: new Date("2026-04-05T10:00:00"),
        end: new Date("2026-04-05T11:00:00"),
      });

      const result = await service.getFreeBusy(
        new Date("2026-04-05T06:00:00"),
        new Date("2026-04-05T20:00:00")
      );
      expect(result.busy).toHaveLength(1);
      expect(result.busy[0].start).toEqual(new Date("2026-04-05T10:00:00"));
    });
  });

  describe("deleteEvent", () => {
    it("removes an event by ID", async () => {
      const event = await service.createEvent({
        summary: "Training",
        start: new Date("2026-04-05T10:00:00"),
        end: new Date("2026-04-05T11:00:00"),
      });

      await service.deleteEvent(event.id);

      const events = service.getEvents();
      expect(events).toHaveLength(0);
    });

    it("deleted events no longer appear in free/busy", async () => {
      const event = await service.createEvent({
        summary: "Training",
        start: new Date("2026-04-05T10:00:00"),
        end: new Date("2026-04-05T11:00:00"),
      });

      await service.deleteEvent(event.id);

      const result = await service.getFreeBusy(
        new Date("2026-04-05T06:00:00"),
        new Date("2026-04-05T20:00:00")
      );
      expect(result.busy).toHaveLength(0);
    });

    it("throws when deleting a non-existent event", async () => {
      await expect(service.deleteEvent("non-existent")).rejects.toThrow();
    });
  });

  describe("getEvents", () => {
    it("returns all created events", async () => {
      await service.createEvent({
        summary: "A",
        start: new Date("2026-04-05T10:00:00"),
        end: new Date("2026-04-05T11:00:00"),
      });
      await service.createEvent({
        summary: "B",
        start: new Date("2026-04-05T12:00:00"),
        end: new Date("2026-04-05T13:00:00"),
      });

      expect(service.getEvents()).toHaveLength(2);
    });
  });

  describe("reset", () => {
    it("clears all events and busy periods", async () => {
      service.setBusyPeriods([
        {
          start: new Date("2026-04-05T09:00:00"),
          end: new Date("2026-04-05T10:00:00"),
        },
      ]);
      await service.createEvent({
        summary: "Training",
        start: new Date("2026-04-05T10:00:00"),
        end: new Date("2026-04-05T11:00:00"),
      });

      service.reset();

      const result = await service.getFreeBusy(
        new Date("2026-04-05T06:00:00"),
        new Date("2026-04-05T20:00:00")
      );
      expect(result.busy).toHaveLength(0);
      expect(service.getEvents()).toHaveLength(0);
    });
  });
});
