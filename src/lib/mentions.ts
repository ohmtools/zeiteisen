import { addDays, addWeeks, isAfter, parseISO, startOfISOWeek } from "date-fns";
import { groupName } from "@/lib/primitives/group";
import type { SemesterDates } from "@/lib/primitives/meta";
import { lectureRange, type DateRange } from "@/lib/primitives/occurrence";
import type { Profile, ProfileName } from "@/lib/primitives/profile";
import {
  Day,
  formatTime,
  kindLabel,
  minutesOf,
  sameSubject,
  type Subject,
} from "@/lib/primitives/subject";
import { enabledSubjects, type Timetable } from "@/lib/primitives/timetable";
import { DAYS, dayOf, eventsForWeek, isoDay, isoWeek } from "@/lib/primitives/week";
import { weekEntries, type Entry } from "@/lib/layout";
import {
  labelParts,
  notesLines,
  type LabelParts,
  type NotesLine,
  type NotesPiece,
} from "@/lib/notes";

// Links from the notes to a Termin: `@[2026-10-26 09:45 MA3 Ue 2.1]`, the
// date, the start time and the class (name, kinds, group) in words; or to
// every Termin of a class, `@[MA3 Ue 2.1]` (user request), which shows its
// next one. Readable
// in the text area, and when its Termin is gone the app can say what no
// longer fits (another time, switched off, in another profile). Plain text in
// `tt.notes.v1`, so the notes stay a string. Was a hash of the same fields
// (user decision, 2026-10-25: a hash tells nothing once it no longer fits).

// What a link points at: one Termin; with `date` null every Termin of the
// class; with a `bound` every Termin fitting the label from `date` (and
// `time`, if given) on ("+") or up to it ("-"), typed by hand only.
export type MentionTarget = { label: string } & (
  | { date: string; time: string; bound: null }
  | { date: null; time: null; bound: null }
  | { date: string; time: string | null; bound: "+" | "-" }
);

export { labelParts };

// A link to one Termin.
type OneTarget = Extract<MentionTarget, { date: string; bound: null }>;

export function isOne<T extends MentionTarget>(mention: T): mention is T & OneTarget {
  return mention.bound === null && mention.date !== null;
}

// The text of a link like `mention` (one Termin aside), naming `label`.
export function withLabel(mention: MentionTarget, label: string): string {
  if (mention.date === null) return `@[${label}]`;
  const bound = mention.bound ?? "";
  return `@[${[`${mention.date}${bound}`, mention.time, label].filter(Boolean).join(" ")}]`;
}

// Whether a block lies in a link's span: any for every Termin, from or up
// to the date (and time) for a bound one; the general view's have no date.
function inSpan(mention: MentionTarget, meeting: Entry["meeting"]): boolean {
  if (mention.date === null) return true;
  if (meeting.date === null) return false;
  if (meeting.date !== mention.date) {
    return mention.bound === "+" ? meeting.date > mention.date : meeting.date < mention.date;
  }
  if (mention.time === null) return true;
  const start = formatTime(meeting.startTime);
  return mention.bound === "+" ? start >= mention.time : start <= mention.time;
}

// A name as a label holds it: one space between words, no brackets.
function labelName(name: string): string {
  return name
    .replace(/[\]\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "MA3 SU,Ue 2.1": the class a link names, readable in the text area.
export function mentionLabel(subject: Subject): string {
  return [
    labelName(subject.name),
    kindLabel(subject.kind),
    subject.group ? groupName(subject.group) : null,
  ]
    .filter((part) => part !== null)
    .join(" ");
}

// The text a link to this Termin on its date is written as.
export function mentionToken(entry: Entry): string {
  return `@[${entry.meeting.date} ${formatTime(entry.meeting.startTime)} ${mentionLabel(entry.subject)}]`;
}

// The text a link to every Termin of this class is written as.
export function classToken(subject: Subject): string {
  return `@[${mentionLabel(subject)}]`;
}

// Whether the link points at this block: date, start, name, kinds, group; a
// link to every Termin at each block its label fits (the general view's
// too), a bound one at those in its span.
export function mentionMatches(
  mention: MentionTarget,
  entry: Pick<Entry, "subject" | "meeting">,
): boolean {
  const parts = labelParts(mention.label);
  if (parts === null) return false;
  if (!isOne(mention)) return fits(parts, entry.subject) && inSpan(mention, entry.meeting);
  return (
    entry.meeting.date === mention.date &&
    formatTime(entry.meeting.startTime) === mention.time &&
    sameClass(parts, entry.subject)
  );
}

// A link to one Termin: the very class, no group being one too.
function sameClass(parts: LabelParts, subject: Subject) {
  return (
    labelName(subject.name) === parts.name &&
    kindLabel(subject.kind) === parts.kinds &&
    (subject.group ? groupName(subject.group) : "") === (parts.group ?? "")
  );
}

// A link to every Termin: the parts its label names, the others any. A
// whole label (the picker's) names the class, a missing group left open:
// `@[MA3]` every MA3, `@[MA3 Ue]` its exercises, `@[MA3 2.1]` its group 2.1
// of every kind (user request: typed by hand only, nowhere offered or
// explained in the app).
function fits(parts: LabelParts, subject: Subject) {
  return (
    labelName(subject.name) === parts.name &&
    (parts.kinds === null || kindLabel(subject.kind) === parts.kinds) &&
    (parts.group === null ||
      (subject.group !== undefined && groupName(subject.group) === parts.group))
  );
}

// A label naming the same parts as `parts` for `subject`: where a link to
// every Termin goes when its class changes.
function labelLike(parts: LabelParts, subject: Subject): string {
  const shaped = [
    labelName(subject.name),
    parts.kinds !== null ? kindLabel(subject.kind) : null,
    parts.group !== null && subject.group ? groupName(subject.group) : null,
  ]
    .filter((part) => part !== null)
    .join(" ");
  return labelParts(shaped) ? shaped : mentionLabel(subject);
}

export type Mention = Extract<NotesPiece, { kind: "mention" }> & {
  // The line holding it, and the heading above that line ("" before any).
  line: NotesLine;
  heading: string;
};

// Every link to a Termin in the notes, with its line and heading.
export function mentionsIn(lines: readonly NotesLine[]): Mention[] {
  const found: Mention[] = [];
  let heading = "";
  for (const line of lines) {
    if (line.heading) heading = plainText(line.pieces);
    for (const piece of line.pieces) {
      if (piece.kind === "mention") found.push({ ...piece, line, heading });
    }
  }
  return found;
}

// A line as words: a link to a Termin by its label, the one starting at
// `skip` left out (the block's own details need not name the block).
export function plainText(pieces: readonly NotesPiece[], skip?: number): string {
  return pieces
    .map((piece) =>
      piece.start === skip ? "" : piece.kind === "mention" ? piece.label : piece.text,
    )
    .join("")
    .replace(/\s+/g, " ")
    .replace(/ ([,.;:!?])/g, "$1")
    .trim();
}

export function mentionsOfText(text: string): Mention[] {
  return mentionsIn(notesLines(text));
}

// Every subject of a timetable switched on: where a link to a switched-off
// class is still found.
function allOn(timetable: Timetable): Timetable {
  return { ...timetable, subjects: timetable.subjects.withMappedExtra(() => ({ enabled: true })) };
}

// The blocks of a profile on a date, the switched-off ones too or not, each
// week built once.
function dayLookup(dates: SemesterDates | null) {
  const weeks = new Map<string, Entry[]>();
  return (profile: Profile, all: boolean, date: string): Entry[] => {
    const day = parseISO(date);
    if (Number.isNaN(day.getTime())) return [];
    const start = startOfISOWeek(day);
    const key = `${profile.name}/${all}/${start.getTime()}`;
    let entries = weeks.get(key);
    if (!entries) {
      const timetables = all ? profile.timetables.map(allOn) : profile.timetables;
      entries = weekEntries(timetables, start, eventsForWeek(dates, start));
      weeks.set(key, entries);
    }
    return entries.filter((entry) => entry.meeting.date === date);
  };
}

// Every dated block of a profile, the switched-off ones too or not, in the
// days the picker offers (`pickerRange`), in order: where a link to every
// Termin of a class finds its next one. Built once per profile.
function classLookup(dates: SemesterDates | null, today: Date) {
  const built = new Map<string, Entry[]>();
  return (profile: Profile, all: boolean): Entry[] => {
    const key = `${profile.name}/${all}`;
    let entries = built.get(key);
    if (!entries) {
      const timetables = all ? profile.timetables.map(allOn) : profile.timetables;
      entries = seriesIn(timetables, dates, pickerRange(timetables, dates, today))
        .flatMap((series) => series.dates)
        .sort(byDate);
      built.set(key, entries);
    }
    return entries;
  };
}

// Dated blocks in time order.
function byDate(a: Entry, b: Entry): number {
  return (
    a.meeting.date!.localeCompare(b.meeting.date!) ||
    minutesOf(a.meeting.startTime) - minutesOf(b.meeting.startTime)
  );
}

// The next block of those (today's included), else the last one.
export function nextOf(entries: readonly Entry[], today: Date): Entry | undefined {
  const from = isoDay(today);
  return entries.find(({ meeting }) => meeting.date! >= from) ?? entries.at(-1);
}

// What became of a link's Termin: in the active profile's grid (`ok`),
// switched off there (`off`), only in another profile (`elsewhere`), or
// nowhere (`broken`, with the active profile's blocks of the same name that
// day: the same class first, at another time). A link to every Termin of a
// class stands for its next one; broken, its candidates are the active
// grid's classes of that name, each by its next Termin.
export type MentionStatus =
  | { kind: "ok"; entry: Entry }
  | { kind: "off"; entry: Entry }
  | { kind: "elsewhere"; entry: Entry; profile: ProfileName }
  | { kind: "broken"; candidates: Entry[] };

export function mentionResolver(
  profiles: readonly Profile[],
  activeName: ProfileName,
  dates: SemesterDates | null,
  today: Date,
): { status: (mention: MentionTarget) => MentionStatus } {
  const day = dayLookup(dates);
  const classes = classLookup(dates, today);
  const active = profiles.find((profile) => profile.name === activeName);
  return {
    status: (mention) => {
      const find = (profile: Profile, all: boolean) =>
        isOne(mention)
          ? day(profile, all, mention.date).find((entry) => mentionMatches(mention, entry))
          : nextOf(
              classes(profile, all).filter((entry) => mentionMatches(mention, entry)),
              today,
            );
      if (active) {
        const on = find(active, false);
        if (on) return { kind: "ok", entry: on };
        const off = find(active, true);
        if (off) return { kind: "off", entry: off };
      }
      for (const profile of profiles) {
        if (profile === active) continue;
        const there = find(profile, true);
        if (there) return { kind: "elsewhere", entry: there, profile: profile.name };
      }
      const parts = labelParts(mention.label);
      if (!isOne(mention)) {
        const named = new Map<string, Entry[]>();
        if (active && parts) {
          for (const entry of classes(active, false)) {
            if (labelName(entry.subject.name) !== parts.name) continue;
            const label = mentionLabel(entry.subject);
            named.set(label, [...(named.get(label) ?? []), entry]);
          }
        }
        const candidates = [...named.values()].map((entries) => nextOf(entries, today)!);
        return { kind: "broken", candidates };
      }
      const candidates =
        active && parts
          ? day(active, false, mention.date)
              .filter((entry) => labelName(entry.subject.name) === parts.name)
              .sort(
                (a, b) => Number(sameClass(parts, b.subject)) - Number(sameClass(parts, a.subject)),
              )
          : [];
      return { kind: "broken", candidates };
    },
  };
}

// Links whose class changed with a profile change (an edit, a catalog
// update, a deletion): `before` and `after` are the profiles around it.
// A link to every Termin of a class (bound or not) looks for the class
// alone (any time, any date) and follows it as a class.
// A link to the class in the profile edited (`relinkIn`) follows it where
// that is clear (the one subject that changed in its timetable, on the same
// date, at the same start or its only one that day), even when another
// profile still holds the class as it was. A link found somewhere before and
// nowhere after is counted `lost`. Switching off or another active profile
// changes nothing here: a link is looked for with every subject switched on.
export function followMentions(
  text: string,
  before: readonly Profile[],
  after: readonly Profile[],
  dates: SemesterDates | null,
  relinkIn: ProfileName | null,
): { text: string; moved: number; lost: number } {
  const dayBefore = dayLookup(dates);
  const dayAfter = dayLookup(dates);
  const find = (
    profile: Profile | undefined,
    day: ReturnType<typeof dayLookup>,
    mention: OneTarget,
  ) =>
    profile
      ? day(profile, true, mention.date).find((one) => mentionMatches(mention, one))
      : undefined;
  const anywhere = (
    profiles: readonly Profile[],
    day: ReturnType<typeof dayLookup>,
    mention: OneTarget,
  ) => profiles.some((profile) => find(profile, day, mention));
  const editedBefore = before.find((profile) => profile.name === relinkIn);
  const editedAfter = after.find((profile) => profile.name === relinkIn);
  let next = text;
  let moved = 0;
  let lost = 0;
  const replace = (mention: Mention, token: string) => {
    next = next.slice(0, mention.start) + token + next.slice(mention.start + mention.text.length);
    moved++;
  };
  // From the end, so the offsets before each link still hold.
  for (const mention of mentionsOfText(text).reverse()) {
    if (!isOne(mention)) {
      const was = classIn(editedBefore, mention.label);
      if (editedBefore && editedAfter && was && !classIn(editedAfter, mention.label)) {
        const successor = followedClass(was, editedAfter);
        if (successor) {
          replace(mention, withLabel(mention, labelLike(labelParts(mention.label)!, successor)));
          continue;
        }
      }
      const somewhere = (profiles: readonly Profile[]) =>
        profiles.some((profile) => classIn(profile, mention.label));
      if (somewhere(before) && !somewhere(after)) lost++;
      continue;
    }
    const was = find(editedBefore, dayBefore, mention);
    if (editedBefore && editedAfter && was && !find(editedAfter, dayAfter, mention)) {
      const successor = followed(editedBefore, was, editedAfter, dayAfter, mention);
      if (successor) {
        replace(mention, mentionToken(successor));
        continue;
      }
    }
    if (anywhere(before, dayBefore, mention) && !anywhere(after, dayAfter, mention)) lost++;
  }
  return { text: next, moved, lost };
}

// Where a class a label names is in a profile, switched off or not.
function classIn(
  profile: Profile | undefined,
  label: string,
): { timetable: Timetable; index: number } | null {
  const parts = labelParts(label);
  if (!profile || !parts) return null;
  for (const timetable of profile.timetables) {
    const index = timetable.subjects.toSubjects().findIndex((subject) => fits(parts, subject));
    if (index !== -1) return { timetable, index };
  }
  return null;
}

// The subject a class became in its profile after the change.
function followedClass(
  was: { timetable: Timetable; index: number },
  after: Profile,
): Subject | null {
  const now = after.timetables.find((one) => one.name === was.timetable.name);
  if (!now) return null;
  const subjects = now.subjects.toSubjects();
  const index = successorIndex(was.timetable.subjects.toSubjects(), subjects, was.index);
  return index === null ? null : subjects[index];
}

// The block a link's class became in its profile after the change.
function followed(
  before: Profile,
  was: Entry,
  after: Profile,
  day: ReturnType<typeof dayLookup>,
  mention: OneTarget,
): Entry | null {
  const name = was.timetableName;
  const old = before.timetables.find((one) => one.name === name);
  const now = after.timetables.find((one) => one.name === name);
  if (!old || !now) return null;
  const index = successorIndex(old.subjects.toSubjects(), now.subjects.toSubjects(), was.index);
  if (index === null) return null;
  const blocks = day(after, true, mention.date).filter(
    (entry) => entry.timetableName === name && entry.index === index,
  );
  return (
    blocks.find((entry) => formatTime(entry.meeting.startTime) === mention.time) ??
    (blocks.length === 1 ? blocks[0] : null)
  );
}

// Where the subject at `index` went: every subject equal on both sides pairs
// up; if what is left is this one and exactly one new subject, that is it.
// Anything less clear (several changed at once) follows nothing.
export function successorIndex(
  before: readonly Subject[],
  after: readonly Subject[],
  index: number,
): number | null {
  const taken = new Set<number>();
  const unmatched: number[] = [];
  before.forEach((subject, i) => {
    const j = after.findIndex((other, k) => !taken.has(k) && sameSubject(subject, other));
    if (j === -1) unmatched.push(i);
    else taken.add(j);
  });
  const fresh = after.map((_, k) => k).filter((k) => !taken.has(k));
  return unmatched.length === 1 && unmatched[0] === index && fresh.length === 1 ? fresh[0] : null;
}

// One class at one weekday and time with every date it meets on: a row of
// the Termin picker.
export type Series = {
  key: string;
  // The first of its blocks: name, kinds, group, weekday, time.
  entry: Entry;
  dates: Entry[];
};

// The days the picker offers: the lecture period, widened to every listed
// date of the profile (exams); without dates eight weeks back and half a
// year on.
export function pickerRange(
  timetables: readonly Timetable[],
  dates: SemesterDates | null,
  today: Date,
): DateRange {
  const lecture = lectureRange(dates);
  let start = lecture?.start ?? addWeeks(today, -8);
  let end = lecture?.end ?? addWeeks(today, 26);
  for (const timetable of timetables) {
    for (const { subject } of enabledSubjects(timetable)) {
      if (subject.repeat.type !== "I") continue;
      for (const { date } of subject.repeat.dates) {
        const day = parseISO(date);
        if (day < start) start = day;
        if (day > end) end = day;
      }
    }
  }
  return { start, end };
}

// Every class of the profile's grid in `range`, by weekday and time, each
// with its dates in order.
export function seriesIn(
  timetables: readonly Timetable[],
  dates: SemesterDates | null,
  range: DateRange,
): Series[] {
  const found = new Map<string, Series>();
  for (
    let week = startOfISOWeek(range.start);
    !isAfter(week, range.end);
    week = addWeeks(week, 1)
  ) {
    for (const entry of weekEntries(timetables, week, eventsForWeek(dates, week))) {
      const { date, day, startTime } = entry.meeting;
      if (date === null) continue;
      const key = `${entry.timetableName}/${entry.index}/${day}/${formatTime(startTime)}`;
      const series = found.get(key);
      if (series) series.dates.push(entry);
      else found.set(key, { key, entry, dates: [entry] });
    }
  }
  return [...found.values()].sort(
    (a, b) =>
      DAYS.indexOf(a.entry.meeting.day) - DAYS.indexOf(b.entry.meeting.day) ||
      minutesOf(a.entry.meeting.startTime) - minutesOf(b.entry.meeting.startTime) ||
      a.entry.subject.name.localeCompare(b.entry.subject.name),
  );
}

// What the picker's field narrows by: words (name, kind, group, room, …)
// and at most one day: a date ("9.11", "9.11.2026"), "heute" / "today",
// "morgen" / "tomorrow", a weekday ("mi", "wed") or a calendar week
// ("kw46", "cw46").
export type MentionQuery = {
  words: string[];
  date: string | null;
  weekday: Day | null;
  week: number | null;
};

const WEEKDAYS: Record<string, Day> = {
  mo: Day.Monday,
  mon: Day.Monday,
  montag: Day.Monday,
  monday: Day.Monday,
  di: Day.Tuesday,
  tue: Day.Tuesday,
  dienstag: Day.Tuesday,
  tuesday: Day.Tuesday,
  mi: Day.Wednesday,
  wed: Day.Wednesday,
  mittwoch: Day.Wednesday,
  wednesday: Day.Wednesday,
  do: Day.Thursday,
  thu: Day.Thursday,
  donnerstag: Day.Thursday,
  thursday: Day.Thursday,
  fr: Day.Friday,
  fri: Day.Friday,
  freitag: Day.Friday,
  friday: Day.Friday,
};

export function parseMentionQuery(query: string, today: Date): MentionQuery {
  const parsed: MentionQuery = { words: [], date: null, weekday: null, week: null };
  for (const token of query.toLowerCase().split(/\s+/).filter(Boolean)) {
    const date = /^(\d{1,2})\.(\d{1,2})\.?(\d{4})?$/.exec(token);
    const week = /^(?:kw|cw)(\d{1,2})$/.exec(token);
    if (date) {
      const day = Number(date[1]);
      const month = Number(date[2]) - 1;
      parsed.date = isoDay(
        date[3] ? new Date(Number(date[3]), month, day) : nearestDate(today, month, day),
      );
    } else if (token === "heute" || token === "today") {
      parsed.date = isoDay(today);
    } else if (token === "morgen" || token === "tomorrow") {
      parsed.date = isoDay(addDays(today, 1));
    } else if (week) {
      parsed.week = Number(week[1]);
    } else if (token in WEEKDAYS) {
      parsed.weekday = WEEKDAYS[token];
    } else {
      parsed.words.push(token);
    }
  }
  return parsed;
}

// "9.11" without a year: the 9.11. closest to today (last year's in
// January, next year's in December).
function nearestDate(today: Date, month: number, day: number): Date {
  const year = today.getFullYear();
  return [year - 1, year, year + 1]
    .map((one) => new Date(one, month, day))
    .reduce((best, one) =>
      Math.abs(one.getTime() - today.getTime()) < Math.abs(best.getTime() - today.getTime())
        ? one
        : best,
    );
}

export type PickerRow = {
  series: Series;
  // The block a press links to: its next date, or the date the query named.
  entry: Entry;
  // The query named a day or a week: the row stands for that one date.
  exact: boolean;
};

// The picker's rows for `query`: a row per class whose words match, linking
// to its next date (today included); with a day or week in the query, a row
// per date of it instead. `haystack` gives what a class's words are matched
// against (names, kinds in the UI's language, group, room).
export function pickerRows(
  series: readonly Series[],
  query: MentionQuery,
  haystack: (entry: Entry) => string,
  today: Date,
): PickerRow[] {
  const matching = series.filter((one) => {
    const text = haystack(one.entry).toLowerCase();
    return query.words.every((word) => text.includes(word));
  });
  const from = isoDay(today);
  if (query.date !== null || query.week !== null) {
    return matching.flatMap((one) =>
      one.dates
        .filter(({ meeting }) =>
          query.date !== null
            ? meeting.date === query.date
            : isoWeek(parseISO(meeting.date!)) === query.week &&
              (query.weekday === null || meeting.day === query.weekday),
        )
        .map((entry) => ({ series: one, entry, exact: true })),
    );
  }
  return matching
    .filter((one) => query.weekday === null || one.entry.meeting.day === query.weekday)
    .map((one) => ({
      series: one,
      entry: one.dates.find(({ meeting }) => meeting.date! >= from) ?? one.dates.at(-1)!,
      exact: false,
    }));
}

// A row of the picker's "Every date": a class (as its label names it, so
// a lecture and its exam are one) with every weekday and time it meets at,
// linked as a whole.
export type ClassRow = {
  key: string;
  // The class's next block (today's included), else its last.
  entry: Entry;
  series: Series[];
  count: number;
};

// The picker's rows for "Every date": a row per class whose words match (a
// weekday in the query: classes meeting that day); dates and weeks in the
// query narrow nothing, the link names none.
export function classRows(
  series: readonly Series[],
  query: MentionQuery,
  haystack: (entry: Entry) => string,
  today: Date,
): ClassRow[] {
  const found = new Map<string, Series[]>();
  for (const one of series) {
    const key = mentionLabel(one.entry.subject);
    found.set(key, [...(found.get(key) ?? []), one]);
  }
  return [...found]
    .filter(([, all]) => {
      const text = haystack(all[0].entry).toLowerCase();
      return (
        query.words.every((word) => text.includes(word)) &&
        (query.weekday === null || all.some((one) => one.entry.meeting.day === query.weekday))
      );
    })
    .map(([key, all]) => {
      const dates = all.flatMap((one) => one.dates).sort(byDate);
      return { key, entry: nextOf(dates, today)!, series: all, count: dates.length };
    });
}

// Whether a date lies before today: past Termine are struck through.
export function isPast(date: string, today: Date): boolean {
  return date < isoDay(today);
}

// The weekday of an ISO date, for the grid's day.
export function dayOfDate(date: string): Day {
  return dayOf(parseISO(date));
}
