import {
  addDays,
  areIntervalsOverlapping,
  endOfISOWeek,
  isSaturday,
  isSunday,
  setHours,
  startOfDay,
  startOfISOWeek,
} from "date-fns";
import type { SemesterDates } from "@/lib/primitives/meta";
import { lectureRange } from "@/lib/primitives/occurrence";
import type { Day } from "@/lib/primitives/subject";
import { dayOf } from "@/lib/primitives/week";

// Sunday already belongs to the week ahead (user decision): the week's
// classes are over, the next week's are what a student looks up then.
function weekDate(now: Date): Date {
  return isSunday(now) ? addDays(now, 1) : now;
}

// The week the app opens on, as epoch ms of its Monday: this one, on Sunday
// the next.
export function openingWeek(now: Date): number {
  return startOfISOWeek(weekDate(now)).getTime();
}

// The calendar week, the one holding today (on Sunday the one ending): what
// "This week" and today's mark go by.
export function calendarWeek(now: Date): number {
  return startOfISOWeek(now).getTime();
}

// The grid view the app opens on (not persisted): this week while what is
// left of it, from today (on Sunday the Monday ahead) to its Sunday, reaches
// into the lecture period of the installed dates — that is what a student
// looks up then. The general grid otherwise: no dates, or before / after the
// period, when there is no "this week" worth showing.
export function defaultView(dates: SemesterDates | null, today: Date): "general" | "week" {
  const range = lectureRange(dates);
  if (!range) return "general";
  const from = startOfDay(weekDate(today));
  const left = { start: from, end: endOfISOWeek(from) };
  return areIntervalsOverlapping(left, range, { inclusive: true }) ? "week" : "general";
}

// A week or day the user picked, and until when it holds (epoch ms): until
// the grid would move on by itself, so an app left open moves on as a fresh
// start would, while a week the user is browsing stays put.
export type Picked<T> = { value: T; until: number };

// The pick while it holds, else null.
export function current<T>(picked: Picked<T> | null, now: Date): T | null {
  return picked !== null && now.getTime() < picked.until ? picked.value : null;
}

// A week pick holds until the week the app opens on moves on, at the next
// Sunday's midnight, so one made on Sunday holds until Saturday. One looking
// back on Sunday only until Monday's: it looks at the week ending then, and
// Monday opens on the new week, as a fresh start would.
export function weekPick(value: number, now: Date): Picked<number> {
  const opening = openingWeek(now);
  const back = isSunday(now) && value < opening;
  return { value, until: back ? opening : addDays(opening, 6).getTime() };
}

// The Monday the week view shows, as epoch ms: a number, so what depends on it
// is only recomputed when it really moves, not on every tick of `now`.
export function shownWeek(picked: Picked<number> | null, now: Date): number {
  return current(picked, now) ?? openingWeek(now);
}

// From this hour on the phone grid shows the next day (user decision): the
// day's classes are over, tomorrow's are what a student looks up.
const NEXT_DAY_HOUR = 19;

// The date the phone grid's day stands for in `week`: today, from
// `NEXT_DAY_HOUR` on tomorrow (Saturday evening the weekend list); all Sunday
// the Monday ahead, but Sunday itself in the week ending.
function phoneDate(now: Date, week: number): Date {
  if (isSunday(now)) return week === calendarWeek(now) ? now : weekDate(now);
  return now.getHours() >= NEXT_DAY_HOUR ? addDays(now, 1) : now;
}

// Until the next `NEXT_DAY_HOUR`, Saturday evening only until midnight: the
// phone's day turns to the Monday ahead then.
function dayEnd(now: Date): number {
  const evening = setHours(startOfDay(now), NEXT_DAY_HOUR);
  if (now < evening) return evening.getTime();
  return (isSaturday(now) ? addDays(startOfDay(now), 1) : addDays(evening, 1)).getTime();
}

// A day pick holds until the phone's day moves on by itself (`dayEnd`) in the
// week the app opens on; in a week the user picked as long as that pick, so
// the day does not move there with the clock.
export function dayPick(value: Day, week: Picked<number> | null, now: Date): Picked<Day> {
  const picked = week !== null && current(week, now) !== null && week.value !== openingWeek(now);
  return { value, until: picked ? week.until : dayEnd(now) };
}

// The day the phone grid shows in `week`, the week shown with it.
export function shownDay(picked: Picked<Day> | null, now: Date, week: number): Day {
  return current(picked, now) ?? dayOf(phoneDate(now, week));
}
