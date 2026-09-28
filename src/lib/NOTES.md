# src/lib — notes

App glue over `src/lib/primitives/`: words, wires and render-prepares what the
primitives compute. Pure, no React. Never defines a domain type or
re-implements primitive logic.

- `catalog.ts` — the ONE fetcher (`VITE_CATALOG_URL`, default `catalog/`),
  shared by every hook that reads the catalog. `degreesUpdated`: whether a
  refresh changed a degree file in use (`refreshCache` names kinds only).
- `layout.ts` — grid blocks (`Entry`: timetable name + subject index, since
  `SubjectID` is not unique). Hours fixed 8–20, Mon–Fri columns; `other` is a
  list, not a column (user decision). Listed dates with the same slot merge
  into one block in the general view.
- `subjects.ts` — words for subjects. `subjectName` spells a code out from
  the lookup tables in `primitives/overrides.ts` (only the file its
  `degreeProgram` names; unknown codes stay themselves, `/` variants spell out
  their base and keep the variant).
- `warnings.ts` — wording of the primitives' warning data only. "More than
  one group" is one line per category, not per subject (user decision): a
  timetable arrives with every group selected, and a line per subject buried
  the other warnings. The line keeps every subject and group it stands for.
- `upload.ts` — reads files and words failures; dates, locations and
  degree files go through one `readJsonFile`, and the latter two refuse a
  file listing nothing (every list defaults to empty, so a dates file would
  otherwise pass as locations). `toastUploadError` = the Data menu's error
  toast (zod details capped at 5 +
  "n more"). Runs `z.config(de() | en())` once: zod/mini ships no locale, so
  messages read "Invalid input" wherever this module was not loaded. Off the
  first load.
- `toast.ts` — the only way to toast. Each call waits for sonner AND the
  mounted `AppToaster`, so sonner stays out of the entry chunk and early toasts
  are shown late instead of lost.
- `edit.ts` — subject editor form ↔ subject; the duplicate check, the origin
  switch and the time / date / slot rules (`parseTime`, `isIsoDate`,
  `endsAfterStart`, `REPEAT_TYPES`) live in primitives.
  Time chips: the university's six 90-minute blocks (08:00 … 17:30-19:00)
  always, plus slots the device's timetables use often (double blocks).
- `library.ts` — the picker's rows. ONE ROW PER SOURCE, never merged or hidden
  (user decision): each catalog file, every profile's copy, uploads, new empty
  timetables. A profile row copies its timetable WITH its `enabled` flags and
  origin (`loadRow`) and shows its selection ("14 of 40 selected") so two
  copies of the same content are told apart; catalog rows, uploads and empties
  arrive all enabled. Picking a row blocks every row with the same hash, held
  rows claim first (a profile never holds the same content twice, user
  decision). A held row's checkbox is checked but muted, not primary (user
  decision: primary read as clickable).
- `share.ts` — the link `/s/#v=1&t=<hash>.<bits>&t=…` in the fragment (never
  reaches a server), read and written with `ufo`, validated with zod. `/s/`
  only carries the "shared" link preview card (`src/NOTES.md`);
  `useShareLink` strips the URL back to the app root when the import
  dialog closes. Anything relative the
  app fetches must resolve against `appRoot()` (`catalog.ts`), not the page:
  on `/s/` the built-in `catalog/` would miss.
  `MAX_SHARE_LENGTH` 1500; four real-size timetables stay far below.
- `download.ts` — Blob URL downloads. The URL is revoked after 10s: revoking
  right after `click()` cancels the download in Chromium.
- `names.ts` — glue over the name rule in `primitives/name.ts` (every name a
  valid file name everywhere, unique regardless of case): `nameProblemText`
  words a typed name's problem (all four name inputs: profile rename/duplicate,
  new profile, link import, timetable rename refuse it); `cleanTimetableName` /
  `withCleanNames` repair names that arrive untyped (uploads, profile files,
  catalog files, a link's copies), applied in `upload.ts`, `finalNames` and
  again in `useProfiles` as the guard. Stored names with forbidden characters
  stay (no migrations); `safeFilename` cleans them on download.
- `ics.ts` — ONE `.ics` per profile (user decision), calendar name = profile
  name, `SUMMARY` = "M1 (SU) · BEI3". Expanded single VEVENTs, never RRULE
  (`G1`/`U2` have no RRULE form); Europe/Berlin wall clock written as UTC
  instants, so no VTIMEZONE. Stable UIDs from profile + timetable +
  `getSubjectID` + date + start time, so re-importing an export updates events
  instead of duplicating them; the subject's full content is left out on
  purpose so a changed room or lecturer updates the event too. Same lecture
  twice → counter prefix. Renaming the profile or a timetable, or moving a
  start time, gives new UIDs. An export over the lecture period is stretched
  to every enabled listed date outside it (`lectureExportRange`): the week
  view shows a block seminar in the lecture-free weeks, so the file holds it
  too; weekly classes stay inside the period. A weekly class on `other` (the
  university's "Block / n.V. / Samstag" column, no known weekday) has no date
  and never goes in; the export names those in a warning toast
  (`undatedClasses`) with the way in: give them dates in the editor.
- `tint.ts` — per-timetable tint by rank in the profile's name order (the
  tree order): the top timetable is `--primary`, each further one a step
  darker, so up to 4 timetables never share a tint (a name hash collided far
  too often: BEI1/2/5/6 all landed on one step). Independent of upload order;
  adding or renaming one may shift the others. Hue never changes, all red
  (user decision); only lightness + chroma step down so `--primary-foreground`
  keeps contrast. Colour is never the only cue.
- `uploader.ts` — `loadUpload()`: the lazy `@/lib/upload` import of the Data
  menu uploads, `null` plus a toast when the chunk is gone after a deploy.
- `backup.ts` — footer "Data" menu backup: `zeiteisen-<date>.backup`; a restore
  writes storage (a refused write puts every key back as it was, so storage and
  the running page agree) and reloads the page, because every hook read its
  state on the first render. A backup reading another catalog URL (or `ignore`)
  empties the catalog cache too, as the Data menu's switch does.
- `reset.ts` — the Data menu's "Delete data…": parts as key lists
  (`STORAGE_PARTS`), removed with `removeItem` rather than written empty, so it
  works on a full or broken storage. Dates go with their sources; the
  settings take the catalog cache along (like a restore on another URL). All
  four storage parts at once `clear()` the whole origin, leftovers of older
  shapes too, and paraglide's language choice with them (`PARAGLIDE_LOCALE`
  lives in localStorage, there is no cookie): the language falls back to the
  browser's although no part names it. Kept on purpose: this is the way out
  of a broken storage, and sparing keys there is a risk (user decision). The
  caller reloads, like a restore. "Offline app files" (`deleteAppFiles`)
  unregisters the service worker and empties Cache Storage, so that reload
  fetches every file from the server; the worker precaches again on it.
  Everything ticked = a first visit.
  `resetAndReload` is the one way to do it, for the Data menu's dialog and
  the error screen alike.
- `persist.ts` — `navigator.storage.persist()` once per page load, after the
  first real write (not the load-time rewrite: Firefox prompts).
- `view.ts` — the app opens on Current week while today is inside the lecture
  period of the installed dates, General otherwise (user decision, not
  persisted). The shown week and the phone's day follow "now"; a week or day
  the user picks holds while the week (day) it was picked in lasts
  (`shownWeek` / `shownDay`), so an app left open over the weekend shows the
  new week on Monday. The week is epoch ms, so what depends on it is not
  recomputed on every tick of `useNow`.
- `refresh.ts` — `useCatalog`'s scheduling as plain code: one refresh at a
  time, not again within a minute unless forced, a restart (mode or URL
  changed) makes the running one stale (`refreshScheduler`); `dropsCatalog`
  says which change drops the old catalog's cache and dates.
- `profileState.ts` — `useProfiles`' state moves: load, another tab's write
  (keep this tab's active profile, follow a rename, else the first, else a
  fresh default), rename, delete.
- `degrees.ts` / `ownDegrees.ts` — own degree file names follow the name
  rule: unique in any case; a name matching a catalog file in another case
  takes its spelling (subjects look it up exactly), so it really replaces it.
  Two modules so the Data menu's check stays out of the first load.
- `link.ts` — tree ↔ grid: a group cell's `indexes` meet a block's timetable
  name + index.
- `media.ts` — the `desktop` variant as a media query for script.
