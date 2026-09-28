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
- Names become file names (`.profile`, `.timetable`, `.ics`) and back, so
  every name is a valid file name on Windows, Linux, Android and iOS (user
  decision, `name.ts`). Windows/FAT set the rule: no `< > : " / \ | ? *` or
  control characters, no trailing dot or space, no `CON`/`NUL`/`COM1`…
  (with any extension), at most 245 UTF-8 bytes (255 minus ".timetable").
  "Unique" ignores case and Unicode form (`sameName`: NFC, lower case), as
  those file systems do; typed names are stored NFC (`normalizeName`).
  `nameProblem` checks (typed names are refused), `cleanName` repairs
  minimally (names from files, the catalog, links; a valid one stays as is).
  Loading and backups treat "Plan" / "plan" as a repeated name (user
  decision): loading keeps the first, a backup is refused.
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
- Every slot (weekly or dated) ends after it starts; the schema refuses
  anything else (reported on `endTime`). Like the group rule it is a zod
  `refine`, which `z.toJSONSchema` drops: the AI skill's `validate.py`
  checks both by hand.
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
- No semesters: week counting comes from the calendar alone, never from
  `SemesterDates` or today. A week belongs to the semester of the last
  01.10. / 15.03. on or before its Sunday (`semesterBegin`): a week containing
  a begin is already week 1 of the new semester (user decision). An export
  across a begin switches the rhythm there.
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
  `locked` and `rejected`, active profile, dates, own locations and
  degree files, sources, catalog mode and URL. Fields an older file lacks
  (own files, mode, URL) restore as their defaults. The
  language stays with the browser. `parseBackupFile` is STRICT, unlike the
  loaders: one broken profile, a repeated profile or timetable name or a bad
  field refuses the whole file, because a restore replaces everything.
- `tt.locations.v1` = the user's own locations file, used INSTEAD of the
  catalog's; `null` or missing = the catalog's. `tt.degrees.v1` = the
  user's own degree files (each subject a `SubjectInformation`: name,
  sws, lp, code, description, test; `parseDegree` keeps the whole entry)
  (`OwnDegreeFile[]`, unique names, upload order). Each is stored under the
  name the user gives it on upload (the file name without `.degree`, a
  `nameProblem`-valid name). An own file REPLACES the catalog file of that
  name (user decision). Files are never merged: a subject names its file in
  `Subject.degreeProgram` — the bare file name, `B-EI` for
  `degrees/B-EI.degree` (`degreeProgramOf`), never a path and never with the
  extension (user decision); without it,
  or with the file not on the device, it shows its code only. Present = "own", so `CatalogSources` carries no flag for them
  (dates need `datesManual` because one key holds catalog and own dates
  alike).
- `tt.catalogmode.v1` = `CatalogMode` (`catalog.ts`), default `auto`:
  `ignore` reads nothing and uses none of the catalog's data, `freeze` reads
  the index but keeps what the device has (`refreshCache` / `datesToInstall`
  get `mode === "auto"`). `tt.catalogurl.v1` = the user's catalog base URL,
  absolute http(s) only, `null` = the built-in one. `saveDates(null)` removes
  the dates (the app drops catalog-installed ones on `ignore` and on another
  URL).
- `tt.ioshint.v1` = the one-time "add to home screen" hint was shown.

## Lookup tables (`overrides.ts`)

`Overrides` = the locations and degree files as lookup tables, built by
`overridesOf` from the cached catalog files (stale copies included: an older
copy beats no names and no links) and the user's own files, which replace the
catalog's as described under Storage. Every lookup (`subjectInfoOf`,
`buildingLinks`, the app's `subjectName`, the editor's code suggestions) takes
its table as an ARGUMENT, never module state: the React Compiler caches a
lookup by its arguments, so a table it cannot see left old names and links on
screen. A code with a variant ("TEG/B", `splitVariant`) is looked up whole
first (keys like "CSEC1/1" hold a slash), then by the part in front of the
last slash; nothing on either side of the slash = no variant. Building links
and full names live only in the catalog or the user's own file, never in the
app.

## Catalog (`catalog.ts`)

A timetable entry's `hash` in `index.json` MUST be `Subjects.hash()` of its
content (`scripts/catalog-index.mjs` computes it with this very code), so a
timetable is matched without a download; loading re-checks the hash (stale
index). Origin paths are relative to `timetables/`. `degrees/` is flat
(user decision): `*.degree` right in it, the index generator refuses a
subdirectory; an entry in one or without `.degree` is ignored
(`degreeProgramOf` = `null`). `index.json` stays
`version: 1` while unreleased.
