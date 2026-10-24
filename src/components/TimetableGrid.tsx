import { lazy, Suspense, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "cn";
import { getLocale, localized, m } from "@/i18n";
import {
  BLOCK_MIN_HEIGHT,
  CollectedBlock,
  CollectedList,
  SubjectBlock,
  SubjectDetails,
  SubjectPopup,
  type DetailActions,
  type Popup,
  type Press,
} from "@/components/SubjectBlock";
import { NowLine } from "@/components/NowLine";
import { useSlideOnChange } from "@/hooks/useSlideOnChange";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { GlobalEvent } from "@/lib/primitives/meta";
import { Day, minutesOf } from "@/lib/primitives/subject";
import { DAYS, isUnclearRepeat, type WeekEvents } from "@/lib/primitives/week";
import { allDaySegments, type AllDaySegment } from "@/lib/allday";
import { byDay, FIRST_HOUR, fitDay, LAST_HOUR, WEEKDAYS, type Entry } from "@/lib/layout";
import { isHighlighted, type Highlight } from "@/lib/link";
import type { Step } from "@/lib/media";
import { slideIn } from "@/lib/motion";
import { dateOf, dayName as dayLabel, shortDate } from "@/lib/subjects";

// On phones the details are a drawer from the bottom, on a phone turned
// sideways a sheet from the right (deferred chunk, with the dialogs).
const DetailsSheet = lazy(() =>
  import("@/components/deferred").then((d) => ({ default: d.DetailsSheet })),
);

// Current-week extras; null in the general view.
export type WeekView = WeekEvents & {
  // Column that gets the now-line: set when the shown week contains today
  // (weekdays only, `other` has no single date).
  today: Day | null;
  // Monday of the shown week: every weekday shows its date.
  start: Date;
};

// A horizontal touch swipe on the grid moves to the previous/next day on
// phones; where every day is shown, to the previous/next week (Current week
// only: a tablet swiped and nothing seemed to happen).
const SWIPE_MIN_PX = 50;

// -1 back, 1 forward, 0 no swipe.
function swipeDirection(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}

function swipeTarget(from: Day, direction: -1 | 1): Day {
  const index = DAYS.indexOf(from) + direction;
  return DAYS[Math.max(0, Math.min(DAYS.length - 1, index))];
}

// Where the grid stands, as one number that grows forward: the week (or the
// general view, after every week: it is the second tab), plus the phone's day.
// A change slides the days in from that side.
function pageOf(week: WeekView | null, narrow: boolean, day: Day): number {
  const base = week ? week.start.getTime() : Number.MAX_SAFE_INTEGER / 2;
  return narrow ? base + DAYS.indexOf(day) : base;
}

const HOURS = LAST_HOUR - FIRST_HOUR;
// The lines between the hours, drawn by each day column itself.
const HOUR_LINES = {
  backgroundImage: `repeating-linear-gradient(to bottom, var(--grid) 0 1px, transparent 1px calc(100% / ${HOURS}))`,
};

type Props = {
  entries: Entry[];
  week: WeekView | null;
  step: Step;
  // A short landscape screen (a phone turned sideways): every second hour
  // label, blocks name and kinds only, the details as a sheet.
  short: boolean;
  // Shown over the empty grid: no timetables yet, or a week without classes.
  overlay?: ReactNode;
  // The group cell hovered in the tree, or the category open there: every
  // other block is dimmed.
  highlight?: Highlight | null;
  actions: DetailActions;
  // The one day shown on phones; a swipe moves it.
  selectedDay: Day;
  onSelectDay: (day: Day) => void;
  // A swipe where the whole week shows, in the week view: one week back (-1)
  // or on (1).
  onSwipeWeek?: (direction: -1 | 1) => void;
};

export function TimetableGrid({
  entries,
  week,
  step,
  short,
  overlay,
  highlight = null,
  actions,
  selectedDay,
  onSelectDay,
  onSwipeWeek,
}: Props) {
  const general = week === null;
  const narrow = step === "narrow";
  const brief = short;
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  // Another week or day: its day heads, columns and all-day row slide in from
  // that side, one column after the other (`data-slide` = the column).
  const rootRef = useRef<HTMLDivElement>(null);
  useSlideOnChange(pageOf(week, narrow, selectedDay), (direction) => {
    for (const element of rootRef.current?.querySelectorAll<HTMLElement>("[data-slide]") ?? []) {
      slideIn(element, direction, { delay: Number(element.dataset.slide) * 24 });
    }
  });
  // The subject under the mouse: its other blocks get a faint ring.
  const [hovered, setHovered] = useState<string | null>(null);
  // The hour grid's size: how wide a day column is (lanes narrower than
  // `MIN_LANE_PX` are gathered) and how tall an hour (a collected block's
  // lines). The grid itself, not its scroll box: under the hour floor it is
  // taller than the box and scrolls.
  const bodyRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(body);
    return () => observer.disconnect();
  }, []);

  // The one popup, by the block's key: it shows the entry under that key as
  // the grid has it now, so an edit shows at once and a block that left the
  // grid (another tab, another week) takes it along. `open` turns false
  // first, so the details stay for the closing animation.
  const [popup, setPopup] = useState<{
    keys: string[];
    open: boolean;
    point: { x: number; y: number };
    block: HTMLElement;
    keyboard: boolean;
  } | null>(null);
  const popupEntries = popup
    ? popup.keys
        .map((key) => entries.find((entry) => entry.key === key))
        .filter((entry) => entry !== undefined)
    : [];
  const content: Popup =
    popupEntries.length === 0
      ? null
      : popup!.keys.length === 1
        ? { kind: "details", entry: popupEntries[0] }
        : { kind: "list", entries: popupEntries };
  const closePopup = () => setPopup((shown) => shown && { ...shown, open: false });
  const openKey = popup?.open ? popup.keys.join("+") : null;
  // A press on the open block closes the popup, as a trigger's would; on any
  // other block it moves there.
  const press =
    (keys: string[]): Press =>
    (point, block, keyboard) =>
      setPopup((shown) =>
        shown?.open && shown.keys.join("+") === keys.join("+")
          ? { ...shown, open: false }
          : { keys, open: true, point, block, keyboard },
      );

  const { grid, list } = byDay(entries);
  const columns = narrow ? (selectedDay === Day.other ? [] : [selectedDay]) : WEEKDAYS;
  const showOther = !narrow || selectedDay === Day.other;
  const hourColumn = narrow ? "3rem" : "3.5rem";
  const template = narrow
    ? selectedDay === Day.other
      ? "minmax(0, 1fr)"
      : `${hourColumn} minmax(0, 1fr)`
    : `${hourColumn} repeat(6, minmax(0, 1fr))`;
  const columnWidth = narrow
    ? size.width - (selectedDay === Day.other ? 0 : 48)
    : (size.width - 56) / 6;
  const hourPx = size.height / HOURS;
  // The hour floor: the shortest block in the grid (any day, so the rows do
  // not change with the phone's day) keeps its lines whole, never under 24px.
  const shortest = Math.min(
    ...WEEKDAYS.flatMap((day) =>
      grid[day].map(({ entry }) =>
        Math.max(minutesOf(entry.meeting.endTime) - minutesOf(entry.meeting.startTime), 15),
      ),
    ),
  );
  const floor = brief ? "(2 * 1rem + 0.5rem + 4px)" : BLOCK_MIN_HEIGHT;
  const hourFloor = Number.isFinite(shortest)
    ? `max(1.5rem, calc(${floor} * ${60 / shortest}))`
    : "1.5rem";
  // A class toggle per block, nothing moves.
  const dimmed = (entry: Entry) => highlight !== null && !isHighlighted(entry, highlight);
  const related = (entry: Entry) => hovered !== null && entry.subject.name === hovered;
  // Phones and short screens: an all-day chip opens its list in the details'
  // drawer or sheet, not a popover. `open` turns false first, as above.
  const sheet = narrow || short;
  const [allDay, setAllDay] = useState<{ segment: AllDaySegment; open: boolean } | null>(null);
  const closeAllDay = () => setAllDay((shown) => shown && { ...shown, open: false });

  const unclear = (entry: Entry) => week !== null && isUnclearRepeat(entry.subject.repeat);
  const labels = Array.from({ length: HOURS + 1 }, (_, i) => FIRST_HOUR + i).filter(
    (hour) => !short || hour % 2 === 0,
  );

  const details =
    content === null ? null : content.kind === "list" ? (
      <CollectedList
        entries={content.entries}
        onPick={(entry) =>
          setPopup((shown) => shown && { ...shown, keys: [entry.key], open: true })
        }
      />
    ) : (
      <SubjectDetails
        entry={content.entry}
        general={general}
        unclear={unclear(content.entry)}
        actions={actions}
        onClose={closePopup}
      />
    );

  // touch-pan-y: the browser keeps vertical scrolling, we get horizontal
  // moves.
  return (
    <div
      ref={rootRef}
      className="flex min-h-0 flex-1 touch-pan-y flex-col overflow-hidden rounded-r-[10px] border border-l-0"
      onPointerDown={(event) => {
        if (event.pointerType === "mouse") return;
        swipeStart.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        const start = swipeStart.current;
        swipeStart.current = null;
        if (!start) return;
        const direction = swipeDirection(event.clientX - start.x, event.clientY - start.y);
        if (direction === 0) return;
        // A press on a block is no outside press (`SubjectPopup`), so a swipe
        // that starts on one closes the popup here.
        if (!narrow) {
          if (!onSwipeWeek) return;
          closePopup();
          closeAllDay();
          onSwipeWeek(direction);
          return;
        }
        const next = swipeTarget(selectedDay, direction);
        if (next !== selectedDay) {
          closePopup();
          closeAllDay();
        }
        onSelectDay(next);
      }}
      onPointerCancel={() => {
        swipeStart.current = null;
      }}
    >
      {/* Day names (from compact on; phones name the day in the bar below),
          then the all-day row, one line, reserved in the general view too,
          so the hours never move between the views (user decision). */}
      <div
        className="grid shrink-0 overflow-hidden [scrollbar-gutter:stable]"
        style={{ gridTemplateColumns: template }}
      >
        {!narrow && (
          <>
            <div className="h-10 border-b" />
            {WEEKDAYS.map((day, i) => (
              <DayHead key={day} day={day} week={week} slide={i} />
            ))}
            <div className="flex h-10 items-center justify-center border-b border-l bg-surface px-1 text-sm font-medium text-muted-foreground @container">
              <span className="hidden truncate @[7rem]:inline">{m.grid_other()}</span>
              <span className="truncate @[7rem]:hidden">{m.grid_other_short()}</span>
            </div>
          </>
        )}
        <AllDayRow
          week={week}
          narrow={narrow}
          columns={narrow ? [selectedDay] : DAYS}
          onOpen={sheet ? (segment) => setAllDay({ segment, open: true }) : undefined}
        />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto pt-3 pb-2 [scrollbar-gutter:stable]">
        <div
          ref={bodyRef}
          className="relative grid flex-1"
          style={{ gridTemplateColumns: template, minHeight: `calc(${HOURS} * ${hourFloor})` }}
        >
          {columns.length > 0 && (
            <div aria-hidden className="relative">
              {labels.map((hour) => (
                <span
                  key={hour}
                  className={cn(
                    "absolute right-2 font-mono text-xs leading-4 text-hour",
                    hour === LAST_HOUR ? "-translate-y-full" : "-translate-y-1/2",
                  )}
                  style={{ top: `${((hour - FIRST_HOUR) / HOURS) * 100}%` }}
                >
                  {String(hour).padStart(2, "0")}:00
                </span>
              ))}
            </div>
          )}

          {columns.map((day, i) => (
            <div key={day} className="relative border-l border-t-0" style={HOUR_LINES}>
              {/* What slides on another week or day; the lines stay. */}
              <div data-slide={i} className="absolute inset-0">
                {/* A lecture-free day: greyed over with its reason, lectures
                    gone (listed dates still meet). */}
                {week?.noLectures.has(day) && (
                  <div className="absolute inset-0 z-[1] flex justify-center bg-surface pt-6 text-xs text-muted-foreground">
                    {m.grid_no_lectures()}
                  </div>
                )}
                {fitDay(grid[day], columnWidth).map((shown) =>
                  shown.kind === "block" ? (
                    <SubjectBlock
                      key={shown.entry.key}
                      entry={shown.entry}
                      place={{
                        lane: shown.lane,
                        lanes: shown.lanes,
                        start: minutesOf(shown.entry.meeting.startTime),
                        end: minutesOf(shown.entry.meeting.endTime),
                      }}
                      general={general}
                      brief={brief}
                      unclear={unclear(shown.entry)}
                      dimmed={dimmed(shown.entry)}
                      related={related(shown.entry)}
                      onHover={setHovered}
                      expanded={openKey === shown.entry.key}
                      onPress={press([shown.entry.key])}
                    />
                  ) : (
                    <CollectedBlock
                      key={shown.key}
                      entries={shown.entries}
                      place={shown}
                      rows={Math.floor((((shown.end - shown.start) / 60) * hourPx) / 16) - 1}
                      dimmed={shown.entries.every(dimmed)}
                      expanded={openKey === shown.key}
                      onPress={press(shown.entries.map((entry) => entry.key))}
                    />
                  ),
                )}
                {week?.today === day && <NowLine firstHour={FIRST_HOUR} lastHour={LAST_HOUR} />}
              </div>
            </div>
          ))}

          {/* `other`: what the hour grid cannot hold (weekends, `other`
              classes, dates and SH1/SH2 in the general view, anything
              outside the grid hours), in time order, not aligned to the
              hours. */}
          {showOther && (
            <div
              className={cn(
                "-mt-3 -mb-2 flex flex-col gap-0.5 bg-surface p-0.5",
                !narrow && "border-l",
              )}
            >
              <div data-slide={columns.length} className="flex flex-col gap-0.5">
                {list.map((entry) => (
                  <SubjectBlock
                    key={entry.key}
                    entry={entry}
                    place={null}
                    general={general}
                    brief={short}
                    unclear={unclear(entry)}
                    dimmed={dimmed(entry)}
                    related={related(entry)}
                    onHover={setHovered}
                    expanded={openKey === entry.key}
                    onPress={press([entry.key])}
                  />
                ))}
                {narrow && list.length === 0 && (
                  <span className="p-4 text-center text-sm text-muted-foreground">
                    {m.grid_other_empty()}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {overlay && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-6">
            <div className="pointer-events-auto">{overlay}</div>
          </div>
        )}
      </div>

      {sheet ? (
        <Suspense fallback={null}>
          <DetailsSheet
            open={popup?.open === true && content !== null}
            side={short ? "right" : "bottom"}
            onClose={closePopup}
          >
            {details}
          </DetailsSheet>
          <DetailsSheet
            open={allDay?.open === true}
            side={short ? "right" : "bottom"}
            title={allDay ? allDayTitle(allDay.segment) : undefined}
            onClose={closeAllDay}
          >
            {allDay && <AllDayList segment={allDay.segment} />}
          </DetailsSheet>
        </Suspense>
      ) : (
        <SubjectPopup
          open={popup?.open === true}
          content={content}
          point={popup?.point ?? { x: 0, y: 0 }}
          block={popup?.block ?? null}
          keyboard={popup?.keyboard ?? false}
          onClose={closePopup}
        >
          {details}
        </SubjectPopup>
      )}
    </div>
  );
}

// "Mo 19": today's name bright and its date on red.
function DayHead({ day, week, slide }: { day: Day; week: WeekView | null; slide: number }) {
  const today = week?.today === day;
  return (
    <div
      className={cn(
        "flex h-10 items-center justify-center border-b border-l text-sm font-medium whitespace-nowrap",
        today ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <span data-slide={slide} className="flex items-center gap-2">
        {dayLabel(day)}
        {week && (
          <span className={cn("font-mono", today && "rounded-sm bg-red px-1 text-red-foreground")}>
            {shortDate(dateOf(week.start, day), false)}
          </span>
        )}
      </span>
    </div>
  );
}

// "16.–27.11.": an event's days, short.
function eventRange(event: GlobalEvent): string {
  const format = new Intl.DateTimeFormat(getLocale(), { day: "numeric", month: "numeric" });
  const start = new Date(`${event.startDate}T00:00:00`);
  if (!event.endDate || event.endDate === event.startDate) return format.format(start);
  return format.formatRange(start, new Date(`${event.endDate}T00:00:00`));
}

function eventNote(event: GlobalEvent): string {
  return [event.description ? localized(event.description) : null, eventRange(event)]
    .filter((part) => part !== null)
    .join(" · ");
}

// The all-day row: one line, a chip per run of days with the same events,
// "+n" where there are more (user decision). Empty, it says so; in the general
// view it explains itself.
function AllDayRow({
  week,
  narrow,
  columns,
  onOpen,
}: {
  week: WeekView | null;
  narrow: boolean;
  columns: readonly Day[];
  // Set: a chip opens its list here (drawer or sheet) instead of a popover.
  onOpen?: (segment: AllDaySegment) => void;
}) {
  const segments = week ? allDaySegments(week.events, columns) : [];
  const height = narrow ? "h-8" : "h-9";
  const label = (
    <div
      className={cn(
        "flex items-center justify-end border-b pr-2 text-xs whitespace-nowrap text-hour",
        height,
      )}
    >
      {m.grid_allday_short()}
    </div>
  );
  const empty = week ? m.grid_allday_none() : m.grid_allday_general();
  if (narrow) {
    return (
      <div className={cn("col-span-full flex items-center border-b px-0.5", height)}>
        {segments.length === 0 ? (
          <span data-slide={0} className="px-2 text-xs text-muted-foreground">
            {empty}
          </span>
        ) : (
          segments.map((segment) => (
            <AllDayChip
              key={segment.from}
              segment={segment}
              prefix={m.grid_allday_short()}
              slide={0}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    );
  }
  return (
    <>
      {label}
      <div
        className={cn("relative col-span-6 grid border-b", height)}
        style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}
      >
        {DAYS.map((day, i) => (
          <div
            key={day}
            className={cn("border-l", day === Day.other && "bg-surface")}
            style={{ gridColumn: i + 1, gridRow: 1 }}
          />
        ))}
        {segments.length === 0 ? (
          <span
            data-slide={0}
            className="flex items-center px-2 text-xs text-muted-foreground"
            style={{ gridColumn: "1 / -1", gridRow: 1 }}
          >
            {empty}
          </span>
        ) : (
          segments.map((segment) => (
            <div
              key={segment.from}
              data-slide={segment.from}
              className="flex min-w-0 items-center px-0.5"
              style={{ gridColumn: `${segment.from + 1} / ${segment.to + 2}`, gridRow: 1 }}
            >
              <AllDayChip segment={segment} onOpen={onOpen} />
            </div>
          ))
        )}
      </div>
    </>
  );
}

function allDayTitle(segment: AllDaySegment): string {
  const days = DAYS.slice(segment.from, segment.to + 1)
    .map(dayLabel)
    .join(", ");
  return m.grid_allday_title({ days });
}

function AllDayChip({
  segment,
  prefix,
  slide,
  onOpen,
}: {
  segment: AllDaySegment;
  prefix?: string;
  // Narrow: the chip itself slides with the day (`data-slide`).
  slide?: number;
  onOpen?: (segment: AllDaySegment) => void;
}) {
  const [first, ...rest] = segment.events;
  const className = cn(
    "flex h-7 min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-sm px-2 text-left text-xs whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
    first.noLectures ? "bg-input" : "bg-secondary",
  );
  const label = (
    <>
      {prefix && <span className="text-muted-foreground">{prefix}</span>}
      <b className="truncate font-semibold">{localized(first.title)}</b>
      <span className="truncate text-muted-foreground">{eventNote(first)}</span>
      {rest.length > 0 && (
        <span
          className="ml-auto shrink-0 rounded-sm bg-background/40 px-1.5 leading-5"
          aria-label={m.grid_allday_more({ count: rest.length })}
        >
          +{rest.length}
        </span>
      )}
    </>
  );
  if (onOpen) {
    return (
      <button
        type="button"
        data-slide={slide}
        className={className}
        onClick={() => onOpen(segment)}
      >
        {label}
      </button>
    );
  }
  return (
    <Popover>
      <PopoverTrigger render={<button type="button" data-slide={slide} className={className} />}>
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-3">
        <AllDayList segment={segment} />
      </PopoverContent>
    </Popover>
  );
}

// A chip's events under its days, in the popover or the drawer.
function AllDayList({ segment }: { segment: AllDaySegment }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{allDayTitle(segment)}</h2>
      {segment.events.map((event) => (
        <div key={localized(event.title) + event.startDate} className="text-sm">
          <b className="font-semibold">{localized(event.title)}</b>
          <small className="block text-xs text-muted-foreground">
            {[event.noLectures ? m.grid_no_lectures_note() : null, eventNote(event)]
              .filter((part) => part !== null)
              .join(" · ")}
          </small>
        </div>
      ))}
    </div>
  );
}
