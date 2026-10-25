import { useRef, useState, type ReactNode } from "react";
import { addDays, addWeeks, differenceInCalendarWeeks, startOfISOWeek } from "date-fns";
import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { getLocale, m } from "@/i18n";
import { ResponsivePopover } from "@/components/ohmtools/responsive-popover";
import { Button } from "@/components/ui/button";
import { LazyCalendar } from "@/components/LazyCalendar";
import { isoWeek } from "@/lib/primitives/week";
import { useNow } from "@/hooks/useNow";
import { useSlideOnChange } from "@/hooks/useSlideOnChange";
import { slideIn } from "@/lib/ohmtools/motion";
import type { Step } from "@/lib/ohmtools/steps";

function relativeWeekLabel(weekStart: Date, now: Date): string {
  const offset = differenceInCalendarWeeks(weekStart, now, {
    weekStartsOn: 1,
  });
  if (offset === 0) return m.week_this();
  if (offset === 1) return m.week_following();
  if (offset === -1) return m.week_last();
  return offset > 0 ? m.week_in({ count: offset }) : m.week_ago({ count: -offset });
}

// "19.–25.10.": the shown week's days, short.
function weekRangeLabel(weekStart: Date): string {
  return new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "numeric" }).formatRange(
    weekStart,
    addDays(weekStart, 6),
  );
}

type WeekNavProps = {
  // Monday of the shown week.
  value: Date;
  onChange: (weekStart: Date) => void;
  // Back to this week and (phones) today's day, as on opening the app.
  onToday: () => void;
  // Week and day already are today's: nothing to jump to.
  atToday: boolean;
  step: Step;
  className?: string;
};

// ‹ label · week [today] ›. The label ("This week", "In 4 weeks") opens a
// month calendar; today sits between it and ›, disabled while week and day
// are today's already. Compact (one header row): the week number alone, the
// range from `md`. The ISO week, never the university's own week number.
export function WeekNav({ value, onChange, onToday, atToday, step, className }: WeekNavProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // "This week" moves on by itself on a page left open past Sunday.
  const now = useNow();
  const compact = step === "compact";
  const pick = (weekStart: Date) => {
    onChange(weekStart);
    setPickerOpen(false);
  };
  // Another week: the label slides in from its side, like the grid.
  const labelRef = useRef<HTMLSpanElement>(null);
  useSlideOnChange(value.getTime(), (direction) => {
    if (labelRef.current) slideIn(labelRef.current, direction, { distance: 12 });
  });
  const label = (
    <span ref={labelRef} className="flex min-w-0 items-center gap-2">
      {!compact && (
        <span className="shrink-0 text-sm font-medium">{relativeWeekLabel(value, now)}</span>
      )}
      <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
        <span className={cn(compact && "font-medium text-foreground")}>
          {m.week_number({ number: isoWeek(value) })}
        </span>
        <span className={cn(compact ? "hidden md:inline" : "max-[23rem]:hidden")}>
          {compact ? " " : " · "}
          {weekRangeLabel(value)}
        </span>
      </span>
    </span>
  );
  // The label opens the picker: a popover, a drawer on phones (the design's
  // popup group).
  const trigger = (
    <Button
      variant="ghost"
      className={cn("h-9 min-w-0 gap-2 px-2", step === "narrow" && "flex-1")}
      title={m.week_pick()}
      aria-haspopup="dialog"
    >
      {label}
    </Button>
  );

  return (
    <div className={cn("flex min-w-0 items-center", className)}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={m.week_prev()}
        onClick={() => onChange(addWeeks(value, -1))}
      >
        <ChevronLeft />
      </Button>
      {/* The popup's own component, not `Popup`: the week nav is in the
          first load, and `Popup` would bring every kind (menu, select,
          dialogs) into it, 25 KB gzip. */}
      <ResponsivePopover
        trigger={trigger}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title={m.week_pick()}
        titleHidden
        className="w-auto gap-0 p-0 pb-[env(safe-area-inset-bottom)]"
      >
        <WeekPicker value={value} now={now} onPick={pick} />
      </ResponsivePopover>
      <Button
        variant="ghost"
        size="icon"
        aria-label={m.week_today()}
        title={m.week_today()}
        disabled={atToday}
        onClick={onToday}
      >
        <CalendarCheck />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={m.week_next()}
        onClick={() => onChange(addWeeks(value, 1))}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

// A month with its week numbers, the shown week marked, today red; under a
// divider the way back to this week (user request), disabled while it is
// shown.
function WeekPicker({
  value,
  now,
  onPick,
}: {
  value: Date;
  now: Date;
  onPick: (weekStart: Date) => void;
}): ReactNode {
  const thisWeek = startOfISOWeek(now);
  return (
    <div className="flex flex-col">
      {/* The shown week is a band, today red (the one accent); no
          selection of days, a click anywhere picks its week. */}
      <LazyCalendar
        showWeekNumber
        defaultMonth={value}
        modifiers={{ shown: { from: value, to: addDays(value, 6) } }}
        modifiersClassNames={{
          shown: "rounded-none! bg-accent [&:nth-child(2)]:rounded-l-md! last:rounded-r-md!",
        }}
        onDayClick={(day) => onPick(startOfISOWeek(day))}
        className="mx-auto bg-transparent"
        classNames={{
          today: "bg-transparent [&>button]:bg-red [&>button]:text-red-foreground",
        }}
      />
      <div className="border-t p-3">
        <Button
          variant="secondary"
          className="w-full"
          disabled={value.getTime() === thisWeek.getTime()}
          onClick={() => onPick(thisWeek)}
        >
          <CalendarCheck data-icon="inline-start" />
          {m.week_this()}
        </Button>
      </div>
    </div>
  );
}
