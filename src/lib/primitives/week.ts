import {
  addDays,
  differenceInCalendarWeeks,
  isAfter,
  isWithinInterval,
  parseISO,
  startOfISOWeek,
} from "date-fns";
import type { GlobalEvent, SemesterDates } from "./meta";
import { Day, minutesOf, type Repeat, type Slot, type WeeklyRepeatType } from "./subject";

// Mon-Fri, then `other`: the grid's columns.
export const DAYS: readonly Day[] = Object.values(Day);

// A semester begins on 01.10. (winter) or 15.03. (summer).
function beginsIn(year: number): Date[] {
  return [new Date(year, 2, 15), new Date(year, 9, 1)];
}

// The begin of the semester the Mon-Sun week of `weekStart` belongs to: the
// last one on or before its Sunday, so a week containing a begin is already
// week 1 of the new semester (user decision). Only the calendar decides: not
// the dates file, not today.
export function semesterBegin(weekStart: Date): Date {
  const sunday = addDays(startOfISOWeek(weekStart), 6);
  const past = [sunday.getFullYear() - 1, sunday.getFullYear()]
    .flatMap(beginsIn)
    .filter((d) => !isAfter(d, sunday));
  return past[past.length - 1];
}

// Week 1 is the Mon-Sun week containing its semester's begin, so every week
// has a number from 1 up.
export function semesterWeek(weekStart: Date): number {
  const begin = semesterBegin(weekStart);
  return differenceInCalendarWeeks(weekStart, startOfISOWeek(begin), { weekStartsOn: 1 }) + 1;
}

// Proper modulo, so weeks before week 1 keep a consistent rhythm.
const mod = (n: number, d: number) => ((n % d) + d) % d;

// Week 1 is odd. G = gerade (even), U = ungerade (odd); G1/G2 start at the
// 1st/2nd even week (weeks 2/4), U1/U2 at the 1st/2nd odd week (weeks 1/3).
export function repeatMatches(type: WeeklyRepeatType, week: number): boolean {
  switch (type) {
    case "A":
    case "SH1":
    case "SH2":
      return true;
    case "G":
      return mod(week, 2) === 0;
    case "U":
      return mod(week, 2) === 1;
    case "G1":
      return mod(week - 2, 4) === 0;
    case "G2":
      return mod(week - 4, 4) === 0;
    case "U1":
      return mod(week - 1, 4) === 0;
    case "U2":
      return mod(week - 3, 4) === 0;
  }
}

// SH1/SH2 have no known date range: always shown, flagged by a warning.
export function isUnclearRepeat(repeat: Repeat): boolean {
  return repeat.type === "SH1" || repeat.type === "SH2";
}

// A date's own calendar day, ISO YYYY-MM-DD, what `DatedSlot.date` holds. By
// hand rather than date-fns' `format`, whose formatter and locale would ride
// along into the first load for this one pattern.
export function isoDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Column of a date: Mon-Fri map to their day, the weekend to `other`.
export function dayOf(date: Date): Day {
  return DAYS[Math.min((date.getDay() + 6) % 7, 5)];
}

export type WeekEvents = {
  // Events per column. A multi-day event appears once per covered weekday and
  // once in `other` if it covers the weekend.
  events: Record<Day, GlobalEvent[]>;
  // Columns without lectures: a weekday covered by a `noLectures` event, or
  // `other` when the whole week is covered.
  noLectures: Set<Day>;
  // Columns outside lectureStart..lectureEnd: lectures hidden, no overlay.
  // `other` only when no day of the week lies inside the lecture period.
  outsidePeriod: Set<Day>;
};

// Without dates there are no events and no lecture period to clip to.
export function eventsForWeek(dates: SemesterDates | null, weekStart: Date): WeekEvents {
  const events = Object.fromEntries(DAYS.map((day) => [day, []])) as unknown as Record<
    Day,
    GlobalEvent[]
  >;
  const blockedDays = new Array<boolean>(7).fill(false);
  const outsideDays = new Array<boolean>(7).fill(false);

  if (dates) {
    const period = { start: parseISO(dates.lectureStart), end: parseISO(dates.lectureEnd) };
    for (let i = 0; i < 7; i++) {
      outsideDays[i] = !(
        period.start <= period.end && isWithinInterval(addDays(weekStart, i), period)
      );
    }
  }

  for (const event of dates?.events ?? []) {
    const interval = {
      start: parseISO(event.startDate),
      end: parseISO(event.endDate ?? event.startDate),
    };
    if (interval.end < interval.start) continue;
    for (let i = 0; i < 7; i++) {
      if (!isWithinInterval(addDays(weekStart, i), interval)) continue;
      const day = dayOf(addDays(weekStart, i));
      if (!events[day].includes(event)) events[day].push(event);
      if (event.noLectures) blockedDays[i] = true;
    }
  }

  const noLectures = new Set<Day>();
  blockedDays.slice(0, 5).forEach((blocked, i) => blocked && noLectures.add(DAYS[i]));
  if (blockedDays.every(Boolean)) noLectures.add(Day.other);

  const outsidePeriod = new Set<Day>();
  outsideDays.slice(0, 5).forEach((outside, i) => outside && outsidePeriod.add(DAYS[i]));
  if (outsideDays.every(Boolean)) outsidePeriod.add(Day.other);

  return { events, noLectures, outsidePeriod };
}

// One meeting of a subject in a grid column: a weekly subject has one, a
// dated subject one per date. `date` (ISO YYYY-MM-DD) is set for a dated
// meeting and for any meeting placed in a concrete week (`meetingsInWeek`);
// `null` for a weekly rhythm outside a week and for `Day.other`, which has no
// single date.
export type Meeting = Slot & { day: Day; date: string | null };

// From what happens first to what happens last: weekday (`DAYS` order), then
// date (Saturday before Sunday in `other`), then start, then end.
export function compareMeetings(a: Meeting, b: Meeting): number {
  return (
    DAYS.indexOf(a.day) - DAYS.indexOf(b.day) ||
    (a.date ?? "").localeCompare(b.date ?? "") ||
    minutesOf(a.startTime) - minutesOf(b.startTime) ||
    minutesOf(a.endTime) - minutesOf(b.endTime)
  );
}

function dayOfIso(date: string): Day {
  return dayOf(parseISO(date));
}

export function meetingsOf(repeat: Repeat): Meeting[] {
  if (repeat.type === "I") {
    return repeat.dates.map(({ date, ...slot }) => ({ ...slot, day: dayOfIso(date), date }));
  }
  const { professor, location, startTime, endTime, day } = repeat;
  return [{ professor, location, startTime, endTime, day, date: null }];
}

// The column of the general grid (no week picked): a plain weekly rhythm sits
// on its weekday; SH1/SH2 (no known range), dates and weekend classes all go to
// `other`.
export function generalColumn(repeat: Repeat): Day {
  if (repeat.type === "I" || isUnclearRepeat(repeat)) return Day.other;
  return repeat.day;
}

// The meetings of a subject in the week starting `weekStart` (semester week
// `week`). A weekly rhythm meets when it matches the week and its column is
// neither a no-lectures day nor outside the lecture period. A listed date wins
// over both: it meets whenever it falls inside the week. The single filter for
// the week view AND the export.
export function meetingsInWeek(
  repeat: Repeat,
  week: number,
  weekStart: Date,
  events: WeekEvents,
): Meeting[] {
  if (repeat.type === "I") {
    const first = isoDay(weekStart);
    const last = isoDay(addDays(weekStart, 6));
    return meetingsOf(repeat).filter(({ date }) => date !== null && date >= first && date <= last);
  }
  if (
    !repeatMatches(repeat.type, week) ||
    events.noLectures.has(repeat.day) ||
    events.outsidePeriod.has(repeat.day)
  ) {
    return [];
  }
  return meetingsOf(repeat).map((meeting) => ({
    ...meeting,
    date: meeting.day === Day.other ? null : isoDay(addDays(weekStart, DAYS.indexOf(meeting.day))),
  }));
}
