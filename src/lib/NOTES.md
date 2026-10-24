# src/lib — notes

App glue over `src/lib/primitives/`: words, wires and render-prepares what the
primitives compute. Pure, no React. Never defines a domain type or
re-implements primitive logic.

- `catalog.ts` — the ONE fetcher (`VITE_CATALOG_URL`, default `catalog/`),
  shared by every hook that reads the catalog. `catalogNews`: which catalog
  files in use a cache change brought a new version of (not a first download,
  not a drop, not a file an own one replaces), for this tab's refresh and
  another tab's alike. `catalogDatesNews`: another tab installed newer
  catalog dates (not a first install, a removal or a switch from or to own
  dates).
- `layout.ts` — grid blocks (`Entry`: timetable name + subject index, since
  `SubjectID` is not unique). Hours fixed 8–19, Mon–Fri columns plus `other`
  as a column of its own, in time order. Listed dates with the same slot
  merge into one block in the general view. `fitDay` puts a laid out day into
  a column of a given width: no lane under `MIN_LANE_PX` (48px), the rest of a
  cluster gathered into its last lane as a collected block. `colourKind`: the
  kind a block is coloured by (Pr, Ue, Tu, S, WF, SU; `kinds.ts` holds the
  class names). `weekFilterMatches`: the general view's filter, G and U only.
  `nextWeekWithEntries`: where an empty week's next classes are (only asked
  for an empty week, it walks up to a year).
- `allday.ts` — the all-day row's chips: neighbouring columns with the very
  same events share one, a lecture-free event leads its day.
- `subjects.ts` — words for subjects. `subjectName` spells a code out from
  the lookup tables in `primitives/overrides.ts` (only the file its
  `degreeProgram` names; unknown codes stay themselves, `/` variants spell out
  their base and keep the variant).
- `warnings.ts` — wording of the primitives' warning data only. ONE line per
  kind of warning (user decision; "more than one group" was once a line per
  subject, then per category): a timetable arrives with every group selected,
  and a line each buried the other warnings. The line names every category /
  subject it stands for, each quoted (`warn_quoted`, „…“ / “…”), joined by
  `Intl.ListFormat` ("„A“, „B“ und „C“"); "more than one group" lists the
  groups too, per category.
- `upload.ts` — reads files and words failures; dates, locations and
  degree files go through one `readJsonFile`, and the latter two refuse a
  file listing nothing (every list defaults to empty, so a dates file would
  otherwise pass as locations). `toastUploadError` = the settings' error
  toast (zod details capped at 5 +
  "n more"). Runs `z.config(de() | en())` once: zod/mini ships no locale, so
  messages read "Invalid input" wherever this module was not loaded. Off the
  first load.
- `notes.ts` — the notes' read view: lines, links (http(s) and `www.` only,
  trailing punctuation and unbalanced brackets cut off) and `- [ ]` tasks,
  every piece with its offset in the text; `toggleTask` changes the one box
  character. `notesFromFile` reads an uploaded notes file (UTF-8, line
  ends, limit).
- `toast.ts` — the only way to toast. Each call waits for sonner AND the
  mounted `AppToaster`, so sonner stays out of the entry chunk and early toasts
  are shown late instead of lost.
- `edit.ts` — subject editor form ↔ subject; the duplicate check, the origin
  switch and the time / date / slot rules (`parseTime`, `isIsoDate`,
  `endsAfterStart`, `REPEAT_TYPES`) live in primitives.
  Time chips: the university's six 90-minute blocks (08:00 … 17:30-19:00)
  always, plus slots the device's timetables use often (double blocks).
- `groupToggle.ts` — what a group cell or a category's "all" icon switches,
  and the pick a partial group remembers while off (kept with its subjects,
  so an entry whose subject moved is dropped; `GroupTree` keeps it per
  timetable).
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
  `useStripSharedUrl` strips the URL back to the app root when the import
  dialog closes. Anything relative the
  app fetches must resolve against `appRoot()` (`catalog.ts`), not the page:
  on `/s/` the built-in `catalog/` would miss.
  `MAX_SHARE_LENGTH` 1500; four real-size timetables stay far below.
- `download.ts` — Blob URL downloads. The URL is revoked after 10s: revoking
  in the same task as `click()` cancels the download in Chromium when several
  files are saved in one go.
- `names.ts` — glue over the name rule in `primitives/name.ts` (every name a
  valid file name everywhere, unique regardless of case): `nameProblemText`
  words a typed name's problem (all four name inputs: profile rename/duplicate,
  new profile, link import, timetable rename refuse it); `cleanTimetableName` /
  `withCleanNames` repair names that arrive untyped (uploads, profile files,
  catalog files, a link's copies), applied in `upload.ts`, `finalNames` and
  again in `useProfiles` as the guard. Names stored before the rule are not
  rewritten in storage; `safeFilename` cleans them on download.
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
- `uploader.ts` — `loadUpload()`: the lazy `@/lib/upload` import of the
  settings' uploads, `null` plus a toast when the chunk is gone after a deploy.
- `backup.ts` — the settings' backup: `zeiteisen-<date>.backup`; a restore
  writes storage (a refused write puts every key back as it was, so storage and
  the running page agree) and reloads the page, because every hook read its
  state on the first render. A backup reading another catalog URL (or `ignore`)
  empties the catalog cache too, as the settings' switch does.
- `reset.ts` — the settings' "Delete data…": parts as key lists
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
  `resetAndReload` is the one way to do it, for the settings' dialog and
  the error screen alike.
- `retired.ts` — keys no version reads any more, dropped on start
  (`main.tsx`): `tt.notesstrip.v1`, the desktop notes strip's height and
  folding, which the notes panel replaced with nothing to carry over (user
  decision). "Delete data…" still lists it with the settings, for a tab of an
  older version that wrote it again.
- `persist.ts` — `navigator.storage.persist()` once per page load, after the
  first real write (not the load-time rewrite: Firefox prompts).
- `view.ts` — the app opens on Current week while today is inside the lecture
  period of the installed dates, General otherwise (user decision, not
  persisted). The shown week and the phone's day follow "now"; a week or day the
  user picks holds while the week (day) it was picked in lasts (`shownWeek` /
  `shownDay`), so an app left open over the weekend shows the new week on
  Monday. The phone's day turns to the next one at 19:00 (user decision), a day
  pick holds until then; Sunday evening stays on the weekend list, since next
  Monday is not in the shown week. The week is epoch ms, so what depends on it
  is not recomputed on every tick of `useNow`.
- `refresh.ts` — `useCatalog`'s scheduling as plain code: one refresh at a
  time, not again within a minute unless forced, a restart (mode or URL
  changed) makes the running one stale (`refreshScheduler`), `cancel` does
  so without starting one (right before a drop); `dropsCatalog` says which
  change drops the old catalog's cache and dates.
- `profileState.ts` — `useProfiles`' state moves: load, another tab's write
  (keep this tab's active profile, follow a rename, else the first, else a
  fresh default), rename, delete.
- `degrees.ts` / `ownDegrees.ts` — own degree file names follow the name
  rule: unique in any case; a name matching a catalog file in another case
  takes its spelling (subjects look it up exactly), so it really replaces it.
  Two modules so the settings' check stays out of the first load.
- `link.ts` — tree ↔ grid: a group cell's `indexes` meet a block's timetable
  name + index.
- `media.ts` — the `compact`, `wide` and `short` variants as media queries
  for script, and the step (`narrow` | `compact` | `wide`) they make
  (`useStep`).
- `launch.ts` / `debug.ts` — the "Debug info" (settings → About).
  `launch.ts` sits in the entry chunk (`startLaunchLog` first in `main.tsx`,
  keep it tiny): performance marks for the first render and the deferred
  chunk, every return from the background (hidden for how long, the next
  frame after it) and page errors, in memory only — no storage key, nothing
  outlives the page. `debug.ts` (deferred) builds the plain-text report on
  demand: navigation and paint timings, service worker and caches, storage
  sizes, counts of profiles, timetables and subjects. Never names, notes or
  file contents. A launch that felt slow while its numbers stay small was
  slow before the page existed (the system starting or waking the app).
  Because Safari reports no `workerStart`, the service worker reports its
  own side: `public/sw-launch.js` (imported into the generated worker by
  `vite.config.ts`, watches only) keeps when the worker started and when it
  saw the last navigations; `startLaunchLog` asks the controller once, right
  away, over a `MessageChannel`, and the report shows those times relative to
  the navigation start (negative: before it). Page request seen around 0: the
  page's clock covers the worker, so a wait not in the numbers was iOS
  starting the app. Seen seconds before 0: the page's clock started late, and
  the worker's created / script-ran times show where the wait went. Created
  hours before: the worker was still running, it cost nothing.
