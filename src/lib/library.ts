import { timetableNameOf, type Catalog } from "@/lib/primitives/catalog";
import { cleanTimetableName } from "@/lib/names";
import { compareNames, uniqueNames } from "@/lib/primitives/name";
import type { Profile, ProfileName } from "@/lib/primitives/profile";
import { sourceOf, type SubjectsHash, type SubjectsSource } from "@/lib/primitives/subject";
import { loadSource, type TimetableName, type TimetableSource } from "@/lib/primitives/timetable";

// The one list the picker dialog renders: everything this device can put into
// a profile right now — what the catalog offers, what every profile holds and
// what was just uploaded into the dialog.
//
// One row per source, never merged (user decision): the catalog entry, each
// profile's copy and each upload are rows of their own, even when they carry
// the very same content. Identical content is told apart by its hash instead:
// picking one row blocks every row with the same hash (`blockedRows`), so the
// same content never lands in a profile twice.

export type RowKind = "catalog" | "profile" | "upload" | "empty";

export type LibraryRow = {
  key: string;
  name: TimetableName;
  // `Subjects.hash()` of the content; two rows are identical iff equal. The
  // name is not part of it, so a renamed copy still counts as the same.
  hash: SubjectsHash;
  kind: RowKind;
  // The profile a `profile` row's copy sits in.
  profileName?: ProfileName;
  // A copy the target profile holds itself: shown checked and disabled, so
  // everything identical to it is blocked.
  held: boolean;
  // The catalog file's mtime, ISO datetime.
  modified?: string;
  // Where the content is loaded from on confirm: free for a copy or an
  // upload, a checked download for a catalog file.
  source: SubjectsSource;
  // A profile row's copy as it is, selection included: picking it copies the
  // `enabled` flags along (`loadRow`). Everything else arrives all enabled.
  copy?: TimetableSource;
  // A profile row's selection, so two copies of the same content can be told
  // apart.
  selection?: { enabled: number; total: number };
};

type Input = {
  profiles: readonly Profile[];
  catalog: Catalog;
  // Files uploaded inside the dialog itself.
  uploaded: readonly TimetableSource[];
  // New empty timetables asked for in the dialog. They exist only as rows
  // until the dialog confirms them checked.
  empties?: readonly TimetableSource[];
  // The profile the rows would be added to; undefined while a new profile is
  // still being named.
  target?: Profile;
};

const KIND_ORDER: Record<RowKind, number> = { empty: 0, catalog: 1, profile: 2, upload: 3 };

export function libraryRows({
  profiles,
  catalog,
  uploaded,
  empties = [],
  target,
}: Input): LibraryRow[] {
  const rows: LibraryRow[] = [];

  for (const entry of catalog.timetables) {
    // The catalog's own source for this very file: its download re-checks the
    // hash, so a stale index cannot hand out other content.
    const source = catalog.sources(entry.hash).find((one) => catalog.entryOf(one.origin) === entry);
    if (!source) continue;
    rows.push({
      key: "c:" + entry.path,
      name: timetableNameOf(entry),
      hash: entry.hash,
      kind: "catalog",
      held: false,
      modified: entry.modified,
      source,
    });
  }

  for (const profile of profiles) {
    for (const timetable of profile.timetables) {
      rows.push({
        // Unique names alone do not make "profile/timetable" unique: "WS 24/25"
        // + "BEI3" and "WS 24" + "25/BEI3" would meet. JSON cannot.
        key: "p:" + JSON.stringify([profile.name, timetable.name]),
        name: timetable.name,
        hash: timetable.subjects.hash(),
        kind: "profile",
        profileName: profile.name,
        held: profile.name === target?.name,
        source: sourceOf(timetable),
        copy: { name: timetable.name, origin: timetable.origin, subjects: timetable.subjects },
        selection: {
          enabled: timetable.subjects.toExtra().filter((extra) => extra.enabled).length,
          total: timetable.subjects.length,
        },
      });
    }
  }

  uploaded.forEach((timetable, i) => {
    rows.push({
      key: "u:" + i,
      name: timetable.name,
      hash: timetable.subjects.hash(),
      kind: "upload",
      held: false,
      source: sourceOf(timetable),
    });
  });

  // New empty timetables lead the list, where the button that made them
  // expects them. Each is its own content: the hash is the row key, so two
  // empty ones never block each other, nor an empty one a profile holds.
  const fresh = empties.map((timetable, i): LibraryRow => ({
    key: "e:" + i,
    name: timetable.name,
    hash: "e:" + i,
    kind: "empty",
    held: false,
    source: sourceOf(timetable),
  }));

  // The sort is stable, so uploads keep the order they came in.
  const sorted = rows.sort(
    (a, b) =>
      compareNames(a.name, b.name) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      compareNames(a.profileName ?? "", b.profileName ?? ""),
  );
  return [...fresh, ...sorted];
}

// Rows that cannot be picked right now: identical to a held row or to a picked
// one. Held rows claim their content first, then picked rows in list order, so
// of two identical picked rows only the later one is blocked — never both.
export function blockedRows(rows: LibraryRow[], picked: ReadonlySet<string>): Set<string> {
  const blocked = new Set<string>();
  const claimed = new Set<SubjectsHash>();
  const anchors = [
    ...rows.filter((row) => row.held),
    ...rows.filter((row) => !row.held && picked.has(row.key)),
  ];
  for (const row of anchors) {
    if (claimed.has(row.hash)) {
      if (!row.held) blocked.add(row.key);
    } else claimed.add(row.hash);
  }
  for (const row of rows) {
    if (row.held || picked.has(row.key)) continue;
    if (claimed.has(row.hash)) blocked.add(row.key);
  }
  return blocked;
}

// The name each picked row lands under, by row key, file-safe (a catalog
// file or an upload may be named anything its file system allowed). A profile holds each name
// once: the held timetables keep theirs, then every picked row in list order
// takes its own name or the next free "Name 2".
export function finalNames(
  rows: LibraryRow[],
  picked: ReadonlySet<string>,
  held: Iterable<TimetableName>,
): Map<string, TimetableName> {
  const landing = rows.filter((row) => !row.held && picked.has(row.key));
  const names = uniqueNames(
    held,
    landing.map((row) => cleanTimetableName(row.name)),
  );
  return new Map(landing.map((row, i) => [row.key, names[i]]));
}

// The timetable a picked row adds: a profile's copy with its selection and
// origin, anything else loaded all enabled (a catalog file is downloaded and
// its hash re-checked). `null` when that download fails.
export async function loadRow(row: LibraryRow): Promise<TimetableSource | null> {
  return row.copy ?? loadSource(row.source);
}
