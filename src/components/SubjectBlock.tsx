import { use, useMemo, useRef, useState } from "react";
import { Clock, Hand, Info, MapPin, StickyNote, User } from "lucide-react";
import { cn } from "cn";
import type { SubjectInformation } from "@/lib/primitives/meta";
import { groupName } from "@/lib/primitives/group";
import { Day, kindLabel, minutesOf } from "@/lib/primitives/subject";
import { m } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FIRST_HOUR, LAST_HOUR, type Entry } from "@/lib/layout";
import {
  dateLabel,
  dayName,
  kindNames,
  repeatName,
  slotLabel,
  subjectName,
  timeRangeLabel,
} from "@/lib/subjects";
import { buildingLinks, subjectInfoOf } from "@/lib/primitives/overrides";
import { OverridesContext } from "@/components/OverridesContext";
import { tintStyleOf } from "@/lib/tint";

type Props = {
  entry: Entry;
  // Lane in the day column's hour grid; `null` in the `other` list, where the
  // block sits in the flow and names its day and time instead.
  lane: { lane: number; lanes: number } | null;
  // SH1/SH2 in the current-week view: shown, but the date range is unknown.
  unclear?: boolean;
  // Another group cell is hovered in the tree (desktop): this block steps back.
  dimmed?: boolean;
  // A block of the same subject is hovered in the grid: a faint ring.
  related?: boolean;
  // Mouse enters (the subject's name) or leaves (null) the block.
  onHover?: (name: string | null) => void;
  // Shows the block's group cell in the tree.
  onJump?: () => void;
  // "More info" in the popup: the dialog lives in the deferred chunk.
  onInfo?: (info: SubjectInformation) => void;
};

// A tap that moved this far is a swipe (day change), not a click on the block.
const TAP_MAX_PX = 10;

export function SubjectBlock({
  entry,
  lane,
  unclear = false,
  dimmed = false,
  related = false,
  onHover,
  onJump,
  onInfo,
}: Props) {
  const { subject, meeting, dates } = entry;
  // The grid mixes timetables, so every block carries its timetable's hue of
  // `--primary`.
  const tint = tintStyleOf(entry.tint);
  const total = (LAST_HOUR - FIRST_HOUR) * 60;
  const start = minutesOf(meeting.startTime) - FIRST_HOUR * 60;
  const end = minutesOf(meeting.endTime) - FIRST_HOUR * 60;
  // Subjects without a group show the kind alone.
  const group = subject.group ? groupName(subject.group) : "";
  const repeat = repeatName(subject.repeat);
  // What the position does not tell: the dates, and in the `other` list (no
  // column, no hour rows) the weekday and the time.
  const datesLabel =
    dates.length === 1
      ? dateLabel(dates[0])
      : dates.length > 1
        ? m.slot_dates({ count: dates.length })
        : null;
  const when = [
    lane === null && datesLabel === null && meeting.day !== Day.other
      ? dayName(meeting.day)
      : datesLabel,
    lane === null ? timeRangeLabel(meeting) : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");
  // A screen reader has no position or tint to go by: a block in the hour grid
  // says its day (or date) and time, every block its timetable.
  const spoken = [
    lane === null ? null : (datesLabel ?? dayName(meeting.day)),
    lane === null ? null : timeRangeLabel(meeting),
    entry.timetableName,
  ]
    .filter((part) => part !== null)
    .join(", ");
  // Every kind of the subject is shown, not only the first.
  const kinds = kindLabel(subject.kind);
  // The popup spells both out: "I2" -> "Computer Science 2", "Pr" ->
  // "Laboratory". An unknown shortcut stays as it is stored in the subject.
  const overrides = use(OverridesContext);
  const fullName = subjectName(subject.name, subject.degreeProgram, overrides.degrees);
  const info = subjectInfoOf(subject.name, subject.degreeProgram, overrides.degrees);
  const fullKinds = kindNames(subject.kind);
  // "WE.105" carries the building shortcut; unknown rooms have no links.
  const links = buildingLinks(meeting.location, overrides.locations);

  // The details popup opens where the pointer was, not centred on the block.
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState({ x: 0, y: 0 });
  const down = useRef<{ x: number; y: number } | null>(null);
  const anchor = useMemo(
    () => ({ getBoundingClientRect: () => new DOMRect(point.x, point.y, 0, 0) }),
    [point],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* The block is a positioned <div>, not a <button>: Base UI then adds
          the button role and keyboard handling itself. */}
      <PopoverTrigger
        nativeButton={false}
        render={
          lane ? (
            <div
              className={cn(
                "pointer-events-auto absolute cursor-pointer p-px text-left transition-opacity",
                dimmed && "opacity-30",
              )}
              style={{
                top: `${(start / total) * 100}%`,
                height: `${(Math.max(end - start, 15) / total) * 100}%`,
                left: `${(lane.lane / lane.lanes) * 100}%`,
                width: `${(1 / lane.lanes) * 100}%`,
              }}
            />
          ) : (
            <div
              className={cn("cursor-pointer text-left transition-opacity", dimmed && "opacity-30")}
            />
          )
        }
        // Mouse only: a tap would leave the highlight behind.
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") onHover?.(subject.name);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") onHover?.(null);
        }}
        onPointerDown={(event) => {
          down.current = { x: event.clientX, y: event.clientY };
        }}
        onClick={(event) => {
          const from = down.current;
          down.current = null;
          // Swiping across a block changes the day; do not open the popup then.
          // Base UI ignores `preventDefault` here, only this stops its handler.
          if (
            from &&
            (Math.abs(event.clientX - from.x) > TAP_MAX_PX ||
              Math.abs(event.clientY - from.y) > TAP_MAX_PX)
          ) {
            event.preventBaseUIHandler();
            return;
          }
          // Enter / Space arrive as a click without a pointer (`detail` 0,
          // no coordinates): the popup then opens beside the block itself.
          if (event.detail === 0) {
            const box = event.currentTarget.getBoundingClientRect();
            setPoint({ x: box.right, y: box.top });
          } else {
            setPoint({ x: event.clientX, y: event.clientY });
          }
        }}
      >
        <div
          className={cn(
            "flex h-full flex-col overflow-hidden border bg-(--tint) px-1 py-0.5 text-xs leading-tight text-primary-foreground",
            // 1px: exactly the wrapper's `p-px`, so rings of touching blocks
            // never overlap into a darker line.
            related && "ring-1 ring-foreground/40",
          )}
          style={tint}
        >
          <span className="truncate font-medium">{subject.name}</span>
          <span className="flex items-center gap-1 truncate text-primary-foreground/80">
            <span className="truncate">{group ? `${kinds} · ${group}` : kinds}</span>
            {subject.repeat.type !== "A" && (
              <Badge
                variant="outline"
                className="shrink-0 border-primary-foreground/40 text-primary-foreground"
              >
                {subject.repeat.type}
              </Badge>
            )}
          </span>
          {unclear && (
            <Badge variant="destructive" className="max-w-full">
              <span className="truncate">{m.badge_sh_unclear()}</span>
            </Badge>
          )}
          {when && <span className="truncate text-primary-foreground/80 tabular-nums">{when}</span>}
          {meeting.location && (
            <span className="truncate text-primary-foreground/80">{meeting.location}</span>
          )}
          <span className="sr-only">{spoken}</span>
        </div>
      </PopoverTrigger>

      <PopoverContent anchor={anchor} align="start" side="right" sideOffset={8} className="w-64">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-medium">{fullName}</span>
            {/* The group is the way back to the tree: it shows the cell this
              block belongs to. */}
            <span className="text-muted-foreground">
              {fullKinds} ·{" "}
              <button
                type="button"
                className={cn(buttonVariants({ variant: "link", size: "xs" }), "h-auto px-0! py-0")}
                title={m.block_show_group()}
                onClick={() => {
                  setOpen(false);
                  onJump?.();
                }}
              >
                {group ? m.subject_group({ group }) : m.tree_no_group()}
              </button>
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="flex items-start gap-2 text-muted-foreground">
              <Clock className="h-lh w-3.5 shrink-0" />
              <span className="flex flex-col">
                {dates.length > 0 ? (
                  <>
                    <span className="tabular-nums">{timeRangeLabel(meeting)}</span>
                    <span className="tabular-nums">{dates.map(dateLabel).join(", ")}</span>
                  </>
                ) : (
                  <span className="tabular-nums">{slotLabel(meeting)}</span>
                )}
                {repeat && <span>{repeat}</span>}
              </span>
            </span>
            {meeting.professor && (
              <span className="flex items-start gap-2 text-muted-foreground">
                <User className="h-lh w-3.5 shrink-0" />
                <span>{meeting.professor}</span>
              </span>
            )}
            {meeting.location && (
              <span className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-lh w-3.5 shrink-0" />
                <span className="flex flex-wrap gap-x-2">
                  <span>{meeting.location}</span>
                  {links?.name && <span>{links.name}</span>}
                  {links?.mapsUrl && (
                    <a
                      href={links.mapsUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={cn(
                        buttonVariants({ variant: "link", size: "xs" }),
                        "h-auto px-0! py-0",
                      )}
                    >
                      {m.location_maps()}
                    </a>
                  )}
                  {links?.siteUrl && (
                    <a
                      href={links.siteUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={cn(
                        buttonVariants({ variant: "link", size: "xs" }),
                        "h-auto px-0! py-0",
                      )}
                    >
                      {m.location_site()}
                    </a>
                  )}
                </span>
              </span>
            )}
            {subject.onDemand && (
              <span className="flex items-start gap-2 text-muted-foreground">
                <Hand className="h-lh w-3.5 shrink-0" />
                <span>{m.subject_on_demand()}</span>
              </span>
            )}
            {subject.note && (
              <span className="flex items-start gap-2 text-muted-foreground">
                <StickyNote className="h-lh w-3.5 shrink-0" />
                <span className="min-w-0">{subject.note}</span>
              </span>
            )}
            {info && onInfo && (
              <span className="flex items-start gap-2 text-muted-foreground">
                <Info className="h-lh w-3.5 shrink-0" />
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "link", size: "xs" }),
                    "h-auto px-0! py-0",
                  )}
                  onClick={() => {
                    setOpen(false);
                    onInfo(info);
                  }}
                >
                  {m.subject_more_info()}
                </button>
              </span>
            )}
            {unclear && (
              <Badge variant="destructive" className="max-w-full">
                {m.badge_sh_unclear()}
              </Badge>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
