import { addDays, parseISO } from "date-fns";
import {
  Day,
  formatTime,
  getSubjectID,
  Kind,
  kindLabel,
  type DegreeProgram,
  type Repeat,
  type RepeatType,
  type Subject,
  type Time,
} from "@/lib/primitives/subject";
import { getLocale, localized, m } from "@/i18n";
import { DAYS } from "@/lib/primitives/week";
import {
  degreeTableOf,
  infoEntry,
  splitVariant,
  type DegreeTable,
  type Overrides,
} from "@/lib/primitives/overrides";

// The full name of a subject in the active locale, or the shortcut itself when
// its degree file does not know it.
export function subjectName(
  name: string,
  degreeProgram: DegreeProgram | undefined,
  tables: Overrides["degrees"],
): string {
  const table = degreeTableOf(degreeProgram, tables);
  return table ? nameIn(name, table) : name;
}

// A variant ("TEG/B") spells out the part in front of it and keeps the
// variant as it is.
function nameIn(name: string, table: DegreeTable): string {
  const entry = infoEntry(name, table);
  if (entry) return localized(entry.name);
  const split = splitVariant(name);
  return split ? `${nameIn(split[0], table)} / ${split[1]}` : name;
}

// "SU" -> "Lecture" / "Vorlesung". Kind codes stay in the block; only the
// details popup spells them out.
export function kindName(kind: Kind): string {
  switch (kind) {
    case Kind.Lecture:
      return m.kind_lecture();
    case Kind.Laboratory:
      return m.kind_laboratory();
    case Kind.Exercise:
      return m.kind_exercise();
    case Kind.Tutorial:
      return m.kind_tutorial();
    case Kind.Seminar:
      return m.kind_seminar();
    case Kind.Elective:
      return m.kind_elective();
  }
}

// Every kind of a subject, spelled out, in file order.
export function kindNames(kinds: Kind[]): string {
  return kinds.map(kindName).join(", ");
}

// "Mon", "Tue", … The grid's day header, the picker rows and anything else that
// names a day go through this.
export function dayName(day: Day): string {
  switch (day) {
    case Day.Monday:
      return m.day_monday();
    case Day.Tuesday:
      return m.day_tuesday();
    case Day.Wednesday:
      return m.day_wednesday();
    case Day.Thursday:
      return m.day_thursday();
    case Day.Friday:
      return m.day_friday();
    case Day.other:
      return m.grid_other();
  }
}

export function timeRangeLabel(slot: { startTime: Time; endTime: Time }): string {
  return `${formatTime(slot.startTime)}–${formatTime(slot.endTime)}`;
}

// "Mon, 5.10." / "Mo., 5.10.": one listed date (ISO YYYY-MM-DD).
export function dateLabel(date: string): string {
  return new Intl.DateTimeFormat(getLocale(), {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  }).format(parseISO(date));
}

// "21.10." / "10/21": a weekday's date in the week view.
export function shortDate(date: Date, withMonth = true): string {
  return new Intl.DateTimeFormat(
    getLocale(),
    withMonth ? { day: "numeric", month: "numeric" } : { day: "numeric" },
  ).format(date);
}

// The date of a weekday in the week starting on Monday `weekStart`.
export function dateOf(weekStart: Date, day: Day): Date {
  return addDays(weekStart, DAYS.indexOf(day));
}

// "09:45": when a class starts, where the end goes without saying (the
// category view's rows).
export function slotShort(slot: { startTime: Time }): string {
  return formatTime(slot.startTime);
}

// "Mon 08:00-09:30". A class can be listed more than once in the same group
// (duplicate SubjectID), so the picker needs this to tell the rows apart.
export function slotLabel(slot: { day: Day; startTime: Time; endTime: Time }): string {
  return `${dayName(slot.day)} ${timeRangeLabel(slot)}`;
}

// When a subject meets, in one line: its weekly slot, its one date with the
// time, or how many dates it has.
export function repeatLabel(repeat: Repeat): string {
  if (repeat.type !== "I") return slotLabel(repeat);
  if (repeat.dates.length > 1) return m.slot_dates({ count: repeat.dates.length });
  const [only] = repeat.dates;
  return `${dateLabel(only.date)} ${timeRangeLabel(only)}`;
}

// "M1 (SU)": one subject in the class picker and in warnings.
export function subjectLabel(subject: Subject): string {
  return `${subject.name} (${kindLabel(subject.kind)})`;
}

// "M1:SU:2.1 · Mon 08:00-09:30": one subject in the update dialog's diff. The
// slot tells apart a class listed more than once.
export function classLabel(subject: Subject): string {
  return `${getSubjectID(subject)} · ${repeatLabel(subject.repeat)}`;
}

// Every rhythm by name, weekly and listed dates included: the subject
// editor's choice of rhythm.
export function repeatTypeName(type: RepeatType): string {
  switch (type) {
    case "A":
      return m.repeat_weekly();
    case "I":
      return m.repeat_dates();
    case "G":
      return m.repeat_even();
    case "U":
      return m.repeat_odd();
    case "SH1":
      return m.repeat_first_half();
    case "SH2":
      return m.repeat_second_half();
    case "G1":
      return m.repeat_even_first();
    case "G2":
      return m.repeat_even_second();
    case "U1":
      return m.repeat_odd_first();
    case "U2":
      return m.repeat_odd_second();
  }
}

// The repeat rhythm spelled out instead of the letter code, for the details
// popup and the ICS description. Weekly ("A") is the default rhythm and says
// nothing, listed dates speak for themselves: neither has a label.
export function repeatName(repeat: Repeat): string | null {
  if (repeat.type === "A" || repeat.type === "I") return null;
  return repeatTypeName(repeat.type);
}

// The rhythm a block names in the general view, where its week is not given:
// "even weeks" / "odd weeks", the code of the four-week rhythms and the
// halves. Weekly and listed dates say nothing.
export function rhythmShort(repeat: Repeat): string | null {
  switch (repeat.type) {
    case "A":
    case "I":
      return null;
    case "G":
      return m.rhythm_even();
    case "U":
      return m.rhythm_odd();
    default:
      return repeat.type;
  }
}
