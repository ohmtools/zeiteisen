import { addDays, format, parseISO } from "date-fns";
import { groupName, parseGroupName } from "@/lib/primitives/group";
import {
  Day,
  endsAfterStart,
  formatTime,
  isIsoDate,
  kindLabel,
  parseTime,
  subjectSchema,
  type Kind,
  type RepeatType,
  type Slot,
  type Subject,
} from "@/lib/primitives/subject";
import type { Timetable } from "@/lib/primitives/timetable";
import { meetingsOf } from "@/lib/primitives/week";

// The subject editor's form: everything as the inputs hold it (times "HH:MM",
// the group "2.1"), turned into a `Subject` by `subjectOfDraft` and checked
// against the primitives' schema. The weekly slot is kept while the draft lists
// dates (and the other way round), so switching the rhythm back and forth
// loses nothing; new dates start from it.

export type SlotDraft = {
  professor: string;
  location: string;
  start: string;
  end: string;
};

export type DatedDraft = SlotDraft & { date: string };

export type SubjectDraft = {
  name: string;
  kinds: Kind[];
  // The subject's degree file (its name), `""` = none.
  degreeProgram: string;
  group: string;
  onDemand: boolean;
  note: string;
  type: RepeatType;
  day: Day;
  slot: SlotDraft;
  dates: DatedDraft[];
};

// What stops a draft from becoming a subject, one code per broken field.
export type DraftProblem = "name" | "kinds" | "group" | "time" | "dates" | "date";

function slotDraft(slot: Slot): SlotDraft {
  return {
    professor: slot.professor,
    location: slot.location,
    start: formatTime(slot.startTime),
    end: formatTime(slot.endTime),
  };
}

const EMPTY_SLOT: SlotDraft = { professor: "", location: "", start: "", end: "" };

// The form for an existing subject, or an empty one for a new subject.
export function draftOf(subject?: Subject): SubjectDraft {
  if (!subject) {
    return {
      name: "",
      kinds: ["SU"],
      degreeProgram: "",
      group: "",
      onDemand: false,
      note: "",
      type: "A",
      day: Day.Monday,
      slot: EMPTY_SLOT,
      dates: [],
    };
  }
  const { repeat } = subject;
  const common = {
    name: subject.name,
    kinds: [...subject.kind],
    degreeProgram: subject.degreeProgram ?? "",
    group: subject.group ? groupName(subject.group) : "",
    onDemand: subject.onDemand,
    note: subject.note ?? "",
    type: repeat.type,
  };
  if (repeat.type === "I") {
    const dates = repeat.dates.map((dated) => ({ ...slotDraft(dated), date: dated.date }));
    const { date: _, ...last } = dates[dates.length - 1];
    return { ...common, day: Day.Monday, slot: last, dates };
  }
  return { ...common, day: repeat.day, slot: slotDraft(repeat), dates: [] };
}

function slotOf(draft: SlotDraft): Slot | null {
  const startTime = parseTime(draft.start);
  const endTime = parseTime(draft.end);
  if (!startTime || !endTime || !endsAfterStart({ startTime, endTime })) return null;
  return {
    professor: draft.professor.trim(),
    location: draft.location.trim(),
    startTime,
    endTime,
  };
}

export type DraftResult = { subject: Subject; problems: [] } | { problems: DraftProblem[] };

// The subject the form describes, in the very shape the schema stores (dates
// sorted and deduplicated), or every field that keeps it from being one.
export function subjectOfDraft(draft: SubjectDraft): DraftResult {
  const problems: DraftProblem[] = [];
  const name = draft.name.trim();
  if (!name) problems.push("name");
  if (draft.kinds.length === 0) problems.push("kinds");
  const group = draft.group.trim() ? parseGroupName(draft.group.trim()) : undefined;
  if (group === null) problems.push("group");

  let repeat: Subject["repeat"] | null = null;
  if (draft.type === "I") {
    if (draft.dates.length === 0) problems.push("dates");
    if (draft.dates.some((dated) => !isIsoDate(dated.date))) problems.push("date");
    const slots = draft.dates.map(slotOf);
    if (slots.some((slot) => slot === null)) problems.push("time");
    repeat = {
      type: "I",
      dates: draft.dates.map((dated, i) => ({ ...slots[i]!, date: dated.date })),
    };
  } else {
    const slot = slotOf(draft.slot);
    if (!slot) problems.push("time");
    else repeat = { type: draft.type, day: draft.day, ...slot };
  }
  if (problems.length > 0 || !repeat) return { problems };

  // Optional keys are left out rather than set to `undefined`: content
  // identity is `serialize`d, and a present `undefined` would tell two equal
  // subjects apart.
  const subject: Subject = { repeat, name, kind: draft.kinds, onDemand: draft.onDemand };
  if (draft.degreeProgram) subject.degreeProgram = draft.degreeProgram;
  if (group) subject.group = group;
  if (draft.note.trim()) subject.note = draft.note.trim();
  const parsed = subjectSchema.safeParse(subject);
  // The checks above cover the schema; this only guards against drifting
  // apart from it.
  if (!parsed.success) return { problems: ["date"] };
  return { subject: parsed.data, problems: [] };
}

// The next date of an irregular series: a week after the last one, with its
// time and room. Starts from the weekly slot when there is no date yet.
export function nextDate(draft: SubjectDraft, today: Date): DatedDraft {
  const last = draft.dates[draft.dates.length - 1];
  if (!last) return { ...draft.slot, date: format(today, "yyyy-MM-dd") };
  const base = isIsoDate(last.date) ? parseISO(last.date) : today;
  return { ...last, date: format(addDays(base, 7), "yyyy-MM-dd") };
}

// The dates picked in a calendar, each keeping its own time and room; a new
// one takes those of the last date (or the weekly slot). A date listed with
// several slots (a block course: 08:00 and 09:45 on one day) keeps them all:
// the calendar only knows the date.
export function withDates(draft: SubjectDraft, picked: readonly Date[]): DatedDraft[] {
  const wanted = [...new Set(picked.map((date) => format(date, "yyyy-MM-dd")))].sort();
  const template = draft.dates[draft.dates.length - 1] ?? draft.slot;
  return wanted.flatMap((date) => {
    const held = draft.dates.filter((dated) => dated.date === date);
    return held.length > 0 ? held : [{ ...template, date }];
  });
}

// What the editor suggests, learnt from every timetable on the device and the
// degree file the draft names. Most used first; professors and rooms that the same
// subject already uses come before all others.
export type Suggestions = {
  names: string[];
  groups: string[];
  professors: string[];
  locations: string[];
  // The time slots the university uses, by start time.
  slots: { start: string; end: string }[];
};

function byUse(counts: Map<string, number>, first: ReadonlySet<string> = new Set()): string[] {
  return [...counts.entries()]
    .filter(([value]) => value !== "")
    .sort(
      ([a, x], [b, y]) =>
        Number(first.has(b)) - Number(first.has(a)) || y - x || a.localeCompare(b),
    )
    .map(([value]) => value);
}

function count(counts: Map<string, number>, value: string) {
  counts.set(value, (counts.get(value) ?? 0) + 1);
}

// The university's 90-minute blocks, always offered: a block no timetable on
// the device uses yet (17:30-19:00) still has to be one click away.
const UNIVERSITY_SLOTS = [
  "08:00-09:30",
  "09:45-11:15",
  "11:30-13:00",
  "14:00-15:30",
  "15:45-17:15",
  "17:30-19:00",
];
// Further slots used at least this often (double blocks) join them.
const SLOT_MIN_USES = 3;
const SLOT_LIMIT = 8;

export function suggestionsFor(
  timetables: readonly Timetable[],
  current: { name: string; kinds: readonly Kind[] },
  // Every subject code the draft's degree file spells out.
  codes: readonly string[] = [],
): Suggestions {
  const names = new Map<string, number>();
  const groups = new Map<string, number>();
  const professors = new Map<string, number>();
  const locations = new Map<string, number>();
  const slots = new Map<string, number>();
  const ownGroups = new Set<string>();
  const ownPeople = new Set<string>();
  const ownRooms = new Set<string>();
  const key = current.name.trim() + ":" + kindLabel([...current.kinds]);

  for (const timetable of timetables) {
    for (const { subject } of timetable.subjects) {
      count(names, subject.name);
      const same = subject.name === current.name.trim();
      if (subject.group) {
        count(groups, groupName(subject.group));
        if (subject.name + ":" + kindLabel(subject.kind) === key) {
          ownGroups.add(groupName(subject.group));
        }
      }
      for (const slot of meetingsOf(subject.repeat)) {
        count(professors, slot.professor);
        count(locations, slot.location);
        count(slots, formatTime(slot.startTime) + "-" + formatTime(slot.endTime));
        if (same) {
          ownPeople.add(slot.professor);
          ownRooms.add(slot.location);
        }
      }
    }
  }
  for (const code of codes) if (!names.has(code)) names.set(code, 0);

  return {
    names: byUse(names),
    groups: byUse(groups, ownGroups),
    professors: byUse(professors, ownPeople),
    locations: byUse(locations, ownRooms),
    slots: [
      ...new Set([
        ...UNIVERSITY_SLOTS,
        ...[...slots.entries()]
          .filter(([slot, uses]) => uses >= SLOT_MIN_USES && !UNIVERSITY_SLOTS.includes(slot))
          .sort(([, x], [, y]) => y - x)
          .slice(0, SLOT_LIMIT)
          .map(([slot]) => slot),
      ]),
    ]
      .map((slot) => {
        const [start, end] = slot.split("-");
        return { start, end };
      })
      .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end)),
  };
}

// The end of the usual slot starting at `start`, if there is one: picking a
// start time fills in the matching end.
export function slotEnd(suggestions: Suggestions, start: string): string | null {
  return suggestions.slots.find((slot) => slot.start === start)?.end ?? null;
}
