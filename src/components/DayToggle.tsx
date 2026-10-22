import { cn } from "cn";
import { m } from "@/i18n";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Day } from "@/lib/primitives/subject";
import { DAYS } from "@/lib/primitives/week";
import { dateOf, dayName, shortDate } from "@/lib/subjects";

function isDay(value: string | undefined): value is Day {
  return DAYS.some((day) => day === value);
}

// Below `md` the grid shows one day at a time; this picks it. App owns the
// day because the toggle sits in the phone's bottom dock, apart from the grid.
// In the week view each weekday carries its day of the month ("Mo 21."), the
// month is in the week nav right above.
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
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={0}
      className={cn("w-full", className)}
      value={[value]}
      onValueChange={([day]) => {
        if (isDay(day)) onChange(day);
      }}
      aria-label={m.grid_day_pick()}
    >
      {DAYS.map((day) => (
        <ToggleGroupItem
          key={day}
          value={day}
          // "Other" keeps its natural width; the weekdays share the rest. `!` beats
          // toggle-group's own `group-data-[spacing=0]:px-6`.
          className={day === Day.other ? "shrink-0 px-3!" : "min-w-0 flex-1 px-0!"}
        >
          {day === Day.other ? (
            m.grid_other_short()
          ) : (
            <>
              {dayName(day)}
              {weekStart && (
                <span className="tabular-nums">{shortDate(dateOf(weekStart, day), false)}</span>
              )}
            </>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
