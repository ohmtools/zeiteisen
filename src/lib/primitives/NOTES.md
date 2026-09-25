# Primitives — notes

ONLY EDIT FILES IN THIS DIRECTORY WITH EXPLICIT PERMISSION.

The domain model and core logic. Pure: no React, no UI strings — warnings,
diffs and failures return data, the app words them. Nothing reads or writes
outside `storage.ts` and `catalog.ts`, and both take their store / fetcher as a
parameter so tests run without a browser.

## Invariants

- Profile names are unique on the device, timetable names unique within one
  profile; names are the addresses. A name the user types that is taken is
  refused; a name that arrives from a file or a source becomes "Name 2"
  (`uniqueName`), never "{source}: {name}".
- A profile owns full copies of its timetables; nothing is shared or
  referenced between profiles. `Timetable` = name + `Subjects<{ enabled }>` +
  `origin` + `rejected`.
- Content identity = `Subjects.hash()` (ohash of the canonical subject list),
  every hash cut to 8 characters (`shortHash`): a device holds at most a few
  hundred subjects. Recomputed on every call on purpose, no caching.
  `subject.test.ts` pins one hash so an ohash upgrade that changes `serialize`
  fails a test.
- `SubjectID` (`name:kinds:group`) is not unique (BEI3 lists `ELK1:SU:2.1`
  twice): a subject is addressed by its index into its `Subjects`.
- Optional keys are left out, never `undefined` (`sameSubject` compares the
  serialized form). `repeatSchema` stores `dates` sorted and deduplicated, so
  the same dates in another order hash the same.
- Zod mirrors of everything read from outside sit at the bottom of the file
  owning the type, `zod/mini` only (bundle size). `scripts/json-schema.mjs`
  still runs classic `z.toJSONSchema` on them (shared core).

## Decisions

- Timetables are never updated by themselves, and updates come from the
  catalog only (`catalogUpdate`, by hash). Accepting keeps the name and the
  `enabled` state of subjects that stay; new ones arrive enabled. A refusal is
  stored in `rejected` for good; a later, different version is offered again.
- Any user edit of subjects (`withEditedSubjects`) makes a catalog timetable
  `local` and clears `rejected`: edited content is the user's own.
- A local upload is named after its file without `.timetable` and stays `local`
  even when its hash matches a catalog file.
- The share link carries no names and no version (`SharedTimetable[]`: hash +
  `enabled` bits in canonical order, bits left out when all are enabled). The
  envelope and `v: 1` belong to the app (`src/lib/share.ts`). No compression.
  A received timetable takes the name of its FIRST source (a local copy before
  the catalog, no other is tried); the profile name is asked from the user.
- The profile file is a plain array of timetables without `rejected`, no
  profile name (the file's name is it), no `locked`.
- No semesters: week counting comes from `SemesterDates` or today
  (`semesterBegin`: the 01.10. / 15.03. nearest the lecture start, without
  dates the last one before today).
- `Repeat` is a union on `type` (not `kind`, which means SU/Pr): weekly
  rhythms carry `day` + one slot, `I` carries dated slots (the university's
  `N` is `I` with one date). Codes are bare strings, no named constants (user
  decision). Weekdays of dates are derived, never stored; weekends land in
  `other`.
- `meetingsInWeek` is THE filter for the week view and the export: listed
  dates win over `noLectures` and the lecture period.
- `classesOf` and unused `Subjects` methods stay (user decision).

## Storage (`storage.ts`)

- Keys stay `.v1` while in development: no migrations, anything that no
  longer parses reads as empty. Reads never throw; a refused write returns
  `false`.
- Profiles parse one at a time: a broken one is dropped alone, a repeated name
  keeps the first.
- Backup (`loadBackup` / `getBackupFile` / `parseBackupFile` / `saveBackup`) =
  every key except the catalog cache (the catalog hands it out again) and the
  iOS hint (about this device only): profiles in their stored shape incl.
  `locked` and `rejected`, active profile, dates, sources, auto-update. The
  language stays with the browser. `parseBackupFile` is STRICT, unlike the
  loaders: one broken profile, a repeated profile or timetable name or a bad
  field refuses the whole file, because a restore replaces everything.
- `tt.ioshint.v1` = the one-time "add to home screen" hint was shown.

## Catalog (`catalog.ts`)

A timetable entry's `hash` in `index.json` MUST be `Subjects.hash()` of its
content (`scripts/catalog-index.mjs` computes it with this very code), so a
timetable is matched without a download; loading re-checks the hash (stale
index). Origin paths are relative to `timetables/`. `index.json` stays
`version: 1` while unreleased.
