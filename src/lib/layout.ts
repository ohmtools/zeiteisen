import { serialize } from "ohash";
import { Day, minutesOf, type Subject, type Time } from "@/lib/primitives/subject";
import { enabledSubjects, type Timetable, type TimetableName } from "@/lib/primitives/timetable";
import {
  compareMeetings,
  DAYS,
  generalColumn,
  meetingsInWeek,
  meetingsOf,
  type Meeting,
  type WeekEvents,
} from "@/lib/primitives/week";
import { tintSteps } from "@/lib/tint";

// One block of the grid: a meeting of an enabled subject plus the timetable it
// sits in. `index` addresses the subject in that timetable's `Subjects` (a
// `SubjectID` may repeat inside one file), and `key` joins it with the
// timetable's name, unique inside the profile, and the meeting — the React key
// of a block. `timetableName` also drives labels.
export type Entry = {
  key: string;
  timetableName: TimetableName;
  // Its timetable's step from `tintSteps` over the whole profile.
  tint: number;
  index: number;
  subject: Subject;
  // The column the block sits in; differs from `meeting.day` where the
  // general grid moves a subject to `other` (`generalColumn`).
  day: Day;
  // Time, room and professor the block shows.
  meeting: Meeting;
  // The listed dates the block stands for, sorted; empty for a weekly rhythm.
  dates: string[];
};

type Enabled = { timetableName: TimetableName; tint: number; index: number; subject: Subject };

// The enabled subjects of every timetable of the profile. The tint counts every
// timetable, not only those with enabled subjects, so it matches the tree.
function enabledOf(timetables: readonly Timetable[]): Enabled[] {
  const tints = tintSteps(timetables.map((timetable) => timetable.name));
  return timetables.flatMap((timetable) =>
    enabledSubjects(timetable).map((one) => ({
      timetableName: timetable.name,
      tint: tints.get(timetable.name) ?? 0,
      ...one,
    })),
  );
}

function entryOf(
  { timetableName, tint, index, subject }: Enabled,
  n: number,
  day: Day,
  meeting: Meeting,
  dates: string[],
): Entry {
  return {
    key: `${timetableName}/${index}/${n}`,
    timetableName,
    tint,
    index,
    subject,
    day,
    meeting,
    dates,
  };
}

// The general grid (no week picked). A weekly subject is one block; listed
// dates sharing time, room and professor are one block standing for all of
// them, so a subject with ten identical dates does not fill `other` ten times.
export function generalEntries(timetables: readonly Timetable[]): Entry[] {
  return enabledOf(timetables).flatMap((enabled) => {
    const { repeat } = enabled.subject;
    const day = generalColumn(repeat);
    if (repeat.type !== "I") {
      return [entryOf(enabled, 0, day, meetingsOf(repeat)[0], [])];
    }
    const same = new Map<string, { meeting: Meeting; dates: string[] }>();
    for (const meeting of meetingsOf(repeat)) {
      const { professor, location, startTime, endTime, date } = meeting;
      const key = serialize({ professor, location, startTime, endTime });
      const group = same.get(key) ?? { meeting, dates: [] };
      if (date !== null) group.dates.push(date);
      same.set(key, group);
    }
    return [...same.values()].map(({ meeting, dates }, n) =>
      entryOf(enabled, n, day, meeting, dates),
    );
  });
}

// The current-week grid: one block per meeting in the week, in its own column.
export function weekEntries(
  timetables: readonly Timetable[],
  week: number,
  weekStart: Date,
  events: WeekEvents,
): Entry[] {
  return enabledOf(timetables).flatMap((enabled) => {
    const { repeat } = enabled.subject;
    return meetingsInWeek(repeat, week, weekStart, events).map((meeting, n) =>
      entryOf(
        enabled,
        n,
        meeting.day,
        meeting,
        repeat.type === "I" && meeting.date !== null ? [meeting.date] : [],
      ),
    );
  });
}

// The grid always covers 8:00-20:00. A meeting reaching outside it goes to the
// `other` list instead of stretching the grid.
export const FIRST_HOUR = 8;
export const LAST_HOUR = 20;

export function isOutsideHours(slot: { startTime: Time; endTime: Time }): boolean {
  return minutesOf(slot.startTime) < FIRST_HOUR * 60 || minutesOf(slot.endTime) > LAST_HOUR * 60;
}

// Overlapping subjects (different groups at the same time) share the width of
// their day column: `lane` of `lanes` side by side.
export type Placed = { entry: Entry; lane: number; lanes: number };

export function layoutDay(entries: Entry[]): Placed[] {
  const sorted = [...entries].sort(
    (a, b) =>
      minutesOf(a.meeting.startTime) - minutesOf(b.meeting.startTime) ||
      minutesOf(b.meeting.endTime) - minutesOf(a.meeting.endTime),
  );

  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const p of cluster) p.lanes = laneEnds.length;
    placed.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const entry of sorted) {
    const start = minutesOf(entry.meeting.startTime);
    const end = Math.max(minutesOf(entry.meeting.endTime), start + 15);
    if (start >= clusterEnd) flush();

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = end;
    clusterEnd = Math.max(clusterEnd, end);
    cluster.push({ entry, lane, lanes: 1 });
  }
  flush();

  return placed;
}

// Mon-Fri: the columns of the hour grid.
export const WEEKDAYS: readonly Day[] = DAYS.filter((day) => day !== Day.other);

function inList(entry: Entry): boolean {
  return entry.day === Day.other || isOutsideHours(entry.meeting);
}

// The hour grid per weekday, laid out in lanes, and the `other` list: every
// block the grid cannot hold (`other` column, outside the grid hours), from
// what happens first to what happens last — weekday, then date (Saturday
// before Sunday), then time.
export function byDay(entries: Entry[]): { grid: Record<Day, Placed[]>; list: Entry[] } {
  const grid = {} as Record<Day, Placed[]>;
  for (const day of WEEKDAYS) {
    grid[day] = layoutDay(entries.filter((e) => e.day === day && !inList(e)));
  }
  const list = entries.filter(inList).sort((a, b) => compareMeetings(a.meeting, b.meeting));
  return { grid, list };
}
