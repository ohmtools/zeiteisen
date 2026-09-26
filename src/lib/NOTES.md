# src/lib — notes

App glue over `src/lib/primitives/`: words, wires and render-prepares what the
primitives compute. Pure, no React. Never defines a domain type or
re-implements primitive logic.

- `catalog.ts` — the ONE fetcher (`VITE_CATALOG_URL`, default `catalog/`),
  shared by every hook that reads the catalog.
- `layout.ts` — grid blocks (`Entry`: timetable name + subject index, since
  `SubjectID` is not unique). Hours fixed 8–20, Mon–Fri columns; `other` is a
  list, not a column (user decision). Listed dates with the same slot merge
  into one block in the general view.
- `subjects.ts` — words for subjects. Unknown abbreviations fall back to
  themselves, `/` variants to their base.
- `warnings.ts` — wording of the primitives' warning data only.
- `upload.ts` — reads files and words failures; dates, locations and
  abbreviations go through one `readJsonFile`, and the latter two refuse a
  file listing nothing (every list defaults to empty, so a dates file would
  otherwise pass as locations). `toastUploadError` = the Data menu's error
  toast (zod details capped at 5 +
  "n more"). Runs `z.config(de() | en())` once: zod/mini ships no locale, so
  messages read "Invalid input" wherever this module was not loaded. Off the
  first load.
- `toast.ts` — the only way to toast. Each call waits for sonner AND the
  mounted `AppToaster`, so sonner stays out of the entry chunk and early toasts
  are shown late instead of lost.
- `edit.ts` — subject editor form ↔ subject; the duplicate check and the
  origin switch live in primitives.
  Time chips: the university's six 90-minute blocks (08:00 … 17:30-19:00)
  always, plus slots the device's timetables use often (double blocks).
- `library.ts` — the picker's rows. ONE ROW PER SOURCE, never merged or hidden
  (user decision): each catalog file, every profile's copy, uploads, new empty
  timetables. A profile row copies its timetable WITH its `enabled` flags and
  origin (`loadRow`) and shows its selection ("14 of 40 selected") so two
  copies of the same content are told apart; catalog rows, uploads and empties
  arrive all enabled. Picking a row blocks every row with the same hash, held
  rows claim first (a profile never holds the same content twice, user
  decision).
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
- `ics.ts` — ONE `.ics` per profile (user decision), calendar name = profile
  name, `SUMMARY` = "M1 (SU) · BEI3". Expanded single VEVENTs, never RRULE
  (`G1`/`U2` have no RRULE form); Europe/Berlin wall clock written as UTC
  instants, so no VTIMEZONE. Stable UIDs from profile + timetable +
  `getSubjectID` + date + start time, so re-importing an export updates events
  instead of duplicating them; the subject's full content is left out on
  purpose so a changed room or lecturer updates the event too. Same lecture
  twice → counter prefix. Renaming the profile or a timetable, or moving a
  start time, gives new UIDs.
- `tint.ts` — per-timetable tint by rank in the profile's name order (the
  tree order): the top timetable is `--primary`, each further one a step
  darker, so up to 4 timetables never share a tint (a name hash collided far
  too often: BEI1/2/5/6 all landed on one step). Independent of upload order;
  adding or renaming one may shift the others. Hue never changes, all red
  (user decision); only lightness + chroma step down so `--primary-foreground`
  keeps contrast. Colour is never the only cue.
- `overrides.ts` — module-level tables the catalog (or the user's own file
  of that kind, instead of it) fills (locations, abbreviations): lookups sit
  deep in render helpers. Building links and full names live only in the
  catalog or the user's own file, never in the app.
- `backup.ts` — footer "Data" menu backup: `zeiteisen-<date>.backup`; a restore
  writes storage and reloads the page, because every hook read its state on
  the first render. A backup reading another catalog URL (or `ignore`)
  empties the catalog cache too, as the Data menu's switch does.
- `persist.ts` — `navigator.storage.persist()` once per page load, after the
  first real write (not the load-time rewrite: Firefox prompts).
- `duplicate.ts` — "Duplicate" copies the whole profile (timetables,
  selection, origin, refusals), unlocked, under a name the user confirms
  ("Plan A 2" suggested; a taken name is refused).
- `view.ts` — the app opens on Current week while today is inside the lecture
  period of the installed dates, General otherwise (user decision, not
  persisted).
- `link.ts` — tree ↔ grid: a group cell's `indexes` meet a block's timetable
  name + index.
- `media.ts` — the `desktop` variant as a media query for script.
