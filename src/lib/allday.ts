import type { Day } from "@/lib/primitives/subject";
import type { GlobalEvent } from "@/lib/primitives/meta";
import { DAYS } from "@/lib/primitives/week";

// The all-day row is one line, always (user decision): a day with several
// events shows the first and "+n", a press lists them all. Neighbouring
// columns with the very same events share one chip ("Mi–Fr").
export type AllDaySegment = {
  // First and last column, as indexes into `DAYS` (Mon-Fri, then `other`).
  from: number;
  to: number;
  // In the order the chip shows them: a lecture-free day first (it wins the
  // line), then by start, the longer one first.
  events: GlobalEvent[];
};

function ordered(events: readonly GlobalEvent[]): GlobalEvent[] {
  return [...events].sort(
    (a, b) =>
      Number(b.noLectures) - Number(a.noLectures) ||
      a.startDate.localeCompare(b.startDate) ||
      (b.endDate ?? b.startDate).localeCompare(a.endDate ?? a.startDate),
  );
}

function same(a: readonly GlobalEvent[], b: readonly GlobalEvent[]): boolean {
  return a.length === b.length && a.every((event, i) => event === b[i]);
}

// The chips of a week, for the columns `days` (all of `DAYS`, or the one
// day a phone shows).
export function allDaySegments(
  events: Record<Day, GlobalEvent[]>,
  days: readonly Day[] = DAYS,
): AllDaySegment[] {
  const segments: AllDaySegment[] = [];
  days.forEach((day, i) => {
    const here = ordered(events[day]);
    if (here.length === 0) return;
    const last = segments.at(-1);
    if (last && last.to === i - 1 && same(last.events, here)) last.to = i;
    else segments.push({ from: i, to: i, events: here });
  });
  return segments;
}
