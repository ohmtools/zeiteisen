import { serialize } from "ohash";
import {
  Day,
  Kind,
  minutesOf,
  type Repeat,
  type Subject,
  type Time,
} from "@/lib/primitives/subject";
import { enabledSubjects, type Timetable, type TimetableName } from "@/lib/primitives/timetable";
import { addWeeks } from "date-fns";
import type { SemesterDates } from "@/lib/primitives/meta";
import {
  compareMeetings,
  DAYS,
  eventsForWeek,
  generalColumn,
  meetingsInWeek,
  meetingsOf,
  type Meeting,
  type WeekEvents,
} from "@/lib/primitives/week";

// One block of the grid: a meeting of an enabled subject plus the timetable it
// sits in. `index` addresses the subject in that timetable's `Subjects` (a
// `SubjectID` may repeat inside one file), and `key` joins it with the
// timetable's name, unique inside the profile, and the meeting — the React key
// of a block. `timetableName` also drives labels.
export type Entry = {
  key: string;
  timetableName: TimetableName;
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

type Enabled = { timetableName: TimetableName; index: number; subject: Subject };

// The enabled subjects of every timetable of the profile.
function enabledOf(timetables: readonly Timetable[]): Enabled[] {
  return timetables.flatMap((timetable) =>
    enabledSubjects(timetable).map((one) => ({ timetableName: timetable.name, ...one })),
  );
}

function entryOf(
  { timetableName, index, subject }: Enabled,
  n: number,
  day: Day,
  meeting: Meeting,
  dates: string[],
): Entry {
  return {
    key: `${timetableName}/${index}/${n}`,
    timetableName,
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
  weekStart: Date,
  events: WeekEvents,
): Entry[] {
  return enabledOf(timetables).flatMap((enabled) => {
    const { repeat } = enabled.subject;
    return meetingsInWeek(repeat, weekStart, events).map((meeting, n) =>
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

// The general view's filter: every week, or only the even (G) or odd (U) ISO
// weeks. Session state, not persisted.
export const WEEK_FILTERS = ["all", "even", "odd"] as const;
export type WeekFilter = (typeof WEEK_FILTERS)[number];

// Whether a subject shows under the filter. It filters G and U only (user
// decision): the four-week rhythms G1, G2, U1 and U2 stay, showing their code,
// and so does everything else.
export function weekFilterMatches(repeat: Repeat, filter: WeekFilter): boolean {
  if (filter === "even") return repeat.type !== "U";
  if (filter === "odd") return repeat.type !== "G";
  return true;
}

// A week without classes says where the next ones are: the first week after
// `weekStart` (up to a year on) with any, and its first meeting. Only asked for
// a week that is empty, so the walk never runs on a normal render.
export function nextWeekWithEntries(
  timetables: readonly Timetable[],
  dates: SemesterDates | null,
  weekStart: Date,
): { start: Date; first: Meeting } | null {
  for (let n = 1; n <= 52; n++) {
    const start = addWeeks(weekStart, n);
    const entries = weekEntries(timetables, start, eventsForWeek(dates, start));
    if (entries.length > 0) {
      const first = entries.map((entry) => entry.meeting).sort(compareMeetings)[0];
      return { start, first };
    }
  }
  return null;
}

// The grid always covers 8:00-19:00 (user decision, was 20:00: nothing
// starts after the last block at 17:30). A meeting reaching outside it goes
// to the `other` column instead of stretching the grid.
export const FIRST_HOUR = 8;
export const LAST_HOUR = 19;

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

// The kind a block is coloured by: the most specific of its kinds (user
// decision), laboratory before exercise before tutorial before seminar before
// elective before lecture. The kinds stay written in the block, so colour is
// never the only cue.
const KIND_PRIORITY: readonly Kind[] = [
  Kind.Laboratory,
  Kind.Exercise,
  Kind.Tutorial,
  Kind.Seminar,
  Kind.Elective,
  Kind.Lecture,
];

export function colourKind(kinds: readonly Kind[]): Kind {
  return KIND_PRIORITY.find((kind) => kinds.includes(kind)) ?? Kind.Lecture;
}

// No lane is narrower than this (user decision, CSS px): a subject code is
// never cut or broken inside, so what does not fit is gathered.
export const MIN_LANE_PX = 48;

// A day column as it is drawn: blocks in their lanes, and where the column is
// too narrow for every lane, collected blocks in the last lane that fits.
export type Shown =
  | { kind: "block"; entry: Entry; lane: number; lanes: number }
  | {
      kind: "collected";
      key: string;
      entries: Entry[];
      lane: number;
      lanes: number;
      // The span the collected blocks cover together, in minutes of the day.
      start: number;
      end: number;
    };

// Puts a laid out day (`layoutDay`) into a column `width` px wide. A cluster
// that needs more lanes than fit keeps its first lanes but the last one, and
// gathers what lies in the rest into that last lane: one collected block per
// stretch of overlapping times there, a lone block staying itself.
export function fitDay(placed: readonly Placed[], width: number): Shown[] {
  const fits = Math.max(1, Math.floor(width / MIN_LANE_PX));
  const shown: Shown[] = [];
  const clusters = new Map<number, Placed[]>();
  // `layoutDay` gives one cluster the same `lanes`, consecutively.
  let cluster: Placed[] = [];
  let id = 0;
  const flush = () => {
    if (cluster.length) clusters.set(id++, cluster);
    cluster = [];
  };
  let end = -Infinity;
  for (const one of placed) {
    const start = minutesOf(one.entry.meeting.startTime);
    if (start >= end) flush();
    cluster.push(one);
    end = Math.max(end, minutesOf(one.entry.meeting.endTime), start + 15);
  }
  flush();

  for (const members of clusters.values()) {
    const lanes = members[0].lanes;
    if (lanes <= fits) {
      for (const { entry, lane } of members) shown.push({ kind: "block", entry, lane, lanes });
      continue;
    }
    const last = fits - 1;
    for (const { entry, lane } of members) {
      if (lane < last) shown.push({ kind: "block", entry, lane, lanes: fits });
    }
    const rest = members
      .filter(({ lane }) => lane >= last)
      .map(({ entry }) => entry)
      .sort((a, b) => minutesOf(a.meeting.startTime) - minutesOf(b.meeting.startTime));
    let group: Entry[] = [];
    let groupStart = 0;
    let groupEnd = -Infinity;
    const close = () => {
      if (group.length === 1) {
        shown.push({ kind: "block", entry: group[0], lane: last, lanes: fits });
      } else if (group.length > 1) {
        shown.push({
          kind: "collected",
          key: group.map((entry) => entry.key).join("+"),
          entries: group,
          lane: last,
          lanes: fits,
          start: groupStart,
          end: groupEnd,
        });
      }
      group = [];
    };
    for (const entry of rest) {
      const start = minutesOf(entry.meeting.startTime);
      const stop = Math.max(minutesOf(entry.meeting.endTime), start + 15);
      if (start >= groupEnd) {
        close();
        groupStart = start;
        groupEnd = stop;
      } else {
        groupEnd = Math.max(groupEnd, stop);
      }
      group.push(entry);
    }
    close();
  }
  return shown;
}
