import { addDays, addWeeks, isAfter, parseISO, startOfISOWeek } from "date-fns";
import { groupName } from "@/lib/primitives/group";
import type { SemesterDates } from "@/lib/primitives/meta";
import { lectureRange, type DateRange } from "@/lib/primitives/occurrence";
import { Day, formatTime, minutesOf, shortHash, type Subject } from "@/lib/primitives/subject";
import { enabledSubjects, type Timetable } from "@/lib/primitives/timetable";
import { DAYS, dayOf, eventsForWeek, isoDay, isoWeek, type Meeting } from "@/lib/primitives/week";
import { weekEntries, type Entry } from "@/lib/layout";
import { notesLines, type NotesLine, type NotesPiece } from "@/lib/notes";

// Links from the notes to a Termin: `@[date#hash label]`. The date says which
// day, the hash which of that day's Termine; the label is only what the link
// shows once its Termin is gone (red, never guessed back). Plain text in
// `tt.notes.v1`, so the notes stay a string.

// What the hash covers: the class (name, kinds, group, degree program) and
// when it starts. Room, professor and end time are left out: a room change
// keeps the link; another start time, group or name breaks it (red).
export function termHash(subject: Subject, meeting: Pick<Meeting, "startTime">): string {
  return shortHash([
    subject.name,
    subject.kind,
    subject.group ? groupName(subject.group) : null,
    subject.degreeProgram ?? null,
    formatTime(meeting.startTime),
  ]);
}

// "MA3 SU,Ue 1.1": what a link names, readable in the text area.
export function mentionLabel(subject: Subject): string {
  return [subject.name, subject.kind.join(","), subject.group ? groupName(subject.group) : null]
    .filter((part) => part !== null)
    .join(" ")
    .replace(/[\]\n]/g, " ");
}

// The text a link to this Termin on its date is written as.
export function mentionToken(entry: Entry): string {
  return `@[${entry.meeting.date}#${termHash(entry.subject, entry.meeting)} ${mentionLabel(entry.subject)}]`;
}

// What a link points at: a date and a hash.
export type MentionTarget = { date: string; hash: string };

// Whether the link points at this block: its date and its hash.
export function mentionMatches(
  mention: MentionTarget,
  entry: Pick<Entry, "subject" | "meeting">,
): boolean {
  return (
    entry.meeting.date === mention.date && termHash(entry.subject, entry.meeting) === mention.hash
  );
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

// Finds the block a link points at, one week of the profile's grid at a
// time, each week built once.
export function mentionResolver(
  timetables: readonly Timetable[],
  dates: SemesterDates | null,
): {
  entry: (mention: MentionTarget) => Entry | null;
  // The blocks on that date, for "Link again" on a red link.
  onDate: (date: string) => Entry[];
} {
  const weeks = new Map<number, Entry[]>();
  const onDate = (date: string) => {
    const day = parseISO(date);
    if (Number.isNaN(day.getTime())) return [];
    const start = startOfISOWeek(day);
    let entries = weeks.get(start.getTime());
    if (!entries) {
      entries = weekEntries(timetables, start, eventsForWeek(dates, start));
      weeks.set(start.getTime(), entries);
    }
    return entries.filter((entry) => entry.meeting.date === date);
  };
  return {
    entry: (mention) =>
      onDate(mention.date).find((entry) => mentionMatches(mention, entry)) ?? null,
    onDate,
  };
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

// Whether a date lies before today: past Termine are struck through.
export function isPast(date: string, today: Date): boolean {
  return date < isoDay(today);
}

// The weekday of an ISO date, for the grid's day.
export function dayOfDate(date: string): Day {
  return dayOf(parseISO(date));
}
