# src/hooks — notes

Hooks own state; everything else reads it through props. Every read and write
goes through primitives `storage.ts`.

- `useProfiles` — `tt.profiles.v1` + `tt.active.v1`; its state moves live in
  `@/lib/profileState` (tested there). A locked profile refuses
  every write except unlocking. Adding timetables and profiles returns whether
  it happened: the dialogs stay open when another tab took the name or locked
  the profile meanwhile. Adds, renames and duplicates REFUSE a taken
  name (the dialogs check first; this is the guard behind them). Deleting the
  last profile starts a fresh default. Toasts fire outside state updaters (an
  updater may run twice). A write carries every timetable (~25 KB each); a
  browser that refuses it gets ONE `upload_error_storage` toast.
- Every hook that owns a key re-reads it when ANOTHER tab writes it
  (`useStorageSync`, the `storage` event): otherwise a second open tab's next
  write throws away what the first saved (a restored backup too). All
  settings and data are synced (user decision); the language too, by a reload
  (`src/NOTES.md`). Only `useInstallHint`'s one-time flag is left out: it is
  read once, on the page's first render. Profiles keep this tab's active
  profile while it exists. A tab that takes a change over does not act on it
  again: what the change brought along (the drop of the old catalog) was
  written by the tab it came from, and arrives the same way.
- `useSemesterDates` — `tt.dates.v1`, one dates file at a time. A hand upload
  sets `datesManual`, so the catalog keeps its hands off until the user asks
  for the catalog dates again. A refused dates file is a toast with zod's
  details (the Data menu has no panel). Only a successful write records where
  the dates came from, and only the user's own uploads ask for persistent
  storage — the catalog's first install must not trigger Firefox's prompt.
- `useOwnData` — `tt.locations.v1` + `tt.degrees.v1`. Own locations
  are used INSTEAD of the catalog's ("Use catalog locations" drops the file;
  the catalog's copy stays cached, never shown or toasted meanwhile). Own
  degree files are several files, each REPLACING the catalog file of the
  same name, never merged (user decision; `useCatalog` builds one
  table per file, keyed by `degreeProgram`):
  `readDegrees` checks picked files without storing them, `addDegrees`
  stores them under the names the user gave (Data menu dialog, file name
  without `.degree` filled in); a held name, in any case, is replaced and moves last,
  removing goes by name. Upload toasts say the catalog never touches
  own files.
- `useCatalogSources` — `tt.sources.v1` (where the dates came from,
  `datesManual`), `tt.catalogmode.v1` (the Data menu's cycling "Catalog":
  ignore → auto-update → freeze) and `tt.catalogurl.v1`. New catalog dates
  another tab installed are toasted here (`catalogDatesNews`), with the id
  of `useSemesterDates`' own toast, so a tab never says it twice.
- `useCatalog` — `tt.catalog.v1`. Its scheduling and the drop-on-switch
  rule are plain code in `@/lib/refresh` (tested there). Renders from cache, refreshes on every page
  load, every 5 minutes while visible, on becoming visible again (unless the
  last refresh is under a minute old), on `online`, and when the picker or the
  import dialog opens (`refresh`, App): a tab or installed app stays open for
  days, and one read per page load offered long-replaced timetables. One
  refresh at a time; a mode or URL change restarts it and drops a running
  one. `ignore` reads nothing and hands out `Catalog.empty`; switching to it
  or to another URL empties the cache and removes catalog-installed dates
  (user decision: `freeze` is the mode that keeps catalog data). That drop is
  `dropFor`, called by the Data menu's handlers right before the setting is
  written, never an effect on `mode` / `url`: another tab following the
  setting would drop what the new catalog had already brought. Own files
  always stay. A first download is no news (no toast), nor is a file an own
  one replaces (own locations; an own degree file of its name): `catalogNews`.
  Locations and degree files always read the newest copy on the device, even
  under an older hash: a failed or broken download keeps names and building
  links. A cache another tab wrote is taken over at once and toasted like an
  own refresh; this tab's next refresh starts from it. The toasts carry fixed
  ids, so a tab whose own refresh brings the same change says it once.
  Frozen, the copy
  on the device stays in use, however old. **Timetables are never
  auto-updated**: the catalog only offers, on the user's click.
- `useOnline` — owns nothing; only explains the catalog, nothing waits on it.
- `useShareLink` — builds the link button's URL and strips the address bar on
  mount: the URL never mirrors state.
- `useInstallHint` — iOS browser tab (not standalone): one toast, once per
  device (`tt.ioshint.v1`), because Safari deletes script storage after 7
  days without a visit unless the app is on the home screen.
