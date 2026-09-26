import { addWeeks, isAfter, isBefore, parseISO, startOfDay, startOfISOWeek } from "date-fns";
import type { SemesterDates } from "./meta";
import type { Subject, Time } from "./subject";
import { eventsForWeek, meetingsInWeek, semesterWeek, type Meeting } from "./week";

// The dates a subject is actually taught on, for the calendar export. Built on
// the same week rules as the current-week view (`meetingsInWeek`), so what the
// grid shows for a week and what the export holds for it never drift apart.

export type DateRange = { start: Date; end: Date };

// The lecture period, `null` without dates or with an inverted period (the
// caller then asks the user for a range).
export function lectureRange(dates: SemesterDates | null): DateRange | null {
  if (!dates) return null;
  const start = parseISO(dates.lectureStart);
  const end = parseISO(dates.lectureEnd);
  return isAfter(start, end) ? null : { start, end };
}

// `index` is the subject's position in the list handed in; `meeting` holds the
// time, room and professor of this date.
export type Occurrence = { subject: Subject; index: number; meeting: Meeting; date: Date };

// Every date inside `range` (both ends included) each subject is taught on.
// A weekly `Day.other` has no weekday and therefore no date: it never occurs;
// listed dates on a weekend do. Each week counts in its own semester
// (`semesterWeek`), so a range across a semester begin switches the rhythm
// there, like the week view does.
export function occurrencesOf(
  subjects: readonly Subject[],
  range: DateRange,
  dates: SemesterDates | null,
): Occurrence[] {
  const occurrences: Occurrence[] = [];
  const from = startOfDay(range.start);
  const to = startOfDay(range.end);

  for (
    let weekStart = startOfISOWeek(from);
    !isAfter(weekStart, to);
    weekStart = addWeeks(weekStart, 1)
  ) {
    const week = semesterWeek(weekStart);
    const events = eventsForWeek(dates, weekStart);
    subjects.forEach((subject, index) => {
      for (const meeting of meetingsInWeek(subject.repeat, week, weekStart, events)) {
        if (meeting.date === null) continue;
        const date = parseISO(meeting.date);
        if (isBefore(date, from) || isAfter(date, to)) continue;
        occurrences.push({ subject, index, meeting, date });
      }
    });
  }

  return occurrences;
}

// Timetable times are wall-clock times at the university.
export const TIME_ZONE = "Europe/Berlin";

// How far `timeZone` is ahead of UTC at `date`, in milliseconds. Read from
// `Intl` rather than hardcoded, so a DST switch inside the semester is right.
function zoneOffset(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second"),
  );
  return asUtc - date.getTime();
}

// The instant a wall-clock `time` on `date`'s calendar day is in `timeZone`.
// The offset depends on the instant looked for, so it is applied twice: the
// first pass lands within an hour, the second uses the offset in force then.
export function wallClockInstant(date: Date, time: Time, timeZone = TIME_ZONE): Date {
  const wall = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    time.hour,
    time.minute,
  );
  const first = wall - zoneOffset(new Date(wall), timeZone);
  return new Date(wall - zoneOffset(new Date(first), timeZone));
}
