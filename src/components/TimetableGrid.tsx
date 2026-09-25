import { useRef } from "react";
import { cn } from "cn";
import { localized, m } from "@/i18n";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { SubjectBlock } from "@/components/SubjectBlock";
import { Badge } from "@/components/ui/badge";
import { NowLine } from "@/components/NowLine";
import type { GlobalEvent } from "@/lib/primitives/meta";
import { Day } from "@/lib/primitives/subject";
import { DAYS, isUnclearRepeat, type WeekEvents } from "@/lib/primitives/week";
import { byDay, FIRST_HOUR, LAST_HOUR, WEEKDAYS, type Entry } from "@/lib/layout";
import { isHighlighted, type Highlight, type SubjectRef } from "@/lib/link";
import { dayName as dayLabel } from "@/lib/subjects";

// Current-week extras; null in the general view.
export type WeekView = WeekEvents & {
  // Column that gets the now-line: set when the shown week contains today
  // (weekdays only, `other` has no single date).
  today: Day | null;
};

// Below `md` the grid shows the time column plus one weekday, picked in the
// bottom dock (`DayToggle`); from `md` up it shows Mon-Fri. Hidden columns are CSS-only. `other` is
// no column: it is the list next to the grid (below `md`: instead of it).
const COLUMNS = "grid grid-cols-[5rem_minmax(0,1fr)] md:grid-cols-[6rem_repeat(5,minmax(0,1fr))]";

// A horizontal touch swipe on the grid moves to the previous/next day.
const SWIPE_MIN_PX = 50;

function swipeTarget(from: Day, dx: number, dy: number): Day {
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return from;
  const index = DAYS.indexOf(from) + (dx < 0 ? 1 : -1);
  return DAYS[Math.max(0, Math.min(DAYS.length - 1, index))];
}

function dayColumn(day: Day, selected: Day): string {
  return day === selected ? "" : "hidden md:block";
}

type Props = {
  entries: Entry[];
  week: WeekView | null;
  // Tells "nothing uploaded" apart from "nothing this week".
  hasFiles: boolean;
  // The group cell hovered in the tree: every other block is dimmed.
  highlight?: Highlight | null;
  // A block's popup asks to show its group cell in the tree.
  onJump?: (subject: SubjectRef) => void;
  // The one day shown below `md`; a swipe moves it.
  selectedDay: Day;
  onSelectDay: (day: Day) => void;
};

export function TimetableGrid({
  entries,
  week,
  hasFiles,
  highlight = null,
  onJump,
  selectedDay,
  onSelectDay,
}: Props) {
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i);
  const { grid, list } = byDay(entries);
  // A class toggle per block, nothing moves.
  const dimmed = (entry: Entry) => highlight !== null && !isHighlighted(entry, highlight);
  const otherEvents = week?.events[Day.other] ?? [];
  const showOther = selectedDay === Day.other;
  const unclear = (entry: Entry) => week !== null && isUnclearRepeat(entry.subject.repeat);

  // touch-pan-y: the browser keeps vertical scrolling, we get horizontal
  // moves. The swipe covers grid and list, so it moves between them too.
  return (
    <div
      className={cn(
        "flex flex-1 touch-pan-y flex-col gap-4 text-sm md:flex-row desktop:flex-none",
        // The all-day row's height (divider included) as space on top, so the
        // hours do not move when switching between general and week view.
        !week && "mt-12 md:mt-16",
      )}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse") return;
        swipeStart.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        const start = swipeStart.current;
        swipeStart.current = null;
        if (!start) return;
        onSelectDay(swipeTarget(selectedDay, event.clientX - start.x, event.clientY - start.y));
      }}
      onPointerCancel={() => {
        swipeStart.current = null;
      }}
    >
      <div className={cn("flex min-w-0 flex-1 flex-col border", showOther && "hidden md:flex")}>
        {/* On phones the day toggle in the dock already names the shown day. */}
        <div className={`${COLUMNS} hidden border-b md:grid`}>
          <div className="flex items-center justify-center p-2 text-center text-muted-foreground">
            {m.grid_time()}
          </div>
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className={cn("border-l p-2 text-center font-medium", dayColumn(day, selectedDay))}
            >
              {dayLabel(day)}
            </div>
          ))}
        </div>

        {/* Fixed height, whatever the events: a growing row would move the
              hours. More events than fit scroll inside their cell. */}
        {week && (
          <div className={`${COLUMNS} h-12 shrink-0 border-b md:h-16`}>
            <div className="flex items-center justify-center p-2 text-center text-muted-foreground">
              {m.grid_allday()}
            </div>
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className={cn(
                  "flex min-w-0 flex-col gap-1 overflow-y-auto border-l p-1.5",
                  dayColumn(day, selectedDay),
                )}
              >
                {week.events[day].map((event) => (
                  <EventBadge key={localized(event.title) + event.startDate} event={event} />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Hour rows draw the grid lines; the subjects sit in an overlay of
              the same columns so they can span and share a slot freely. */}
        {/* Below `desktop` the hours share the height left over (one
              viewport, no page scroll), down to a floor; desktop scrolls. */}
        <div className="relative flex flex-1 flex-col desktop:flex-none">
          {hours.map((hour, index) => (
            <div
              key={hour}
              className={cn(
                COLUMNS,
                "min-h-9 flex-1 desktop:h-14 desktop:flex-none",
                index < hours.length - 1 && "border-b",
              )}
            >
              <div className="flex items-center justify-center px-2 text-muted-foreground tabular-nums">
                {String(hour).padStart(2, "0")}:00
              </div>
              {WEEKDAYS.map((day) => (
                <div key={day} className={cn("border-l", dayColumn(day, selectedDay))} />
              ))}
            </div>
          ))}

          <div className={cn(COLUMNS, "pointer-events-none absolute inset-0")}>
            <div />
            {WEEKDAYS.map((day) => (
              <div key={day} className={cn("relative", dayColumn(day, selectedDay))}>
                {week?.noLectures.has(day) && <div className="absolute inset-0 bg-muted" />}
                {/* `entry.key` carries the subject's index and meeting, so
                      the same class listed twice in a day (BEI3 has
                      ELK1:SU:2.1 twice) stays two distinct keys. */}
                {grid[day].map(({ entry, lane, lanes }) => (
                  <SubjectBlock
                    key={entry.key}
                    entry={entry}
                    lane={{ lane, lanes }}
                    unclear={unclear(entry)}
                    dimmed={dimmed(entry)}
                    onJump={() =>
                      onJump?.({ timetableName: entry.timetableName, index: entry.index })
                    }
                  />
                ))}
                {week?.today === day && <NowLine firstHour={FIRST_HOUR} lastHour={LAST_HOUR} />}
              </div>
            ))}
          </div>

          {entries.length === 0 && (
            <Empty className="pointer-events-none absolute inset-y-0 right-0 left-20 w-auto md:left-24">
              <EmptyHeader>
                <EmptyDescription>
                  {hasFiles ? m.grid_empty_week() : m.grid_empty()}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </div>
      </div>

      {/* `other`: what the hour grid cannot hold (weekends, `other` classes,
            dates and SH1/SH2 in the general view, anything outside the grid
            hours) as a plain list in time order, not aligned to the hours.
            As tall as the grid (phones: the space it leaves), scrolls inside itself. */}
      <div
        className={cn(
          "flex flex-1 flex-col border md:w-48 md:flex-none",
          !showOther && "hidden md:flex",
        )}
      >
        <div className="hidden border-b p-2 text-center font-medium md:block">
          {dayLabel(Day.other)}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-0 flex flex-col gap-1 overflow-y-auto p-2">
            {otherEvents.map((event) => (
              <EventBadge key={localized(event.title) + event.startDate} event={event} />
            ))}
            {list.map((entry) => (
              <SubjectBlock
                key={entry.key}
                entry={entry}
                lane={null}
                unclear={unclear(entry)}
                dimmed={dimmed(entry)}
                onJump={() => onJump?.({ timetableName: entry.timetableName, index: entry.index })}
              />
            ))}
            {otherEvents.length === 0 && list.length === 0 && (
              <span className="p-2 text-center text-muted-foreground">{m.grid_other_empty()}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventBadge({ event }: { event: GlobalEvent }) {
  return (
    <Badge
      variant={event.noLectures ? "secondary" : "default"}
      // Long titles wrap instead of being cut off.
      className="max-w-full items-start text-left whitespace-normal"
      title={[event.title, event.description]
        .filter((text) => text !== undefined)
        .map(localized)
        .join("\n")}
    >
      {localized(event.title)}
    </Badge>
  );
}
