import { use, useMemo, useRef, type ReactNode } from "react";
import { Clock, EyeOff, Hand, Info, Layers, MapPin, Pencil, StickyNote, User } from "lucide-react";
import { cn } from "cn";
import type { SubjectInformation } from "@/lib/primitives/meta";
import { groupName } from "@/lib/primitives/group";
import { Day, minutesOf } from "@/lib/primitives/subject";
import { dayOf, isoDay } from "@/lib/primitives/week";
import { m } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { FIRST_HOUR, LAST_HOUR, type Entry } from "@/lib/layout";
import { KIND_CLASS, kindClass } from "@/lib/kinds";
import {
  dateLabel,
  dayName,
  kindName,
  repeatName,
  rhythmShort,
  slotLabel,
  subjectName,
  timeRangeLabel,
} from "@/lib/subjects";
import { buildingLinks, subjectInfoOf } from "@/lib/primitives/overrides";
import { OverridesContext } from "@/components/OverridesContext";
import { useNow } from "@/hooks/useNow";

// Where a block sits in its day column: its lane of `lanes`, from `start` to
// `end` minutes of the day. `null` in the `other` column, where blocks sit in
// the flow and name their day and time instead.
export type BlockPlace = { lane: number; lanes: number; start: number; end: number } | null;

// The block's box in the column: 2px between neighbours and to the column's
// edges, 1px off the hour lines, so touching blocks never merge.
function placeStyle(place: NonNullable<BlockPlace>): React.CSSProperties {
  const total = (LAST_HOUR - FIRST_HOUR) * 60;
  const start = place.start - FIRST_HOUR * 60;
  const length = Math.max(place.end - place.start, 15);
  const share = 100 / place.lanes;
  return {
    top: `calc(${(start / total) * 100}% + 1px)`,
    height: `calc(${(length / total) * 100}% - 2px)`,
    left: `calc(${place.lane * share}% + ${place.lane === 0 ? 2 : 1}px)`,
    right: `calc(${(place.lanes - place.lane - 1) * share}% + ${place.lane === place.lanes - 1 ? 2 : 1}px)`,
  };
}

// Marks a block (`data-subject-block`), so a press on one is no outside press
// for the popup.
const BLOCK_SELECTOR = "[data-subject-block]";

// A block comes in with a short fade and zoom (a group switched on, another
// filter, the first paint); dimming, the related ring and the press ease
// instead of snapping; hover lifts its colour a little. All CSS: a block's
// cost multiplies by hundreds.
const BLOCK_MOTION =
  "animate-in fade-in-0 zoom-in-95 duration-200 ease-out transition-[opacity,box-shadow,scale,filter] hover:brightness-[0.97] active:scale-[0.97] dark:hover:brightness-125";

// A tap that moved this far is a swipe (day change), not a click on the block.
const TAP_MAX_PX = 10;

// The height a block in the hour grid needs for its three lines (name, kinds,
// room) uncut, as a CSS length: three 16px lines, the `py-1` and the border,
// plus the 2px it keeps off the hour lines. Keep in step with the classes
// below.
export const BLOCK_MIN_HEIGHT = "(3 * 1rem + 0.5rem + 4px)";

// A tap, click, Enter or Space: where the popup should open, the block that
// focus returns to when it closes, and whether the keys opened it.
export type Press = (
  point: { x: number; y: number },
  block: HTMLElement,
  keyboard: boolean,
) => void;

// The press handling every block shares: a positioned <div> with the button
// role and keys, not a <button>. One popup serves every block
// (`SubjectPopup`, in the grid): a popover root per block cost most of the
// first render of a full grid.
function usePress(onPress: Press) {
  const down = useRef<{ x: number; y: number } | null>(null);
  // Opened with Enter / Space, the popup opens beside the block itself.
  const pressBeside = (block: HTMLElement) => {
    const box = block.getBoundingClientRect();
    onPress({ x: box.right, y: box.top }, block, true);
  };
  return {
    role: "button",
    tabIndex: 0,
    "aria-haspopup": "dialog" as const,
    "data-subject-block": "",
    onPointerDown: (event: React.PointerEvent) => {
      down.current = { x: event.clientX, y: event.clientY };
    },
    // A press does not move focus: out of a popup opened with the keys
    // (focus inside) it would close it ("focus-out") before the click could
    // toggle it, and a press on the open block would reopen it. Closing
    // hands focus back to the block anyway.
    onMouseDown: (event: React.MouseEvent) => event.preventDefault(),
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      const from = down.current;
      down.current = null;
      // Swiping across a block changes the day; do not open the popup then.
      if (
        from &&
        (Math.abs(event.clientX - from.x) > TAP_MAX_PX ||
          Math.abs(event.clientY - from.y) > TAP_MAX_PX)
      ) {
        return;
      }
      // The popup opens where the pointer was, not centred on the block. A
      // click without a pointer (`detail` 0, no coordinates, e.g. from
      // assistive technology) opens it beside the block.
      if (event.detail === 0) pressBeside(event.currentTarget);
      else onPress({ x: event.clientX, y: event.clientY }, event.currentTarget, false);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      // Space would scroll the grid.
      event.preventDefault();
      pressBeside(event.currentTarget);
    },
  };
}

// What a block says besides its name: the kinds and the group ("SU, Ue ·
// 2.2"). Subjects without a group show the kinds alone.
function kindsLine(entry: Entry): string {
  const kinds = entry.subject.kind.join(", ");
  return entry.subject.group ? `${kinds} · ${groupName(entry.subject.group)}` : kinds;
}

type Props = {
  entry: Entry;
  place: BlockPlace;
  // The general view: the block names its rhythm ("even weeks", "G1").
  general: boolean;
  // Compact screens: name and kinds only.
  brief: boolean;
  // SH1/SH2 in the current-week view: shown, but the date range is unknown.
  unclear?: boolean;
  // Another group cell is hovered in the tree (desktop): this block steps back.
  dimmed?: boolean;
  // A block of the same subject is hovered in the grid: a faint ring.
  related?: boolean;
  // Mouse enters (the subject's name) or leaves (null) the block.
  onHover?: (name: string | null) => void;
  // This block's details are the ones open: it gets a light border.
  expanded: boolean;
  onPress: Press;
};

export function SubjectBlock({
  entry,
  place,
  general,
  brief,
  unclear = false,
  dimmed = false,
  related = false,
  onHover,
  expanded,
  onPress,
}: Props) {
  const { subject, meeting, dates } = entry;
  const press = usePress(onPress);
  // What the position does not tell: the dates, and in the `other` column
  // (no hour rows) the weekday and the time.
  const datesLabel =
    dates.length === 1
      ? dateLabel(dates[0])
      : dates.length > 1
        ? m.slot_dates({ count: dates.length })
        : null;
  const when =
    place === null
      ? [
          datesLabel === null && meeting.day !== Day.other ? dayName(meeting.day) : datesLabel,
          timeRangeLabel(meeting),
        ]
          .filter((part) => part !== null)
          .join(" · ")
      : null;
  const rhythm = general ? rhythmShort(subject.repeat) : null;
  // A screen reader has no position to go by: a block in the hour grid says
  // its day (or date) and time, every block its timetable.
  const spoken = [
    place === null ? null : (datesLabel ?? dayName(meeting.day)),
    place === null ? null : timeRangeLabel(meeting),
    entry.timetableName,
  ]
    .filter((part) => part !== null)
    .join(", ");

  return (
    <div
      {...press}
      aria-expanded={expanded}
      className={cn(
        "flex cursor-pointer flex-col overflow-hidden rounded-sm border px-2 py-1 text-left text-xs leading-4 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        BLOCK_MOTION,
        kindClass(subject.kind),
        place ? "pointer-events-auto absolute z-[2]" : "relative shrink-0",
        dimmed && "opacity-30",
        related && "ring-1 ring-foreground/40",
        expanded && "outline-2 -outline-offset-1 outline-foreground",
      )}
      style={place ? placeStyle(place) : undefined}
      // Mouse only: a tap would leave the highlight behind.
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") onHover?.(subject.name);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") onHover?.(null);
      }}
    >
      {/* Never cut or broken inside: a column too narrow for it gathers its
          blocks instead (`fitDay`). */}
      <span className="font-semibold break-normal whitespace-nowrap text-foreground">
        {subject.name}
      </span>
      <span className="truncate text-block-kind">{kindsLine(entry)}</span>
      {unclear && <span className="truncate text-warning">{m.badge_sh_unclear()}</span>}
      {!brief && when && <span className="truncate font-mono text-block-room">{when}</span>}
      {!brief && meeting.location && (
        <span className="truncate font-mono text-block-room">{meeting.location}</span>
      )}
      {!brief && rhythm && <span className="text-muted-foreground">{rhythm}</span>}
      <span className="sr-only">{spoken}</span>
    </div>
  );
}

// Blocks a column too narrow for every lane gathers (`fitDay`): dashed, the
// codes one under the other, "+n" for those that do not fit. A press lists
// them (`CollectedList`).
export function CollectedBlock({
  entries,
  place,
  rows,
  dimmed,
  expanded,
  onPress,
}: {
  entries: Entry[];
  place: NonNullable<BlockPlace>;
  // How many lines the block has room for, from its height.
  rows: number;
  dimmed: boolean;
  expanded: boolean;
  onPress: Press;
}) {
  const press = usePress(onPress);
  const kinds = [...new Set(entries.flatMap((entry) => entry.subject.kind))].join(", ");
  // One line for the kinds; past the room the rest is "+n".
  const room = Math.max(1, rows - 1);
  const shown = entries.length <= room ? entries : entries.slice(0, Math.max(0, room - 1));
  const more = entries.length - shown.length;
  return (
    <div
      {...press}
      aria-expanded={expanded}
      aria-label={m.grid_collected({ subjects: entries.map((e) => e.subject.name).join(", ") })}
      className={cn(
        "pointer-events-auto absolute z-[2] flex cursor-pointer flex-col overflow-hidden rounded-sm border border-dashed border-muted-foreground/50 bg-surface px-2 py-1 text-left text-xs leading-4 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        BLOCK_MOTION,
        dimmed && "opacity-30",
        expanded && "outline-2 -outline-offset-1 outline-foreground",
      )}
      style={placeStyle(place)}
    >
      {shown.map((entry) => (
        <span
          key={entry.key}
          className="font-semibold break-normal whitespace-nowrap text-foreground"
        >
          {entry.subject.name}
        </span>
      ))}
      {more > 0 && <span className="font-semibold text-foreground">+{more}</span>}
      {more === 0 && <span className="truncate text-block-kind">{kinds}</span>}
    </div>
  );
}

// What a press on a block opens: the details of one block, or the list of a
// collected one.
export type Popup = { kind: "details"; entry: Entry } | { kind: "list"; entries: Entry[] } | null;

// What the details can do besides showing: everything that changes the
// profile is left out while it is locked.
export type DetailActions = {
  locked: boolean;
  // Switches the block's class off (the tree's checkbox).
  onDisable: (entry: Entry) => void;
  // Opens the subject editor for it.
  onEdit: (entry: Entry) => void;
  // Shows its group cell in the tree.
  onJump: (entry: Entry) => void;
  // "Module description": the dialog lives in the deferred chunk.
  onInfo?: (info: SubjectInformation) => void;
};

type PopupProps = {
  open: boolean;
  // Kept while the popup closes; `null` once its block is no longer in the
  // grid.
  content: Popup;
  // Where the press was: the popup opens there.
  point: { x: number; y: number };
  // Focus goes back to it on closing, while it is still in the page.
  block: HTMLElement | null;
  // Opened with the keys: focus moves into the popup. A tap or click leaves
  // it where it is, as the popover trigger did.
  keyboard: boolean;
  onClose: () => void;
  children: ReactNode;
};

// The one popup of the grid on iPad and desktop. A press on a block is no
// outside press: the block's own click switches to it, or closes the popup
// on the block it belongs to, as a trigger would.
export function SubjectPopup({
  open,
  content,
  point,
  block,
  keyboard,
  onClose,
  children,
}: PopupProps) {
  const anchor = useMemo(
    () => ({ getBoundingClientRect: () => new DOMRect(point.x, point.y, 0, 0) }),
    [point],
  );
  return (
    <Popover
      open={open && content !== null}
      onOpenChange={(next, details) => {
        if (next) return;
        const target = details.event?.target;
        if (
          details.reason === "outside-press" &&
          target instanceof Element &&
          target.closest(BLOCK_SELECTOR)
        ) {
          return;
        }
        onClose();
      }}
    >
      <PopoverContent
        anchor={anchor}
        align="start"
        side="right"
        sideOffset={8}
        className="w-80 gap-0 p-4"
        initialFocus={keyboard}
        finalFocus={() => (block?.isConnected ? block : false)}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

// The collected block's subjects, each opening its details.
export function CollectedList({
  entries,
  onPick,
}: {
  entries: Entry[];
  onPick: (entry: Entry) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{m.grid_collected_title()}</h2>
      <div className="-mx-2 flex flex-col">
        {entries.map((entry) => (
          <Button
            key={entry.key}
            variant="ghost"
            className="h-auto justify-start gap-3 px-2 py-1.5 text-left"
            onClick={() => onPick(entry)}
          >
            <span
              aria-hidden
              className={cn("size-3 shrink-0 rounded-sm border", kindClass(entry.subject.kind))}
            />
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold">{entry.subject.name}</span>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {kindsLine(entry)} · {timeRangeLabel(entry.meeting)}
              </span>
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}

// Whether the meeting is running now: today's date (or, in the general view,
// today's weekday) and the clock between its start and end.
function runningNow(entry: Entry, now: Date, general: boolean): boolean {
  const { meeting } = entry;
  const today = general
    ? meeting.date === null && meeting.day === dayOf(now)
    : meeting.date === isoDay(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  return today && minutes >= minutesOf(meeting.startTime) && minutes < minutesOf(meeting.endTime);
}

const LINK = "underline underline-offset-4 hover:text-foreground";

// The details of one block: kinds and group, the full name, when, who, where,
// the module description, then what can be done with it. Names no timetable
// (user decision).
export function SubjectDetails({
  entry,
  general,
  unclear,
  actions,
  onClose,
}: {
  entry: Entry;
  general: boolean;
  unclear: boolean;
  actions: DetailActions;
  onClose: () => void;
}) {
  const { subject, meeting, dates } = entry;
  const now = useNow();
  const repeat = repeatName(subject.repeat);
  // "I2" -> "Computer Science 2"; an unknown code stays as it is stored.
  const overrides = use(OverridesContext);
  const fullName = subjectName(subject.name, subject.degreeProgram, overrides.degrees);
  const info = subjectInfoOf(subject.name, subject.degreeProgram, overrides.degrees);
  // "WE.105" carries the building code; unknown rooms have no links.
  const links = buildingLinks(meeting.location, overrides.locations);
  const running = runningNow(entry, now, general);
  const status = [repeat, running ? m.details_running() : null].filter(Boolean).join(" · ");
  const act = (run: () => void) => () => {
    onClose();
    run();
  };

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {subject.kind.map((kind) => (
            <span
              key={kind}
              className={cn(
                "inline-flex h-5 items-center rounded-sm border px-1.5 text-xs",
                KIND_CLASS[kind],
              )}
            >
              {kindName(kind)}
            </span>
          ))}
          {subject.group && (
            <span className="inline-flex h-5 items-center rounded-sm bg-secondary px-1.5 text-xs">
              {m.subject_group({ group: groupName(subject.group) })}
            </span>
          )}
        </div>
        <div className="flex flex-col">
          <h2 className="text-base leading-6 font-semibold">{fullName}</h2>
          {fullName !== subject.name && (
            <span className="font-mono text-xs text-muted-foreground">{subject.name}</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Row icon={<Clock />}>
          <span className="font-mono">
            {dates.length > 0
              ? `${dates.map(dateLabel).join(", ")} ${timeRangeLabel(meeting)}`
              : slotLabel(meeting)}
          </span>
          {status && <small className="block text-xs text-muted-foreground">{status}</small>}
          {unclear && <small className="block text-xs text-warning">{m.badge_sh_unclear()}</small>}
        </Row>
        {meeting.professor && <Row icon={<User />}>{meeting.professor}</Row>}
        {meeting.location && (
          <Row icon={<MapPin />}>
            <span>
              <span className="font-mono">{meeting.location}</span>
              {links?.name && ` · ${links.name}`}
            </span>
            {(links?.mapsUrl || links?.siteUrl) && (
              <span className="flex gap-3">
                {links.mapsUrl && (
                  <a
                    href={links.mapsUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={LINK}
                  >
                    {m.location_maps()}
                  </a>
                )}
                {links.siteUrl && (
                  <a
                    href={links.siteUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={LINK}
                  >
                    {m.location_site()}
                  </a>
                )}
              </span>
            )}
          </Row>
        )}
        {subject.onDemand && (
          <Row icon={<Hand />}>
            {m.subject_on_demand()}
            <small className="block text-xs text-muted-foreground">
              {m.subject_on_demand_hint()}
            </small>
          </Row>
        )}
        {subject.note && <Row icon={<StickyNote />}>{subject.note}</Row>}
        {/* Only where a degree file describes the subject. */}
        {info && actions.onInfo && (
          <Row icon={<Info />}>
            <button
              type="button"
              className={cn(LINK, "text-left")}
              onClick={act(() => actions.onInfo?.(info))}
            >
              {m.details_module()}
            </button>
          </Row>
        )}
      </div>

      <div className="-mx-2 flex flex-col border-t pt-2">
        {!actions.locked && (
          <>
            <Action icon={<EyeOff />} onClick={act(() => actions.onDisable(entry))}>
              {m.details_disable()}
            </Action>
            <Action icon={<Pencil />} onClick={act(() => actions.onEdit(entry))}>
              {m.details_edit()}
            </Action>
          </>
        )}
        <Action icon={<Layers />} onClick={act(() => actions.onJump(entry))}>
          {m.details_show_group()}
        </Action>
      </div>
    </div>
  );
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-5 shrink-0 items-center text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1">{children}</div>
    </div>
  );
}

function Action({
  icon,
  onClick,
  children,
}: {
  icon: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button variant="ghost" className="h-9 justify-start gap-3 px-2" onClick={onClick}>
      {icon}
      {children}
    </Button>
  );
}
