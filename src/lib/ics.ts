import { createEvents, type EventAttributes } from "ics";
import { isAfter, isBefore, parseISO } from "date-fns";
import { m } from "@/i18n";
import { groupName } from "@/lib/primitives/group";
import type { SemesterDates } from "@/lib/primitives/meta";
import {
  occurrencesOf,
  wallClockInstant,
  type DateRange,
  type Occurrence,
} from "@/lib/primitives/occurrence";
import { Day, getSubjectID, kindLabel, shortHash, type Subject } from "@/lib/primitives/subject";
import { enabledSubjects, type Timetable } from "@/lib/primitives/timetable";
import type { Meeting } from "@/lib/primitives/week";
import { safeFilename } from "@/lib/download";
import { repeatName } from "@/lib/subjects";

// Calendar export, one file per profile: every occurrence becomes its own VEVENT. No
// `RRULE + EXDATE` — the repeat rules (`G1`, `U2`, …) have no RRULE
// equivalent, and the `noLectures` days would need an EXDATE list anyway.
// Which dates a subject is taught on comes from `occurrencesOf`, the same week
// rules the current-week view uses; this module only writes the file.

const PRODUCT_ID = "zeiteisen/ics";

function dateParts(date: Date): [number, number, number, number, number] {
  return [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
  ];
}

// DESCRIPTION carries what does not fit SUMMARY or LOCATION: group, professor
// and the repeat rhythm, one per line.
export function descriptionOf(subject: Subject, meeting: Meeting): string {
  return [
    subject.group ? m.subject_group({ group: groupName(subject.group) }) : null,
    meeting.professor || null,
    repeatName(subject.repeat),
  ]
    .filter(Boolean)
    .join("\n");
}

// A stable UID, so importing a fresh export again updates the events a
// calendar already holds instead of adding every one a second time. Built from
// what names one lecture: profile, timetable, the subject (`getSubjectID`, not
// its full content, so a changed room or lecturer updates the event), the date
// and the start time (`getSubjectID` is not unique: BEI3 lists `ELK1:SU:2.1`
// twice, on different slots).
export function uidOf(
  profileName: string,
  timetableName: string,
  { subject, meeting, date }: Occurrence,
): string {
  const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-");
  const { hour, minute } = meeting.startTime;
  return `${shortHash([profileName, timetableName, getSubjectID(subject), day, hour, minute])}@zeiteisen`;
}

export function eventOf(
  { subject, meeting, date }: Occurrence,
  timetableName: string,
  uid?: string,
): EventAttributes {
  const description = descriptionOf(subject, meeting);
  return {
    ...(uid ? { uid } : {}),
    // One file holds every timetable of the profile, so each entry names its
    // own: "M1 (SU) · BEI3".
    title: `${subject.name} (${kindLabel(subject.kind)}) · ${timetableName}`,
    start: dateParts(wallClockInstant(date, meeting.startTime)),
    end: dateParts(wallClockInstant(date, meeting.endTime)),
    // UTC instants in, UTC in the file: no VTIMEZONE block is needed and the
    // event still lands on the right wall-clock time in Europe/Berlin.
    startInputType: "utc",
    startOutputType: "utc",
    endInputType: "utc",
    endOutputType: "utc",
    ...(meeting.location ? { location: meeting.location } : {}),
    ...(description ? { description } : {}),
  };
}

// What an export over the lecture period covers: the period, stretched to
// every listed date of an enabled subject. A block seminar in the lecture-free
// weeks shows in its week (listed dates win over the period, `meetingsInWeek`),
// so it belongs in the file too. Weekly rhythms stay inside the period: the
// weeks the stretch adds lie outside it, where they never meet.
export function lectureExportRange(
  timetables: readonly Timetable[],
  lecture: DateRange,
): DateRange {
  let { start, end } = lecture;
  for (const timetable of timetables) {
    for (const { subject } of enabledSubjects(timetable)) {
      if (subject.repeat.type !== "I") continue;
      for (const { date } of subject.repeat.dates) {
        const day = parseISO(date);
        if (isBefore(day, start)) start = day;
        if (isAfter(day, end)) end = day;
      }
    }
  }
  return { start, end };
}

// Enabled weekly classes with no weekday: the university's "Block / n.V. /
// Samstag" column (`Day.other`). No date says when they meet, so no calendar
// entry can hold them; the export names them instead of dropping them in
// silence. Listed dates on a weekend have their date and are exported.
export function undatedClasses(timetables: readonly Timetable[]): Subject[] {
  return timetables.flatMap((timetable) =>
    enabledSubjects(timetable)
      .map(({ subject }) => subject)
      .filter(({ repeat }) => repeat.type !== "I" && repeat.day === Day.other),
  );
}

export type IcsFile = { filename: string; text: string; count: number };

// One file per profile, `{profileName}.ics`, calendar name = profile name,
// holding the enabled subjects of every timetable. `file` is null when
// nothing occurs in the range. Each week counts in its own semester, as in
// the week view.
export function icsFile(
  timetables: readonly Timetable[],
  dates: SemesterDates | null,
  range: DateRange,
  profileName: string,
): { file: IcsFile | null; error: string | null } {
  // Two occurrences may still name the same lecture (the same subject listed
  // twice with another room): the later one gets a counter.
  const used = new Map<string, number>();
  const events: EventAttributes[] = [];

  for (const timetable of timetables) {
    const enabled = enabledSubjects(timetable).map(({ subject }) => subject);
    for (const occurrence of occurrencesOf(enabled, range, dates)) {
      const uid = uidOf(profileName, timetable.name, occurrence);
      const seen = used.get(uid) ?? 0;
      used.set(uid, seen + 1);
      events.push(eventOf(occurrence, timetable.name, seen === 0 ? uid : `${seen}-${uid}`));
    }
  }
  if (events.length === 0) return { file: null, error: null };

  const { error, value } = createEvents(events, { productId: PRODUCT_ID, calName: profileName });
  if (error || !value) return { file: null, error: error?.message ?? profileName };
  return {
    file: { filename: `${safeFilename(profileName)}.ics`, text: value, count: events.length },
    error: null,
  };
}
