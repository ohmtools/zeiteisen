import * as z from "zod/mini";
import { nameFromFile } from "./name";
import {
  findSubjects,
  originSchema,
  subjectSchema,
  subjectsFileSchema,
  Subjects,
  type Subject,
  type SubjectsHash,
  type SubjectsOrigin,
  type SubjectsSource,
} from "./subject";
import { base64UrlToBoolArray, boolArrayToBase64Url } from "./bitCodec";
import type { Catalog, CatalogEntry } from "./catalog";
import type { Profile } from "./profile";

// A timetable's name. Unique WITHIN ONE PROFILE.
// Apart from manual changes from the user, this stays constant.
//
// Used as unique key in sets / lists / maps
export type TimetableName = string;

export type TimetableSubjectExtra = {
  enabled: boolean;
};

export type Timetable = {
  name: TimetableName;
  subjects: Subjects<TimetableSubjectExtra>;
  origin: SubjectsOrigin;
  // Hashes of catalog updates the user dismissed (to avoid nagging them repeatedly)
  rejected: string[];
};

// What a timetable is built from; its selection and dismissed updates are up to
// whoever builds it.
export type TimetableSource = Pick<Timetable, "name" | "origin" | "subjects">;

// Switches the subjects at `indexes` on or off.
export function setSubjectsEnabled(
  timetable: Timetable,
  indexes: readonly number[],
  enabled: boolean,
): Timetable {
  if (indexes.length === 0) return timetable;
  const wanted = new Set(indexes);
  const subjects = timetable.subjects.withMappedExtra((extra, i) =>
    wanted.has(i) ? { ...extra, enabled } : extra,
  );
  return { ...timetable, subjects };
}

// A timetable after the user added, edited or deleted subjects. The content
// is the user's own now: a catalog timetable becomes local, so the catalog
// offers it no update any more, and its dismissed updates go with that.
export function withEditedSubjects(
  timetable: Timetable,
  subjects: Subjects<TimetableSubjectExtra>,
): Timetable {
  return { ...timetable, subjects, origin: { kind: "local" }, rejected: [] };
}

// The subjects the user picked, each with its index into `subjects`.
export function enabledSubjects(timetable: Timetable): { index: number; subject: Subject }[] {
  return timetable.subjects
    .map((subject, extra, index) => ({ subject, extra, index }))
    .filter(({ extra }) => extra.enabled)
    .map(({ subject, index }) => ({ index, subject }));
}

// A downloaded timetable, `<name>.timetable` (JSON inside): its plain `Subject[]`, the very file
// an upload reads back (`parseTimetableFile`, named after the file again).
export function getTimetableFile(timetable: Timetable): Subject[] {
  return timetable.subjects.toSubjects();
}

// What a timetable file gives: the timetable, named after the file, origin
// `local`, every subject enabled; `content` with zod's issues when it is no
// `Subject[]` (the group rule is part of the schema), `name` when the file
// name leaves none (".timetable"). A name taken where it lands is the caller's
// business (`uniqueName`).
export type TimetableFileResult =
  | { source: TimetableSource }
  | { error: "content"; issues: z.core.$ZodError }
  | { error: "name" };

export function parseTimetableFile(json: unknown, fileName: string): TimetableFileResult {
  const parsed = subjectsFileSchema.safeParse(json);
  if (!parsed.success) return { error: "content", issues: parsed.error };
  const name = nameFromFile(fileName);
  if (!name) return { error: "name" };
  return {
    source: {
      name,
      origin: { kind: "local" },
      subjects: Subjects.fromSubjects(parsed.data, () => ({ enabled: true })),
    },
  };
}

// Timetables are never updated behind the user's back: these only find and
// apply what the user is offered and accepts.

// The catalog entry this timetable could update to: the file it was installed
// from, still listed, under a hash that is neither its own nor dismissed.
export function catalogUpdate(timetable: Timetable, catalog: Catalog): CatalogEntry | null {
  const entry = catalog.entryOf(timetable.origin);
  if (!entry) return null;
  if (entry.hash === timetable.subjects.hash()) return null;
  if (timetable.rejected.includes(entry.hash)) return null;
  return entry;
}

export function timetableHasUpdate(timetable: Timetable, catalog: Catalog): boolean {
  return catalogUpdate(timetable, catalog) !== null;
}

// The timetable with the catalog's current content, once the user accepted it.
// A subject that stays keeps its enabled state, a new one arrives enabled.
// `null` when there is no update or the download failed.
export async function update(timetable: Timetable, catalog: Catalog): Promise<Timetable | null> {
  const entry = catalogUpdate(timetable, catalog);
  if (!entry) return null;
  const subjects = await catalog.subjects(entry);
  if (!subjects) return null;
  return {
    ...timetable,
    subjects: timetable.subjects.withNewSubjects(subjects, () => ({ enabled: true })),
  };
}

// Dismisses the offered update for good; a later, different one is offered
// again.
export function rejectUpdate(timetable: Timetable, catalog: Catalog): Timetable {
  const entry = catalogUpdate(timetable, catalog);
  if (!entry) return timetable;
  return { ...timetable, rejected: [...timetable.rejected, entry.hash] };
}

// A source loaded into a timetable, every subject enabled.
export async function loadSource(source: SubjectsSource): Promise<TimetableSource | null> {
  const subjects = await source.load();
  if (!subjects) return null;
  return {
    name: source.name,
    origin: source.origin,
    subjects: Subjects.fromSubjects(subjects, () => ({ enabled: true })),
  };
}

// The first timetable with this content the device can get: a copy some
// profile holds (keeping its name and origin), else a catalog file (named after
// the file). `null` when nothing has it or every download failed.
//
// The name is only a suggestion: it may already be taken wherever the caller
// puts the timetable, so the caller has to make it unique there (`uniqueName`).
// `resolveSharedProfile` does that for a whole profile.
export async function findTimetable(
  hash: SubjectsHash,
  profiles: readonly Profile[],
  catalog?: Catalog,
): Promise<TimetableSource | null> {
  for (const source of findSubjects(hash, profiles, catalog)) {
    const loaded = await loadSource(source);
    if (loaded) return loaded;
  }
  return null;
}

export type SharedTimetableSubjects = string;

export function getSharedSubjects<T extends TimetableSubjectExtra>(
  subjects: Subjects<T>,
): SharedTimetableSubjects {
  subjects = subjects.toCanonical();
  const encoded = subjects.map((_, e) => e.enabled);

  return boolArrayToBase64Url(encoded);
}

// `subjects` absent = every subject enabled: the common case needs no bits.
export type SharedTimetable = {
  hash: SubjectsHash;
  subjects?: SharedTimetableSubjects;
};

export function getSharedTimetable(t: Timetable): SharedTimetable {
  const hash = t.subjects.hash();
  if (t.subjects.every((_, e) => e.enabled)) return { hash };
  return { hash, subjects: getSharedSubjects(t.subjects) };
}

export function parseSharedTimetable(
  t: SharedTimetable,
  b: Pick<Timetable, "name" | "origin" | "subjects">,
): Timetable {
  const subjects = b.subjects.toCanonical();
  const encoded =
    t.subjects === undefined ? null : base64UrlToBoolArray(t.subjects, subjects.length);

  return {
    name: b.name,
    subjects: subjects.withMappedExtra((_, i) => {
      return { enabled: encoded ? encoded[i] : true };
    }),
    origin: b.origin,
    rejected: [],
  };
}

// Zod mirrors of the types above. Everything read from outside (catalog,
// localStorage, uploaded files) walks through these before it becomes a
// primitive; nothing here throws, callers use `safeParse`.

// A timetable as JSON: `Subjects` flattened by its `toJSON`. Read back with
// `timetableFromJSON`.
export const timetableJSONSchema = z.object({
  name: z.string().check(z.minLength(1)),
  origin: originSchema,
  rejected: z._default(z.array(z.string()), []),
  subjects: z
    .object({
      subjects: z.array(subjectSchema),
      extra: z.array(z.object({ enabled: z.boolean() })),
    })
    .check(
      z.refine((s) => s.subjects.length === s.extra.length, {
        message: "one extra per subject",
      }),
    ),
});

export type TimetableJSON = z.infer<typeof timetableJSONSchema>;

export function timetableFromJSON(json: TimetableJSON): Timetable {
  return { ...json, subjects: Subjects.fromJSON(json.subjects) };
}

// One timetable of a share link, as the app reads it back.
export const sharedTimetableSchema: z.ZodMiniType<SharedTimetable> = z.object({
  hash: z.string().check(z.minLength(1)),
  subjects: z.optional(z.string()),
});
