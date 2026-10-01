import { useState } from "react";
import { addDays, addWeeks, differenceInCalendarWeeks, startOfISOWeek } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { getLocale, m } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { LazyCalendar } from "@/components/LazyCalendar";
import { cycleCode, isoWeek } from "@/lib/primitives/week";
import { useNow } from "@/hooks/useNow";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function relativeWeekLabel(weekStart: Date, now: Date): string {
  const offset = differenceInCalendarWeeks(weekStart, now, {
    weekStartsOn: 1,
  });
  if (offset === 0) return m.week_this();
  if (offset === 1) return m.week_following();
  if (offset === -1) return m.week_last();
  return offset > 0 ? m.week_in({ count: offset }) : m.week_ago({ count: -offset });
}

// Phones get the short form ("21.–27.9."), so the whole nav fits one row of
// the bottom dock.
function weekRangeLabel(weekStart: Date, short = false): string {
  return new Intl.DateTimeFormat(
    getLocale(),
    short
      ? { day: "numeric", month: "numeric" }
      : { day: "numeric", month: "short", year: "numeric" },
  ).formatRange(weekStart, addDays(weekStart, 6));
}

type WeekNavProps = {
  // Monday of the shown week.
  value: Date;
  onChange: (weekStart: Date) => void;
};

export function WeekNav({ value, onChange }: WeekNavProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // "This week" moves on by itself on a page left open past Sunday.
  const now = useNow();

  return (
    <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-4">
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <ButtonGroup className="min-w-0 flex-1 sm:flex-none">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={m.week_prev()}
            onClick={() => onChange(addWeeks(value, -1))}
          >
            <ChevronLeft />
          </Button>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                title={m.week_pick()}
                className="min-w-0 flex-1 sm:min-w-32"
              />
            }
          >
            <CalendarDays data-icon="inline-start" />
            <span className="truncate">{relativeWeekLabel(value, now)}</span>
          </PopoverTrigger>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={m.week_next()}
            onClick={() => onChange(addWeeks(value, 1))}
          >
            <ChevronRight />
          </Button>
        </ButtonGroup>
        <PopoverContent className="w-auto p-0">
          <LazyCalendar
            mode="range"
            defaultMonth={value}
            selected={{ from: value, to: addDays(value, 6) }}
            onDayClick={(day) => {
              onChange(startOfISOWeek(day));
              setPickerOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>

      {/* Range above week number, so the pair takes little width. The ISO
          week (G/U) and the four-week code (G1/G2/U1/U2), never the
          university's own week number. */}
      <div className="flex shrink-0 flex-col items-end">
        <Badge variant="secondary">
          <span className="sm:hidden">{weekRangeLabel(value, true)}</span>
          <span className="hidden sm:inline">{weekRangeLabel(value)}</span>
        </Badge>
        <Badge variant="secondary">
          {m.week_label({ number: isoWeek(value), cycle: cycleCode(value) })}
        </Badge>
      </div>
    </div>
  );
}
