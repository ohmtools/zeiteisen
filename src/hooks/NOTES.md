# src/hooks — notes

Hooks own state; everything else reads it through props. Every read and write
goes through primitives `storage.ts`.

- `useProfiles` — `tt.profiles.v1` + `tt.active.v1`. A locked profile refuses
  every write except unlocking. Adds, renames and duplicates REFUSE a taken
  name (the dialogs check first; this is the guard behind them). Deleting the
  last profile starts a fresh default. Toasts fire outside state updaters (an
  updater may run twice). A write carries every timetable (~25 KB each); a
  browser that refuses it gets ONE `upload_error_storage` toast.
- Every hook that owns a key re-reads it when ANOTHER tab writes it
  (`useStorageSync`, the `storage` event): otherwise a second open tab's next
  write throws away what the first saved (a restored backup too). Profiles
  keep this tab's active profile while it exists.
- `useSemesterDates` — `tt.dates.v1`, one dates file at a time. A hand upload
  sets `datesManual`, so the catalog keeps its hands off until the user asks
  for the catalog dates again. A refused dates file is a toast with zod's
  details (the Data menu has no panel). Only a successful write records where
  the dates came from, and only the user's own uploads ask for persistent
  storage — the catalog's first install must not trigger Firefox's prompt.
- `useCatalogSources` — `tt.sources.v1` (where the dates came from,
  `datesManual`) and `tt.autoupdate.v1` ("Update catalog data", default on:
  dates, locations, abbreviations only).
- `useCatalog` — `tt.catalog.v1`. Renders from cache, refreshes once per page
  load. A first download is no news (no toast). Locations and abbreviations
  always read the newest copy on the device, even under an older hash: a
  failed or broken download keeps names and building links. With auto-update
  off the copy on the device stays in use, however old. **Timetables are never
  auto-updated**: the catalog only offers, on the user's click.
- `useOnline` — owns nothing; only explains the catalog, nothing waits on it.
- `useShareLink` — builds the link button's URL and strips the address bar on
  mount: the URL never mirrors state.
- `useInstallHint` — iOS browser tab (not standalone): one toast, once per
  device (`tt.ioshint.v1`), because Safari deletes script storage after 7
  days without a visit unless the app is on the home screen.
