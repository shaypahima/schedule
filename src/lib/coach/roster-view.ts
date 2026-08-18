import type { RosterEntry } from "./read-model";

export type RosterRow = RosterEntry & { isPast: boolean };

/**
 * Tag each roster entry with whether its session has already happened — the
 * coach can only mark a no-show after the fact. Reads the clock here rather
 * than in a component, which must stay pure.
 */
export function withPastFlag(
  entries: RosterEntry[],
  now: number = Date.now(),
): RosterRow[] {
  return entries.map((entry) => ({
    ...entry,
    isPast: new Date(entry.startsAt).getTime() < now,
  }));
}
