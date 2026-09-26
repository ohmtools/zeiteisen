import { Catalog, type CatalogEntry, type FetchJson } from "./catalog";
import type { Profile } from "./profile";
import {
  Subjects,
  subjectsHash,
  type Day,
  type Repeat,
  type Slot,
  type Subject,
  type WeeklyRepeatType,
} from "./subject";
import type { Timetable } from "./timetable";

// Shared fixtures for the primitives tests.

const SLOT: Slot = {
  professor: "",
  location: "",
  startTime: { hour: 8, minute: 0 },
  endTime: { hour: 9, minute: 30 },
};

// A weekly rhythm, by default every Monday 08:00-09:30.
export function weekly(
  day: Day = "monday",
  type: WeeklyRepeatType = "A",
  slot: Partial<Slot> = {},
): Repeat {
  return { type, day, ...SLOT, ...slot };
}

// Listed dates, each 08:00-09:30.
export function dated(...dates: string[]): Repeat {
  return { type: "I", dates: dates.map((date) => ({ ...SLOT, date })) };
}

export function subject(name: string, patch: Partial<Subject> = {}): Subject {
  return {
    repeat: weekly(),
    name,
    kind: ["SU"],
    onDemand: false,
    ...patch,
  };
}

export function timetable(
  name: string,
  subjects: Subject[],
  patch: Partial<Timetable> = {},
): Timetable {
  return {
    name,
    subjects: Subjects.fromSubjects(subjects, () => ({ enabled: true })),
    origin: { kind: "local" },
    rejected: [],
    ...patch,
  };
}

export function profile(name: string, timetables: Timetable[]): Profile {
  return { name, locked: false, timetables };
}

// An in-memory catalog: `files` maps path -> payload. Timetable entries get
// their `Subjects.hash()`, the way the index generator has to write them.
export function fakeCatalog(files: Record<string, unknown>, hashes: Record<string, string> = {}) {
  const fetched: string[] = [];
  const fetchJson: FetchJson = async (path) => {
    fetched.push(path);
    return structuredClone(files[path]);
  };
  const entries: CatalogEntry[] = Object.entries(files).map(([path, data]) => ({
    path,
    kind: path.startsWith("timetables/")
      ? "timetables"
      : path.startsWith("degreeinformation/")
        ? "degreeinformation"
        : path === "dates.json"
          ? "dates"
          : "locations",
    hash: hashes[path] ?? (Array.isArray(data) ? subjectsHash(data as Subject[]) : "h-" + path),
  }));
  return { catalog: new Catalog({ version: 1, files: entries }, fetchJson), fetched };
}
