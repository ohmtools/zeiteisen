import { cn } from "cn";
import { m } from "@/i18n";
import { Day } from "@/lib/primitives/subject";
import { DAYS } from "@/lib/primitives/week";
import { dateOf, dayName, shortDate } from "@/lib/subjects";

// Phones show one day at a time; this bar at the bottom picks it. App owns
// the day because the bar sits apart from the grid. In the week view each
// weekday carries its day of the month under its name; the picked day is red,
// the one accent.
export function DayToggle({
  value,
  onChange,
  weekStart,
  className,
}: {
  value: Day;
  onChange: (day: Day) => void;
  // Monday of the shown week; null in the general view.
  weekStart: Date | null;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={m.grid_day_pick()} className={cn("flex gap-1", className)}>
      {DAYS.map((day) => {
        const selected = day === value;
        return (
          <button
            key={day}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center rounded-md text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
              weekStart ? "h-14" : "h-10",
              selected ? "bg-red font-semibold text-red-foreground" : "text-muted-foreground",
            )}
            onClick={() => onChange(day)}
          >
            {day === Day.other ? (
              m.grid_other_short()
            ) : (
              <>
                <span>{dayName(day)}</span>
                {weekStart && (
                  <span className={cn("font-mono text-base", !selected && "text-foreground")}>
                    {shortDate(dateOf(weekStart, day), false)}
                  </span>
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
