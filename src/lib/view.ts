import { addDays, isSunday, isWithinInterval, startOfDay, startOfISOWeek } from "date-fns";
import type { SemesterDates } from "@/lib/primitives/meta";
import { lectureRange } from "@/lib/primitives/occurrence";
import type { Day } from "@/lib/primitives/subject";
import { dayOf } from "@/lib/primitives/week";

// Sunday already belongs to the week ahead (user decision): the week's
// classes are over, the next week's are what a student looks up then.
function weekDate(now: Date): Date {
  return isSunday(now) ? addDays(now, 1) : now;
}

// The grid view the app opens on (not persisted): this week while today is
// inside the lecture period of the installed dates — that is what a student
// looks up then. The general grid otherwise: no dates, or before / after the
// period, when there is no "this week" worth showing. On Sunday, "today" is
// the Monday ahead, as for the shown week.
export function defaultView(dates: SemesterDates | null, today: Date): "general" | "week" {
  const range = lectureRange(dates);
  if (!range) return "general";
  return isWithinInterval(startOfDay(weekDate(today)), range) ? "week" : "general";
}

// A week or day the user picked, remembered with the week or day it was
// picked in (an epoch ms, `startOfISOWeek` / `startOfDay`).
export type Picked<T> = { value: T; pickedIn: number };

// The pick while the week or day it was made in lasts, else `now`'s own: an
// app left open over the weekend shows the new week on Monday (and a phone
// the new day after midnight), as a fresh start would, while a week the user
// is browsing stays put.
function held<T>(picked: Picked<T> | null, pickedIn: number, fallback: T): T {
  return picked !== null && picked.pickedIn === pickedIn ? picked.value : fallback;
}

// The Monday the week view shows, as epoch ms: a number, so what depends on it
// is only recomputed when it really moves, not on every tick of `now`. On
// Sunday the next one, so a pick made then holds until Saturday.
export function shownWeek(picked: Picked<number> | null, now: Date): number {
  const thisWeek = startOfISOWeek(weekDate(now)).getTime();
  return held(picked, thisWeek, thisWeek);
}

// From this hour on the phone grid shows the next day (user decision): the
// day's classes are over, tomorrow's are what a student looks up.
const NEXT_DAY_HOUR = 19;

// The date the phone grid's day stands for: today, from `NEXT_DAY_HOUR` on
// tomorrow — and all Sunday the Monday ahead, the first day of the week
// shown with it (Saturday evening stays on the weekend list).
function phoneDate(now: Date): Date {
  if (isSunday(now) || now.getHours() >= NEXT_DAY_HOUR) return addDays(now, 1);
  return now;
}

// What a day pick is remembered with: the phone day it was made on, so it
// holds until the grid would move on by itself.
export function dayPickedIn(now: Date): number {
  return startOfDay(phoneDate(now)).getTime();
}

// The day the phone grid shows.
export function shownDay(picked: Picked<Day> | null, now: Date): Day {
  return held(picked, dayPickedIn(now), dayOf(phoneDate(now)));
}
