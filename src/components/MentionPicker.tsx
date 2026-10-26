import { use, useState, type ReactElement } from "react";
import { CalendarDays, ChevronLeft, Repeat, StickyNote } from "lucide-react";
import { parseISO } from "date-fns";
import { cn } from "cn";
import { getLocale, m } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popup } from "@/components/ohmtools/popup";
import { OverridesContext } from "@/components/OverridesContext";
import { groupName } from "@/lib/primitives/group";
import type { SemesterDates } from "@/lib/primitives/meta";
import { formatTime } from "@/lib/primitives/subject";
import type { Timetable } from "@/lib/primitives/timetable";
import type { Entry } from "@/lib/layout";
import { kindClass } from "@/lib/kinds";
import {
  classRows,
  classToken,
  isPast,
  mentionMatches,
  mentionToken,
  parseMentionQuery,
  pickerRange,
  pickerRows,
  seriesIn,
  type Mention,
  type Series,
} from "@/lib/mentions";
import { dayDateLabel, dayName, kindNames, subjectName, timeRangeLabel } from "@/lib/subjects";
import { useStep } from "@/lib/ohmtools/steps";

// "Link a class" (the notes' "@" and their insert bar's "Termin"): a popover
// at the insert bar's button, a drawer on phones (the design's `Popup`). Its
// own field takes what is typed, never the note: only the finished link goes
// into the text, so a link has a clear end however many words were searched.
// Step 1: a row per class and time, a press links its next date; a date,
// weekday or week typed into the field narrows to those dates. Step 2 (the
// calendar at a row's end): every date of the class, a month per line, past
// ones struck through. "Every date" (user request): a row per class, a press
// links all its dates at once (`@[MA3 Ue 2.1]`), whose press shows the next.
export function MentionPicker({
  trigger,
  open,
  onOpenChange,
  timetables,
  dates,
  today,
  mentions,
  onPick,
}: {
  trigger: ReactElement<Record<string, unknown>>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timetables: readonly Timetable[];
  dates: SemesterDates | null;
  today: Date;
  // The links already in the notes: their dates carry the notes' mark.
  mentions: readonly Mention[];
  // The link's text: to one Termin or to every Termin of a class.
  onPick: (token: string) => void;
}) {
  return (
    <Popup
      kind="popover"
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      title={m.mention_title()}
      titleHidden
      align="start"
      className="gap-3 compact:w-80"
    >
      {open && (
        <PickerBody
          timetables={timetables}
          dates={dates}
          today={today}
          mentions={mentions}
          onPick={onPick}
        />
      )}
    </Popup>
  );
}

function PickerBody({
  timetables,
  dates,
  today,
  mentions,
  onPick,
}: {
  timetables: readonly Timetable[];
  dates: SemesterDates | null;
  today: Date;
  mentions: readonly Mention[];
  onPick: (token: string) => void;
}) {
  const overrides = use(OverridesContext);
  const narrow = useStep() === "narrow";
  const [every, setEvery] = useState(false);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState<Series | null>(null);
  // Built once per opening: every week of the period, a few dozen at most.
  const [series] = useState(() =>
    seriesIn(timetables, dates, pickerRange(timetables, dates, today)),
  );
  const parsed = parseMentionQuery(query, today);
  // What the words match: code and full name, kinds as codes and words,
  // group, room and professor.
  const haystack = ({ subject, meeting }: Entry) =>
    [
      subject.name,
      subjectName(subject.name, subject.degreeProgram, overrides.degrees),
      subject.kind.join(" "),
      kindNames(subject.kind),
      subject.group ? groupName(subject.group) : "",
      meeting.location,
      meeting.professor,
    ].join(" ");
  const rows = pickerRows(series, parsed, haystack, today);
  const classes = classRows(series, parsed, haystack, today);
  // Dates a link names (one or every Termin of the class) carry the mark;
  // in "Every date", classes linked as a whole.
  const noted = (entry: Entry) => mentions.some((mention) => mentionMatches(mention, entry));
  const notedClass = (entry: Entry) =>
    mentions.some((mention) => mention.date === null && mentionMatches(mention, entry));

  if (shown) {
    return (
      <DatesStep
        series={shown}
        today={today}
        narrow={narrow}
        noted={noted}
        onBack={() => setShown(null)}
        onPick={(entry) => onPick(mentionToken(entry))}
      />
    );
  }

  const count = every ? classes.length : rows.length;
  const caption =
    series.length === 0
      ? m.mention_empty()
      : count === 0
        ? m.mention_none()
        : every
          ? m.mention_every_next()
          : parsed.date !== null
            ? m.mention_on_date({ count: rows.length, date: dayDateLabel(parsed.date) })
            : parsed.week !== null
              ? m.mention_in_week({ count: rows.length, week: String(parsed.week) })
              : m.mention_next();

  const row = cn(
    "h-auto flex-1 justify-start gap-2.5 px-2 text-left",
    narrow ? "min-h-13 py-1.5" : "min-h-11 py-1",
  );

  return (
    <>
      <Tabs value={every ? "every" : "one"} onValueChange={(value) => setEvery(value === "every")}>
        <TabsList aria-label={m.mention_mode_label()} className={cn("w-full", narrow && "h-11!")}>
          <TabsTrigger value="one">{m.mention_mode_one()}</TabsTrigger>
          <TabsTrigger value="every">{m.mention_mode_every()}</TabsTrigger>
        </TabsList>
      </Tabs>
      {/* Not on phones: a drawer opened with the keyboard up filled the
          screen above its own field (user report); a tap on it brings the
          keyboard the drawer's way. */}
      <Input
        autoFocus={!narrow}
        enterKeyHint="done"
        aria-label={m.mention_search_label()}
        placeholder={m.mention_search()}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || count === 0) return;
          event.preventDefault();
          onPick(every ? classToken(classes[0].entry.subject) : mentionToken(rows[0].entry));
        }}
        className={cn(narrow && "h-11")}
      />
      <p className="text-xs text-muted-foreground">{caption}</p>
      {every && classes.length > 0 && (
        <div className="-mx-2 flex flex-col compact:max-h-72 compact:overflow-y-auto">
          {classes.map(({ key, entry, series: all, count: dates }, i) => (
            <div key={key} className={cn("flex items-center rounded-md", i === 0 && "bg-accent")}>
              <Button
                variant="ghost"
                className={row}
                onClick={() => onPick(classToken(entry.subject))}
              >
                <KindDot entry={entry} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <ClassName entry={entry} />
                  <span className="truncate font-mono text-xs font-normal text-muted-foreground">
                    {[
                      ...all.map(
                        (one) =>
                          `${dayName(one.entry.meeting.day)} ${formatTime(one.entry.meeting.startTime)}`,
                      ),
                      m.mention_dates({ count: dates }),
                    ].join(" · ")}
                  </span>
                </span>
                {notedClass(entry) ? (
                  <StickyNote aria-label={m.mention_noted()} className="text-muted-foreground" />
                ) : (
                  <Repeat aria-hidden className="text-muted-foreground" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
      {!every && rows.length > 0 && (
        <div className="-mx-2 flex flex-col compact:max-h-72 compact:overflow-y-auto">
          {rows.map(({ series: one, entry, exact }, i) => (
            <div
              key={`${one.key}/${entry.meeting.date}`}
              className={cn("flex items-center rounded-md", i === 0 && "bg-accent")}
            >
              <Button variant="ghost" className={row} onClick={() => onPick(mentionToken(entry))}>
                <KindDot entry={entry} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <ClassName entry={entry} />
                  <span className="truncate font-mono text-xs font-normal text-muted-foreground">
                    {exact
                      ? [
                          `${dayDateLabel(entry.meeting.date!)} ${timeRangeLabel(entry.meeting)}`,
                          entry.meeting.location,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : `${dayName(entry.meeting.day)} ${formatTime(entry.meeting.startTime)}`}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-sm bg-accent px-1.5 font-mono text-xs leading-6 font-normal",
                    isPast(entry.meeting.date!, today) && "text-muted-foreground line-through",
                  )}
                >
                  {exact ? formatTime(entry.meeting.startTime) : dayDateLabel(entry.meeting.date!)}
                </span>
              </Button>
              {!exact && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("text-muted-foreground", narrow && "size-11")}
                  aria-label={m.mention_other_date()}
                  title={m.mention_other_date()}
                  onClick={() => setShown(one)}
                >
                  <CalendarDays />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {series.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {every ? m.mention_every_hint() : m.mention_hint()}
        </p>
      )}
    </>
  );
}

// Every date of one class, a month per line: past ones muted and struck
// through, the next one ringed, those already in the notes marked.
function DatesStep({
  series,
  today,
  narrow,
  noted,
  onBack,
  onPick,
}: {
  series: Series;
  today: Date;
  narrow: boolean;
  noted: (entry: Entry) => boolean;
  onBack: () => void;
  onPick: (entry: Entry) => void;
}) {
  const { entry } = series;
  const month = new Intl.DateTimeFormat(getLocale(), { month: "short" });
  const day = new Intl.DateTimeFormat(getLocale(), { day: "numeric" });
  const next = series.dates.find(({ meeting }) => !isPast(meeting.date!, today));
  const months: { name: string; dates: Entry[] }[] = [];
  for (const one of series.dates) {
    const name = month.format(parseISO(one.meeting.date!));
    if (months.at(-1)?.name === name) months.at(-1)!.dates.push(one);
    else months.push({ name, dates: [one] });
  }

  return (
    <>
      <div className="-ml-2 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={cn(narrow && "size-11")}
          aria-label={m.panel_back()}
          onClick={onBack}
        >
          <ChevronLeft />
        </Button>
        <KindDot entry={entry} />
        <span className="min-w-0 flex-1 truncate">
          <b className="font-semibold">{entry.subject.name}</b> {entry.subject.kind.join(", ")}{" "}
          <span className="font-mono text-xs text-muted-foreground">
            {dayName(entry.meeting.day)} {formatTime(entry.meeting.startTime)}
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {m.mention_dates({ count: series.dates.length })}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {months.map(({ name, dates }) => (
          <div key={name + dates[0].meeting.date} className="flex items-center gap-2">
            <span className="w-9 shrink-0 font-mono text-xs text-muted-foreground">{name}</span>
            <div className="grid flex-1 grid-cols-5 gap-1">
              {dates.map((one) => {
                const past = isPast(one.meeting.date!, today);
                const isNext = one === next;
                const inNotes = noted(one);
                return (
                  <Button
                    key={one.meeting.date}
                    variant="ghost"
                    className={cn(
                      "relative px-0 font-mono font-normal",
                      narrow ? "h-11" : "h-8",
                      past && "text-muted-foreground",
                      isNext && "ring-[1.5px] ring-foreground ring-inset",
                      !past && !isNext && "bg-accent",
                    )}
                    aria-label={[
                      dayDateLabel(one.meeting.date!),
                      past ? m.mention_past() : null,
                      isNext ? m.mention_next_date() : null,
                      inNotes ? m.mention_noted() : null,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                    onClick={() => onPick(one)}
                  >
                    {day.format(parseISO(one.meeting.date!))}.
                    {/* Struck through, not only greyed (user decision): a
                        line of its own, plain `line-through` vanishes in a
                        two-digit grey number. */}
                    {past && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-[22%] top-1/2 h-[1.5px] -translate-y-1/2 bg-current"
                      />
                    )}
                    {inNotes && (
                      <StickyNote
                        aria-hidden
                        className="pointer-events-none absolute top-1 right-1 size-2.5!"
                      />
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// "MA3 Ue 2.1": name, kinds, group.
function ClassName({ entry }: { entry: Entry }) {
  return (
    <span className="truncate">
      <b className="font-semibold">{entry.subject.name}</b>{" "}
      <span className="font-normal">{entry.subject.kind.join(", ")}</span>
      {entry.subject.group && (
        <span className="font-normal text-muted-foreground"> {groupName(entry.subject.group)}</span>
      )}
    </span>
  );
}

function KindDot({ entry }: { entry: Entry }) {
  return (
    <span
      aria-hidden
      className={cn("size-2.5 shrink-0 rounded-[3px] border", kindClass(entry.subject.kind))}
    />
  );
}
