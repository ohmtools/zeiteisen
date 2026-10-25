import type { Day } from "@/lib/primitives/subject";
import { DAYS } from "@/lib/primitives/week";

// A horizontal touch swipe on the grid moves to the previous/next day on
// phones; where every day is shown, to the previous/next week (Current week
// only: a tablet swiped and nothing seemed to happen).
const SWIPE_MIN_PX = 50;

// How far a touch moves before its way counts, as a press's (`SubjectBlock`).
const SLOP_PX = 10;

// -1 back, 1 forward, 0 no swipe.
export function swipeDirection(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}

// The way a touch first went once it left the slop, null before. "y" is a
// scroll, never a swipe, however it ends: the browser scrolls with it, and
// touch events end it all the same (pointer events cancelled it).
export function firstAxis(dx: number, dy: number): "x" | "y" | null {
  if (Math.abs(dx) <= SLOP_PX && Math.abs(dy) <= SLOP_PX) return null;
  return Math.abs(dy) > Math.abs(dx) ? "y" : "x";
}

// Where a phone's swipe goes from `day`: the next day that way; past "Other"
// on to next week's Monday, before Monday back to last week's "Other" (user
// request) where there are weeks (`week` says which way), null at the ends
// of the general view.
export function swipeStep(
  day: Day,
  direction: -1 | 1,
  weeks: boolean,
): { day: Day; week: -1 | 0 | 1 } | null {
  const next = DAYS[DAYS.indexOf(day) + direction];
  if (next) return { day: next, week: 0 };
  if (!weeks) return null;
  return { day: direction === 1 ? DAYS[0] : DAYS[DAYS.length - 1], week: direction };
}
