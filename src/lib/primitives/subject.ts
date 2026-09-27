import { hash, serialize } from "ohash";
import * as z from "zod/mini";
import { groupName, groupSchema, type Group } from "./group";
import type { Catalog } from "./catalog";
import type { Profile } from "./profile";
import type { TimetableName, TimetableSource } from "./timetable";

// The rhythm codes of the university's timetables. Weeks count from 01.10.
// (winter) / 15.03. (summer), week 1 is odd; see `week.ts`.
export type RepeatType =
  // Only on the listed dates (the university's "N" for one date and "I" for
  // several irregular ones)
  | "I"
  // Every week
  | "A"
  // Every even week ("gerade")
  | "G"
  // Every odd week ("ungerade")
  | "U"
  // The first half of the semester
  | "SH1"
  // The second half of the semester
  | "SH2"
  // Every four weeks from the first even week
  | "G1"
  // Every four weeks from the second even week
  | "G2"
  // Every four weeks from the first odd week
  | "U1"
  // Every four weeks from the second odd week
  | "U2";

// Every rhythm bound to a weekday instead of dates.
export type WeeklyRepeatType = Exclude<RepeatType, "I">;

// Who teaches when and where: one meeting of a subject.
export type Slot = {
  professor: string;
  location: string;
  startTime: Time;
  endTime: Time;
};

// A slot on one date, ISO YYYY-MM-DD.
export type DatedSlot = Slot & { date: string };

// When a subject meets. A weekly rhythm names its weekday; dates carry their
// own slot each, since irregular dates may differ in time and room. The
// weekday of a date is derived from it (`dayOf`), never stored.
export type Repeat =
  | { type: "I"; dates: DatedSlot[] }
  | ({ type: WeeklyRepeatType; day: Day } & Slot);

export const Kind = {
  Lecture: "SU",
  Laboratory: "Pr",
  Exercise: "Ue",
  Tutorial: "Tu",
  Seminar: "S",
  Elective: "WF",
} as const;

export type Kind = (typeof Kind)[keyof typeof Kind];

// All kinds of a subject, in file order, as one string.
export function kindLabel(kinds: Kind[]): string {
  return kinds.join(",");
}

export const Day = {
  Monday: "monday",
  Tuesday: "tuesday",
  Wednesday: "wednesday",
  Thursday: "thursday",
  Friday: "friday",
  // Saturday, and whatever else the university files outside Mon-Fri
  other: "other",
} as const;

export type Day = (typeof Day)[keyof typeof Day];

export type Time = {
  hour: number;
  minute: number;
};

// Minutes since midnight: compares and measures times.
export function minutesOf(t: Time): number {
  return t.hour * 60 + t.minute;
}

export type Subject = {
  repeat: Repeat;
  name: string;
  kind: Kind[];
  group?: Group;
  note?: string;
  onDemand: boolean;
};

// `name:kinds`: one subject with all its groups and slots.
export type SubjectKey = string;

// `name:kinds:group` in the official notation, `name:kinds` without a group.
// Names a class, NOT one entry: a class may be listed in several slots.
export type SubjectID = string;

export function getSubjectKey(s: Subject): SubjectKey {
  return s.name + ":" + kindLabel(s.kind);
}

export function getSubjectID(s: Subject): SubjectID {
  const key = getSubjectKey(s);
  return s.group ? key + ":" + groupName(s.group) : key;
}

// Exactly the same subject, every field compared. Optional keys must be left
// out rather than set to `undefined`, or two equal subjects differ.
export function sameSubject(a: Subject, b: Subject): boolean {
  return serialize(a) === serialize(b);
}

// Whether the subjects already hold exactly this subject anywhere but at
// `except` (the one being edited): the subject editor refuses a duplicate.
export function isDuplicate<T extends object>(
  subjects: Subjects<T>,
  subject: Subject,
  except?: number,
): boolean {
  return subjects.some((other, _, i) => i !== except && sameSubject(other, subject));
}

export type SubjectsHash = string;

// Every hash in the app is this long: a device holds at most a few hundred
// subjects and a few dozen timetables / profiles.
export const HASH_LENGTH = 8;

// ohash cut to `HASH_LENGTH` characters.
export function shortHash(value: unknown): string {
  return hash(value).slice(0, HASH_LENGTH);
}

// I want the path property to let me organize the timetables in the online
// catalog into further subdirectories: catalog/timetables/semester/*,
// catalog/timetables/custom/*, .... The path field is relative to the
// catalog/timetables/ directory and points all the way to the target file.
export type SubjectsOrigin = { kind: "catalog"; path: string } | { kind: "local" };

// A place the device can get a subject list from, with the name and origin a
// timetable made from it takes. `load` is free for a profile's copy and
// downloads for a catalog file; `null` when that fails or the content turned
// out to be different.
export type SubjectsSource = {
  name: TimetableName;
  origin: SubjectsOrigin;
  load: () => Promise<Subject[] | null>;
};

// Every place the device can get the subjects with this hash from: copies the
// profiles hold first (no download), then catalog files listing the hash. The
// same content may sit in several places under different names; the caller
// picks.
export function findSubjects(
  hash: SubjectsHash,
  profiles: readonly Profile[],
  catalog?: Catalog,
): SubjectsSource[] {
  const held = profiles
    .flatMap((profile) => profile.timetables)
    .filter((timetable) => timetable.subjects.hash() === hash)
    .map(sourceOf);
  return [...held, ...(catalog?.sources(hash) ?? [])];
}

// A timetable the device already holds as a source: its name, its origin and
// its subjects, loaded for free.
export function sourceOf(timetable: TimetableSource): SubjectsSource {
  return {
    name: timetable.name,
    origin: timetable.origin,
    load: () => Promise.resolve(timetable.subjects.toSubjects()),
  };
}

// `Subjects.hash()` of a plain list, e.g. a freshly downloaded file.
export function subjectsHash(subjects: readonly Subject[]): SubjectsHash {
  return Subjects.fromSubjects(subjects, () => ({})).hash();
}

export type SerializedSubjects<T> = {
  subjects: Subject[];
  extra: T[];
};

// Internal arrays are immutable. The array object properties can be changed
// though.
export class Subjects<T extends object> {
  readonly #subjects: Subject[];
  readonly #extra: T[];

  constructor(subjects: readonly Subject[], extra: readonly T[]) {
    if (extra.length !== subjects.length) {
      throw new Error(`length mismatch: ${subjects.length} subjects vs ${extra.length} flags`);
    }

    this.#subjects = [...subjects];
    this.#extra = [...extra];
  }

  // --- factories ---

  static empty<T extends object>(): Subjects<T> {
    return new Subjects<T>([], []);
  }

  static fromSubjects<T extends object>(
    subjects: readonly Subject[],
    makeExtra: () => T,
  ): Subjects<T> {
    return new Subjects<T>(
      subjects,
      subjects.map(() => makeExtra()),
    );
  }

  static fromJSON<T extends object>(json: SerializedSubjects<T>): Subjects<T> {
    return new Subjects(json.subjects, json.extra);
  }

  // --- reads ---

  get length(): number {
    return this.#subjects.length;
  }

  get isEmpty(): boolean {
    return this.#subjects.length === 0;
  }

  getSubject(index: number): Subject {
    this.#assertIndex(index);
    return this.#subjects[index];
  }

  getExtra(index: number): T {
    this.#assertIndex(index);
    return this.#extra[index];
  }

  toSubjects(): Subject[] {
    return [...this.#subjects];
  }

  toExtra(): T[] {
    return [...this.#extra];
  }

  toJSON(): SerializedSubjects<T> {
    return { subjects: this.toSubjects(), extra: this.toExtra() };
  }

  toView(): (Subject & { extra: T; index: number })[] {
    return this.#subjects.map((s, i) => ({
      ...s,
      extra: this.#extra[i],
      index: i,
    }));
  }

  *[Symbol.iterator](): IterableIterator<{ subject: Subject; extra: T; index: number }> {
    for (let i = 0; i < this.#subjects.length; i++) {
      yield { subject: this.#subjects[i], extra: this.#extra[i], index: i };
    }
  }

  // reader, like Array.map
  map<U>(fn: (subject: Subject, extra: T, index: number) => U): U[] {
    return this.#subjects.map((s, i) => fn(s, this.#extra[i], i));
  }

  forEach(fn: (subject: Subject, extra: T, index: number) => void): void {
    this.#subjects.forEach((s, i) => fn(s, this.#extra[i], i));
  }

  find(
    pred: (s: Subject, e: T, i: number) => boolean,
  ): { subject: Subject; extra: T; index: number } | undefined {
    for (const entry of this) if (pred(entry.subject, entry.extra, entry.index)) return entry;
    return undefined;
  }

  some(pred: (s: Subject, e: T, i: number) => boolean): boolean {
    return this.#subjects.some((s, i) => pred(s, this.#extra[i], i));
  }

  every(pred: (s: Subject, e: T, i: number) => boolean): boolean {
    return this.#subjects.every((s, i) => pred(s, this.#extra[i], i));
  }

  // writers, immutable
  withMappedSubjects(fn: (s: Subject, index: number) => Subject): Subjects<T> {
    return new Subjects(this.#subjects.map(fn), this.#extra);
  }

  withMappedExtra<U extends object>(fn: (e: T, index: number) => U): Subjects<U> {
    return new Subjects(this.#subjects, this.#extra.map(fn));
  }

  // --- selection (immutable, React-friendly) ---

  with(index: number, value: T): Subjects<T> {
    this.#assertIndex(index);
    const next = [...this.#extra];
    next[index] = value;
    return new Subjects(this.#subjects, next);
  }

  withAllExtra(value: T): Subjects<T> {
    return new Subjects(
      this.#subjects,
      this.#subjects.map(() => value),
    );
  }

  // --- edit / add / remove (both arrays updated together) ---

  withSubject(index: number, subject: Subject): Subjects<T> {
    this.#assertIndex(index);
    const next = [...this.#subjects];
    next[index] = subject;
    return new Subjects(next, this.#extra);
  }

  withPatch(index: number, patch: Partial<Subject>): Subjects<T> {
    this.#assertIndex(index);
    return this.withSubject(index, { ...this.#subjects[index], ...patch });
  }

  withUpdate(index: number, fn: (s: Subject) => Subject): Subjects<T> {
    this.#assertIndex(index);
    return this.withSubject(index, fn(this.#subjects[index]));
  }

  withAdded(subject: Subject, extra: T): Subjects<T> {
    return new Subjects([...this.#subjects, subject], [...this.#extra, extra]);
  }

  withInserted(index: number, subject: Subject, extra: T): Subjects<T> {
    if (index < 0 || index > this.length) throw new RangeError(`index ${index} out of bounds`);
    const ns = [...this.#subjects];
    const ne = [...this.#extra];
    ns.splice(index, 0, subject);
    ne.splice(index, 0, extra);
    return new Subjects(ns, ne);
  }

  withRemoved(index: number): Subjects<T> {
    this.#assertIndex(index);
    const ns = [...this.#subjects];
    const ne = [...this.#extra];
    ns.splice(index, 1);
    ne.splice(index, 1);
    return new Subjects(ns, ne);
  }

  withFiltered(pred: (s: Subject, extra: T, index: number) => boolean): Subjects<T> {
    const ns: Subject[] = [];
    const ne: T[] = [];
    for (let i = 0; i < this.length; i++) {
      if (pred(this.#subjects[i], this.#extra[i], i)) {
        ns.push(this.#subjects[i]);
        ne.push(this.#extra[i]);
      }
    }
    return new Subjects(ns, ne);
  }

  withSorted(compareFn?: (a: Subject, b: Subject) => number): Subjects<T> {
    const order = this.#subjects.map((_, i) => i);
    order.sort((a, b) => (compareFn ? compareFn(this.#subjects[a], this.#subjects[b]) : 0));
    return this.#permute(order);
  }

  withNewSubjects(after: readonly Subject[], fresh: () => T): Subjects<T> {
    const kept = new Map<string, T[]>();
    this.forEach((subject, extra) => {
      const key = serialize(subject);
      kept.set(key, [...(kept.get(key) ?? []), extra]);
    });
    return new Subjects(
      after,
      after.map((subject) => kept.get(serialize(subject))?.shift() ?? fresh()),
    );
  }

  // canonical order for hashing / sharing: sorts by stripped subject only
  toCanonical(): Subjects<T> {
    const order = this.#subjects
      .map((s, i): [number, string] => [i, serialize(s)])
      .sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
      .map(([i]) => i);
    return this.#permute(order);
  }

  hash(): SubjectsHash {
    return shortHash(this.toCanonical().toSubjects());
  }

  #permute(order: number[]): Subjects<T> {
    return new Subjects(
      order.map((i) => this.#subjects[i]),
      order.map((i) => this.#extra[i]),
    );
  }

  #assertIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.length) {
      throw new RangeError(`index ${index} out of bounds (length ${this.length})`);
    }
  }
}

// Zod mirrors of the types above. Everything read from outside (catalog,
// localStorage, uploaded files) walks through these before it becomes a
// primitive; nothing here throws, callers use `safeParse`.

const enumValues = <T extends Record<string, string>>(o: T) =>
  Object.values(o) as [T[keyof T], ...T[keyof T][]];

const timeSchema = z.object({
  hour: z.int().check(z.minimum(0), z.maximum(23)),
  minute: z.int().check(z.minimum(0), z.maximum(59)),
});

const slotShape = {
  professor: z._default(z.string(), ""),
  location: z._default(z.string(), ""),
  startTime: timeSchema,
  endTime: timeSchema,
};

// A slot ends after it starts: a zero or negative length has no block in the
// grid and no valid calendar event. Reported on `endTime`.
const endsAfterStart = z.refine<{ startTime: Time; endTime: Time }>(
  (slot) => minutesOf(slot.endTime) > minutesOf(slot.startTime),
  { message: "endTime must be after startTime", path: ["endTime"] },
);

const weeklyRepeatTypes = [
  "A",
  "G",
  "U",
  "SH1",
  "SH2",
  "G1",
  "G2",
  "U1",
  "U2",
] as const satisfies readonly WeeklyRepeatType[];

// ohash keeps array order, so the same dates listed in another order would
// hash as different content: dates are stored sorted (by date first, since
// `serialize` sorts keys and `date` comes first) and without duplicates.
function canonicalDates(dates: DatedSlot[]): DatedSlot[] {
  const unique = new Map(dates.map((slot) => [serialize(slot), slot]));
  return [...unique.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, slot]) => slot);
}

export const repeatSchema: z.ZodMiniType<Repeat> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("I"),
    dates: z
      .array(z.object({ date: z.iso.date(), ...slotShape }).check(endsAfterStart))
      .check(z.minLength(1), z.overwrite(canonicalDates)),
  }),
  z
    .object({
      type: z.enum(weeklyRepeatTypes),
      day: z.enum(enumValues(Day)),
      ...slotShape,
    })
    .check(endsAfterStart),
]);

export const subjectSchema: z.ZodMiniType<Subject> = z.object({
  repeat: repeatSchema,
  name: z.string().check(z.minLength(1)),
  kind: z.array(z.enum(enumValues(Kind))).check(z.minLength(1)),
  group: z.optional(groupSchema),
  onDemand: z._default(z.boolean(), false),
  note: z.optional(z.string()),
});

// A timetable file is a plain `Subject[]`.
export const subjectsFileSchema: z.ZodMiniType<Subject[]> = z.array(subjectSchema);

export const originSchema: z.ZodMiniType<SubjectsOrigin> = z.union([
  z.object({ kind: z.literal("catalog"), path: z.string().check(z.minLength(1)) }),
  z.object({ kind: z.literal("local") }),
]);
