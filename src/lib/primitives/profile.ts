import * as z from "zod/mini";
import type { Catalog } from "./catalog";
import { nameFromFile, normalizeName, sameName, uniqueName, uniqueNames } from "./name";
import { findSubjects } from "./subject";
import {
  getSharedTimetable,
  loadSource,
  parseSharedTimetable,
  setSubjectsEnabled,
  timetableFromJSON,
  timetableJSONSchema,
  withEditedSubjects,
  type SharedTimetable,
  type Timetable,
  type TimetableJSON,
  type TimetableName,
  type TimetableSource,
  type TimetableSubjectExtra,
} from "./timetable";
import type { Subjects } from "./subject";

export type Profiles = Profile[];

// The name of a profile. Has to be kept unique.
export type ProfileName = string;

export type Profile = {
  name: ProfileName;
  locked: boolean;
  timetables: Timetable[];
};

// Pure operations on one profile. A profile owns its timetables outright: a
// full copy of every one of them, nothing shared between profiles. Names are
// the only addresses: a profile's name is unique on the device, a timetable's
// name unique inside its profile.

export function profileByName(
  profiles: readonly Profile[],
  name: ProfileName,
): Profile | undefined {
  return profiles.find((profile) => profile.name === name);
}

// Whether another profile already goes by `name` in any case (`sameName`);
// `except` is the profile being renamed, which may keep its own name or change
// only its case.
export function nameTaken(profiles: readonly Profile[], name: string, except?: string): boolean {
  return profiles.some((profile) => sameName(profile.name, name) && profile.name !== except);
}

// The timetable a profile holds under that name, if any.
export function timetableByName(
  profile: Profile | undefined,
  name: TimetableName,
): Timetable | undefined {
  return profile?.timetables.find((timetable) => timetable.name === name);
}

// One timetable per source, its name made unique in the profile ("Name 2").
// The origin is copied along, so a catalog-born timetable keeps offering
// catalog updates in its new profile.
export function addTimetables(profile: Profile, sources: readonly TimetableSource[]): Profile {
  if (sources.length === 0) return profile;
  const names = uniqueNames(
    profile.timetables.map((held) => held.name),
    sources.map((source) => source.name),
  );
  return {
    ...profile,
    timetables: [
      ...profile.timetables,
      ...sources.map((source, i) => ({ ...source, name: names[i], rejected: [] })),
    ],
  };
}

export function removeTimetable(profile: Profile, name: TimetableName): Profile {
  if (!timetableByName(profile, name)) return profile;
  return { ...profile, timetables: profile.timetables.filter((one) => one.name !== name) };
}

// Origin and refusals stay: a renamed catalog timetable still offers its
// updates. Unchanged when `to` is empty, the same or taken by another
// timetable in any case (`sameName`); a change of case alone is a rename.
export function renameTimetable(profile: Profile, from: TimetableName, to: string): Profile {
  const name = normalizeName(to);
  const held = timetableByName(profile, from);
  const taken = profile.timetables.some((other) => other !== held && sameName(other.name, name));
  if (!held || !name || name === from || taken) return profile;
  return replaceTimetable(profile, from, { ...held, name });
}

// An accepted or refused update: the timetable under `name` becomes `next`.
export function replaceTimetable(profile: Profile, name: TimetableName, next: Timetable): Profile {
  const held = timetableByName(profile, name);
  if (!held || held === next) return profile;
  return {
    ...profile,
    timetables: profile.timetables.map((one) => (one === held ? next : one)),
  };
}

// Switches the subjects at `indexes` of one timetable on or off.
export function setEnabled(
  profile: Profile,
  name: TimetableName,
  indexes: readonly number[],
  enabled: boolean,
): Profile {
  const held = timetableByName(profile, name);
  if (!held || indexes.length === 0) return profile;
  return replaceTimetable(profile, name, setSubjectsEnabled(held, indexes, enabled));
}

// The user added, edited or deleted subjects of one timetable
// (`withEditedSubjects`: a catalog timetable turns local).
export function editSubjects(
  profile: Profile,
  name: TimetableName,
  subjects: Subjects<TimetableSubjectExtra>,
): Profile {
  const held = timetableByName(profile, name);
  if (!held) return profile;
  return replaceTimetable(profile, name, withEditedSubjects(held, subjects));
}

// The timetables of a profile a share cannot bring along: the receiver
// resolves a hash from their own copies or the catalog, so a timetable whose
// content the catalog does not list (an upload, an outdated catalog version)
// only arrives when they already hold it.
export function timetablesOutsideCatalog(profile: Profile, catalog: Catalog): Timetable[] {
  return profile.timetables.filter(
    (timetable) => catalog.sources(timetable.subjects.hash()).length === 0,
  );
}

export function getSharedTimetables(profile: Profile): SharedTimetable[] {
  return profile.timetables.map(getSharedTimetable);
}

function fingerprint(shared: readonly SharedTimetable[]): string {
  return JSON.stringify(shared.map((one) => `${one.hash}:${one.subjects ?? "all"}`).sort());
}

// Whether some profile shares exactly these timetables with exactly these
// selections, in any order: a shared profile this device already holds (a
// reload, the sender's own device).
export function isKnownSharedProfile(
  shared: readonly SharedTimetable[],
  profiles: readonly Profile[],
): boolean {
  const wanted = fingerprint(shared);
  return profiles.some((profile) => fingerprint(getSharedTimetables(profile)) === wanted);
}

export type ResolvedProfile = {
  profile: Profile;
  // Timetables of the link this device cannot rebuild: no profile and no
  // catalog file has the content, or the selection does not fit it.
  unresolved: SharedTimetable[];
};

// Rebuilds a shared profile on this device from what its profiles and the
// catalog hold. Never throws. Each timetable is taken from the FIRST source
// that has its content (a profile's copy before the catalog, see
// `findSubjects`), no other source is tried; its name is only a suggestion and
// becomes "Name 2" when this profile already holds it. `name` is used as given:
// the caller asks the user for it and refuses a taken one.
export async function resolveSharedProfile(
  shared: SharedTimetable[],
  name: string,
  profiles: readonly Profile[],
  catalog?: Catalog,
): Promise<ResolvedProfile> {
  const loaded: Timetable[] = [];
  const unresolved: SharedTimetable[] = [];

  for (const t of shared) {
    const [first] = findSubjects(t.hash, profiles, catalog);
    const base = first ? await loadSource(first) : null;
    if (!base) {
      unresolved.push(t);
      continue;
    }

    try {
      loaded.push(parseSharedTimetable(t, base));
    } catch {
      // The selection does not decode to this many subjects: a cut-off link.
      unresolved.push(t);
    }
  }

  const names = uniqueNames(
    [],
    loaded.map((timetable) => timetable.name),
  );
  return {
    profile: {
      name: name,
      locked: false,
      timetables: loaded.map((timetable, i) => ({ ...timetable, name: names[i] })),
    },
    unresolved,
  };
}

// A downloaded profile, `<profile name>.profile` (JSON inside). Full timetables, so it imports
// without the catalog, but no name (the file carries it), no `locked` and no
// `rejected`: those are the sender's own business.
export type ProfileFile = Omit<TimetableJSON, "rejected">[];

export function getProfileFile(profile: Profile): ProfileFile {
  return profile.timetables.map((timetable) => ({
    name: timetable.name,
    origin: timetable.origin,
    subjects: timetable.subjects.toJSON(),
  }));
}

// A profile read from a downloaded file, named after the file; a name taken in
// `profiles` becomes "Name 2", and so does a timetable name the file repeats.
// `null` when the file is not a profile file or its name is empty (".profile").
export function parseProfileFile(
  json: unknown,
  fileName: string,
  profiles: readonly Profile[],
): Profile | null {
  const parsed = profileFileSchema.safeParse(json);
  const wanted = nameFromFile(fileName);
  if (!parsed.success || !wanted) return null;

  const names = uniqueNames(
    [],
    parsed.data.map((timetable) => timetable.name),
  );
  return {
    name: uniqueName(
      profiles.map((profile) => profile.name),
      wanted,
    ),
    locked: false,
    timetables: parsed.data.map((timetable, i) =>
      timetableFromJSON({ ...timetable, name: names[i], rejected: [] }),
    ),
  };
}

// Zod mirrors of the types above. Everything read from outside (catalog,
// localStorage, uploaded files) walks through these before it becomes a
// primitive; nothing here throws, callers use `safeParse`.

export const profileFileSchema = z.array(z.omit(timetableJSONSchema, { rejected: true }));
