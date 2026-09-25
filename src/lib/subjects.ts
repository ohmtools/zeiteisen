import { parseISO } from "date-fns";
import {
  Day,
  getSubjectID,
  Kind,
  kindLabel,
  type Repeat,
  type RepeatType,
  type Subject,
  type Time,
} from "@/lib/primitives/subject";
import { getLocale, m } from "@/i18n";
import { abbreviationOverride } from "@/lib/overrides";

// The full name of a subject in the active locale, or the shortcut itself when
// no catalog knows it. The table lives in the catalog
// (`abbreviations/*.json`), not in the app.
export function subjectName(name: string): string {
  const entry = abbreviationOverride(name);
  if (entry) return getLocale() === "de" ? entry.de : entry.en;
  // Some codes carry a variant behind a slash ("TEG/B"). The table is checked
  // for the whole code first, because keys like "CSEC1/1" contain a slash
  // themselves; only then the part in front of the last slash is spelled out
  // and the variant kept as it is.
  const cut = name.lastIndexOf("/");
  if (cut > 0 && cut < name.length - 1) {
    const head = subjectName(name.slice(0, cut));
    return `${head} / ${name.slice(cut + 1)}`;
  }
  return name;
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

export function timeLabel(time: Time): string {
  return String(time.hour).padStart(2, "0") + ":" + String(time.minute).padStart(2, "0");
}

export function timeRangeLabel(slot: { startTime: Time; endTime: Time }): string {
  return `${timeLabel(slot.startTime)}-${timeLabel(slot.endTime)}`;
}

// "Mon, 5.10." / "Mo., 5.10.": one listed date (ISO YYYY-MM-DD).
export function dateLabel(date: string): string {
  return new Intl.DateTimeFormat(getLocale(), {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  }).format(parseISO(date));
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
