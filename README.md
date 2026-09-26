# Zeiteisen

Client-only (static hosting, no server) PWA to try out group combinations and
build a personal university timetable.

Stack: Vite + TypeScript + React (React Compiler) + TailwindCSS v4,
`vite-plugin-pwa`, `paraglide-js` (en/de), `zod/mini`, `ohash`, `ics`,
`date-fns`, `lucide-react`, `sonner`.

## Scripts

```sh
npm run dev       # dev server
npm run build     # compile messages, typecheck, build
npm run messages  # regenerate generated/paraglide/ from messages/*.json
npm run lint      # oxlint
npm run fmt       # oxfmt
npm test          # vitest

npm run schema               # every JSON schema at once
npm run schema:timetable     # a timetable file (plain Subject[])
npm run schema:dates         # global dates
npm run schema:locations     # catalog locations.json
npm run schema:degreeinformation # one catalog degreeinformation/*.json
npm run schema:catalog       # catalog index.json

npm run catalog -- <dir>     # (re)write <dir>/index.json from its files

npm run upload               # rsync the project (minus .gitignore'd files) to the server
npm run publish              # build on the server (no upload), replace the served site
npm run catalog-remote # rewrite the server catalog's index.json (no upload)
```

The server scripts reach the server as `root` over ssh (port 2222; `npm run
remote -- '<cmd>'` runs one command there). The project lives in
`/home/caddy/.config/containers/zeiteisen`, the site is served from
`…/containers/srv/zeiteisen/site` and the catalog from
`…/containers/srv/zeiteisen/catalog`. Every copy uses `rsync --delete`, so
files gone locally are gone remotely; `node_modules` is gitignored, so the
server runs `npm ci` itself before building or indexing.

## Optional catalog

The app can read a directory of static JSON files served next to it, so
locations, subject information, semester dates and ready-made timetables do
not have to be collected by hand. It stays client-only: these are static asset
reads, there is no API and nothing is ever sent.

```
srv/catalog/           # the copy in this repo, dev only
  index.json           # generated: npm run catalog -- ./srv/catalog
  locations.json       # building shortcut -> name, maps link, site link
  degreeinformation/*.json # subject shortcut -> name, sws, description, exam (de + en)
  dates.json           # the global dates, installed by the app on its own
  timetables/**/*.json # timetables offered in the timetable picker
```

`npm run dev` mounts `srv/catalog/` at `/catalog/` (dev server only, never part
of `dist/`). In production, serve such a directory under `catalog/` next to
`index.html` (Caddy: same `root`, nothing to configure), or point the app
elsewhere at build time:

```sh
VITE_CATALOG_URL=https://files.example.org/catalog/ npm run build
```

A different origin has to send `Access-Control-Allow-Origin`. Re-run
`npm run catalog -- <dir>` after every change: the hashes in `index.json` are
what tells a client its cached copy is stale.

Link previews (WhatsApp, Discord, …) need the deployed origin for their
absolute image URL: set `VITE_SITE_URL` in `.env` (or on the command line)
before `npm run build`. Share links open on `/s/`, a static copy of the page
with its own preview card; nothing to configure on the server.

Everything about the catalog is optional. No catalog, a partial one, a broken
file or no network at all: the app keeps working from its own cache
(`tt.catalog.v1`) and from files uploaded by hand.

## Profiles own their timetables

A profile is one saved variant of your timetable: it holds its own full copy
of every timetable it uses, with your group selection, picked when the profile
is created or added later with "Add timetables" under the subjects. Duplicate
a profile to try a variant without touching the original. Copies are never
refreshed behind your back — a copy installed from the catalog offers an
update when the catalog file changes (the cloud icon next to its name), and
applying it is one click. Updates only ever come from the catalog. The global
dates are the one exception: the app installs and refreshes them from the
catalog until you load your own ("Data" menu in the footer, which also hands
control back).

## Your data

Everything lives in the browser's local storage, nothing is ever sent
anywhere. The footer's "Data" menu saves a backup file of all profiles,
dates and settings and loads one back (it replaces everything on the device,
after asking). A single profile travels as a share link or a `.profile` file;
the calendar export writes one `.ics` per profile.

On iPhone and iPad, add the app to the home screen: Safari deletes the data of
websites that were not opened for 7 days.

## Layout

- `src/lib/primitives/` — domain model and core logic (types, zod schemas,
  overlap math, hashing, storage, catalog); everything else is glue on top.
- `src/hooks/` — state, persisted through primitives `storage.ts`.
- `src/components/` — UI; shadcn components in `src/components/ui/`.
- `src/lib/` — app glue: picker rows, share link, calendar export, backup.
- `messages/{en,de}.json` — UI strings; `src/i18n.ts` is the only importer of
  the compiled output in `generated/paraglide/` (generated, gitignored).
- `project.inlang/` — paraglide/inlang project settings.
- `scripts/` — JSON schema and catalog index generators.

Each directory with its own logic carries a `NOTES.md` with the reasons and
decisions behind it.

`srv/catalog/` is a complete catalog with the real test data — use it to try the
app without collecting files by hand.
