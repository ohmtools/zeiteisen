import { isWithinInterval, startOfDay } from "date-fns";
import type { SemesterDates } from "@/lib/primitives/meta";
import { lectureRange } from "@/lib/primitives/occurrence";

// The grid view the app opens on (not persisted): this week while today is
// inside the lecture period of the installed dates — that is what a student
// looks up then. The general grid otherwise: no dates, or before / after the
// period, when there is no "this week" worth showing.
export function defaultView(dates: SemesterDates | null, today: Date): "general" | "week" {
  const range = lectureRange(dates);
  if (!range) return "general";
  return isWithinInterval(startOfDay(today), range) ? "week" : "general";
}
