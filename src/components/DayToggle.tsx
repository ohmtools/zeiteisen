import { cn } from "cn";
import { m } from "@/i18n";
import { Day } from "@/lib/primitives/subject";
import { DAYS } from "@/lib/primitives/week";
import { dateOf, dayName, shortDate } from "@/lib/subjects";

// Phones show one day at a time; this bar at the bottom picks it. App owns
// the day because the bar sits apart from the grid. In the week view each
// weekday carries its day of the month under its name; the picked day is red,
// the one accent, gliding over.
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
  const index = DAYS.indexOf(value);
  return (
    <div
      role="tablist"
      aria-label={m.grid_day_pick()}
      className={cn("relative flex gap-1", className)}
    >
      {/* The red of the picked day is one pill that glides from day to day,
          under the buttons: n equal buttons 4px apart, so day i starts i of
          its own widths plus gaps in. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 rounded-md bg-red transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
        style={{
          width: `calc((100% - ${DAYS.length - 1} * 0.25rem) / ${DAYS.length})`,
          transform: `translateX(calc(${index} * (100% + 0.25rem)))`,
        }}
      />
      {DAYS.map((day) => {
        const selected = day === value;
        return (
          <button
            key={day}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-md text-sm transition-[color,scale] duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95",
              weekStart ? "h-14" : "h-10",
              selected ? "font-semibold text-red-foreground" : "text-muted-foreground",
            )}
            onClick={() => onChange(day)}
          >
            {day === Day.other ? (
              m.grid_other_short()
            ) : (
              <>
                <span>{dayName(day)}</span>
                {weekStart && (
                  // Its own colour both ways: inheriting the button's, which
                  // eases from grey, dipped the picked date to grey and back.
                  <span
                    className={cn(
                      "font-mono text-base transition-colors duration-300",
                      selected ? "text-red-foreground" : "text-foreground",
                    )}
                  >
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
