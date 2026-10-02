import type { SubjectInformation } from "@/lib/primitives/meta";
import { useRef, useState } from "react";
import { cn } from "cn";
import { localized, m } from "@/i18n";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { BLOCK_MIN_HEIGHT, SubjectBlock, SubjectPopup } from "@/components/SubjectBlock";
import { Badge } from "@/components/ui/badge";
import { NowLine } from "@/components/NowLine";
import type { GlobalEvent } from "@/lib/primitives/meta";
import { Day, minutesOf } from "@/lib/primitives/subject";
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

// `shown` is the column's display from `md` up: a flex cell has to say so, or
// `md:block` would override its `flex`.
function dayColumn(day: Day, selected: Day, shown: "md:block" | "md:flex" = "md:block"): string {
  return day === selected ? "" : `hidden ${shown}`;
}

// The all-day row's height: four lines of `EventBadge` (`text-[0.625rem]` at
// the row's inherited `text-sm` line-height ratio), so two events of two lines
// each fit, plus their `gap-1`, the cell's `p-1.5`, the row's border and 1px
// for rounding.
const ALLDAY_HEIGHT = "calc(4 * 0.625rem * 1.25 / 0.875 + 0.25rem + 0.75rem + 2px)";

type Props = {
  entries: Entry[];
  week: WeekView | null;
  // Tells "nothing uploaded" apart from "nothing this week".
  hasFiles: boolean;
  // The group cell hovered in the tree: every other block is dimmed.
  highlight?: Highlight | null;
  // A block's popup asks to show its group cell in the tree.
  onJump?: (subject: SubjectRef) => void;
  // A block's popup asks for the subject's catalog info.
  onInfo?: (info: SubjectInformation) => void;
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
  onInfo,
  selectedDay,
  onSelectDay,
}: Props) {
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  // The subject under the mouse: its other blocks get a faint ring.
  const [hovered, setHovered] = useState<string | null>(null);
  // The one details popup, by the block's `entry.key`: it shows the entry
  // under that key as the grid has it now, so an edit shows at once and a
  // block that left the grid (another tab, another week) takes it along.
  // `open` turns false first, so the details stay for the closing animation.
  const [popup, setPopup] = useState<{
    key: string;
    open: boolean;
    point: { x: number; y: number };
    block: HTMLElement;
    keyboard: boolean;
  } | null>(null);
  const popupEntry = popup && (entries.find((entry) => entry.key === popup.key) ?? null);
  const closePopup = () => setPopup((shown) => shown && { ...shown, open: false });
  // A press on the open block closes the popup, as a trigger's would; on any
  // other block it moves there.
  const pressBlock =
    (entry: Entry) => (point: { x: number; y: number }, block: HTMLElement, keyboard: boolean) =>
      setPopup((shown) =>
        shown?.open && shown.key === entry.key
          ? { ...shown, open: false }
          : { key: entry.key, open: true, point, block, keyboard },
      );

  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i);
  const { grid, list } = byDay(entries);
  // The hour floor: the shortest block in the grid (any day, so the rows do not
  // change with the phone's day) still holds its three lines, never under 24px.
  const shortest = Math.min(
    ...WEEKDAYS.flatMap((day) =>
      grid[day].map(({ entry }) =>
        Math.max(minutesOf(entry.meeting.endTime) - minutesOf(entry.meeting.startTime), 15),
      ),
    ),
  );
  const hourFloor = Number.isFinite(shortest)
    ? `max(1.5rem, calc(${BLOCK_MIN_HEIGHT} * ${60 / shortest}))`
    : "1.5rem";
  // A class toggle per block, nothing moves.
  const dimmed = (entry: Entry) => highlight !== null && !isHighlighted(entry, highlight);
  const related = (entry: Entry) => hovered !== null && entry.subject.name === hovered;
  const otherEvents = week?.events[Day.other] ?? [];
  const showOther = selectedDay === Day.other;
  const unclear = (entry: Entry) => week !== null && isUnclearRepeat(entry.subject.repeat);

  // touch-pan-y: the browser keeps vertical scrolling, we get horizontal
  // moves. The swipe covers grid and list, so it moves between them too.
  return (
    <div
      // No placeholder for the all-day row in the general view (user
      // decision): the grid starts right below the toolbar, the hours move
      // down when the week view adds that row.
      className="flex flex-1 touch-pan-y flex-col gap-4 text-sm md:flex-row"
      onPointerDown={(event) => {
        if (event.pointerType === "mouse") return;
        swipeStart.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        const start = swipeStart.current;
        swipeStart.current = null;
        if (!start) return;
        const next = swipeTarget(selectedDay, event.clientX - start.x, event.clientY - start.y);
        // A press on a block is no outside press (`SubjectPopup`), so a swipe
        // that starts on one closes the popup here.
        if (next !== selectedDay) closePopup();
        onSelectDay(next);
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
          <div className={`${COLUMNS} shrink-0 border-b`} style={{ height: ALLDAY_HEIGHT }}>
            <div className="flex items-center justify-center p-2 text-center text-muted-foreground">
              {m.grid_allday()}
            </div>
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className={cn(
                  "flex min-w-0 flex-col gap-1 overflow-y-auto border-l p-1.5",
                  dayColumn(day, selectedDay, "md:flex"),
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
        {/* The hours share the height left over (one viewport, no page
              scroll), down to a floor that keeps the shortest block's three
              lines whole (36px for 90 minutes; 24px at least, the hour label
              still fits); below the floor the grid scrolls (a landscape
              phone). */}
        <div className="relative flex flex-1 flex-col">
          {/* Grid lines and hour labels only: the blocks say their own time. */}
          {hours.map((hour, index) => (
            <div
              key={hour}
              aria-hidden
              className={cn(COLUMNS, "flex-1", index < hours.length - 1 && "border-b")}
              style={{ minHeight: hourFloor }}
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
                    related={related(entry)}
                    onHover={setHovered}
                    expanded={popup?.open === true && popup.key === entry.key}
                    onPress={pressBlock(entry)}
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
            As tall as the grid (phones: the space it leaves), scrolls inside itself.
            A third narrower below `xl` (tablets, small laptops), where the
            weekdays need the room. */}
      <div
        className={cn(
          "flex flex-1 flex-col border md:w-32 md:flex-none xl:w-48",
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
                related={related(entry)}
                onHover={setHovered}
                expanded={popup?.open === true && popup.key === entry.key}
                onPress={pressBlock(entry)}
              />
            ))}
            {otherEvents.length === 0 && list.length === 0 && (
              <span className="p-2 text-center text-muted-foreground">{m.grid_other_empty()}</span>
            )}
          </div>
        </div>
      </div>

      <SubjectPopup
        open={popup?.open === true}
        entry={popupEntry}
        point={popup?.point ?? { x: 0, y: 0 }}
        block={popup?.block ?? null}
        keyboard={popup?.keyboard ?? false}
        unclear={popupEntry !== null && unclear(popupEntry)}
        onClose={closePopup}
        onJump={() =>
          popupEntry &&
          onJump?.({ timetableName: popupEntry.timetableName, index: popupEntry.index })
        }
        onInfo={onInfo}
      />
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
