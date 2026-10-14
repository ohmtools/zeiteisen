# Zeiteisen

Client-only (static hosting, no server) PWA to try out group combinations and
build a personal university timetable.

Stack: Vite + TypeScript + React (React Compiler) + TailwindCSS v4,
`vite-plugin-pwa`, `paraglide-js` (en/de), `zod/mini`, `ohash`, `ics`,
`date-fns`, `lucide-react`, `sonner`.

## Scripts

```sh
npm run dev       # dev server
npm run build     # compile messages, typecheck, AI skill zip, build
npm run messages  # regenerate generated/paraglide/ from messages/*.json
npm run lint      # oxlint
npm run fmt       # oxfmt
npm test          # vitest

npm run schema               # every JSON schema at once
npm run schema:timetable     # a timetable file (plain Subject[])
npm run schema:dates         # global dates
npm run schema:locations     # catalog locations.json
npm run schema:degree        # one catalog degrees/*.degree
npm run schema:catalog       # catalog index.json

npm run catalog -- <dir>     # (re)write <dir>/index.json from its files
npm run skill                # AI skill schemas + public/zeiteisen-generator.zip

npm run catalog-remote       # index ./catalog here, copy it onto the server's catalog
```

## Deployment

`dist/` is a plain static site; any static host serves it. Production runs it
as a container.

### Release and container image

Publishing a release on GitHub runs `.github/workflows/release.yml`: lint and
tests, then

1. the build as `zeiteisen-<tag>.zip` (with `.sha256`) attached to the release,
2. a container image `ghcr.io/ohmtools/zeiteisen`, tagged `<tag>`, `1.2.3`,
   `1.2` and, except for pre-releases, `latest`.

Set the repository variable `VITE_SITE_URL` (the deployed origin, e.g.
`https://zeiteisen.example.org`) first: the link previews need it, for the ZIP
and the image alike. `.github/workflows/ci.yml` lints, tests and builds every
push.

The `Containerfile` builds in two stages: Node builds the app, the image only
gets `dist/` and [static-web-server](https://static-web-server.net), no Node,
no sources. It runs as `nobody` and serves on port 8080. The headers live in
`static-web-server.toml`: hashed files under `assets/` are cached for a year
(`immutable`), everything else (`index.html`, `sw.js`, manifest, icons,
catalog) is revalidated on every request by `Last-Modified`. Compression and
TLS are the reverse proxy's job.

```sh
podman build -t zeiteisen . && podman run --rm -p 8080:8080 -v ./catalog:/public/catalog:ro zeiteisen
```

### Running it with Podman and Caddy

The image carries no catalog: the server keeps it in
`/home/zeiteisen/.local/share/zeiteisen/catalog`, mounted read-only at
`/public/catalog`, so the app finds it under its default `catalog/`. Without
the mount the app runs without a catalog. A rootless Quadlet for the user
`zeiteisen` (`~/.config/containers/systemd/zeiteisen.container`):

```ini
[Container]
ContainerName=zeiteisen
Image=ghcr.io/ohmtools/zeiteisen:latest
PublishPort=127.0.0.1:8081:8080
Volume=%h/.local/share/zeiteisen/catalog:/public/catalog:ro
AutoUpdate=registry
ReadOnly=true
DropCapability=all
NoNewPrivileges=true

[Service]
Restart=always

[Install]
WantedBy=default.target
```

```sh
systemctl --user daemon-reload && systemctl --user start zeiteisen
systemctl --user enable --now podman-auto-update.timer   # pulls new releases daily
loginctl enable-linger zeiteisen                         # as root: run without a login
```

`podman auto-update` pulls the image once `latest` points to a new release and
restarts the service; `podman auto-update` by hand does it right away. Roll
back by pinning a tag, e.g. `Image=ghcr.io/ohmtools/zeiteisen:1.2.9`. If the
ghcr package is private, log in once with a classic token with
`read:packages`:
`podman login ghcr.io --authfile ~/.config/containers/auth.json`.

Caddyfile:

```caddyfile
zeiteisen.example.org {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8081
}
```

### Catalog upload

`npm run catalog-remote` needs no Node on the server: it writes
`catalog/index.json` locally and streams `./catalog` over ssh as a tar,
unpacked as `zeiteisen` over the server's catalog. Files are overwritten,
never deleted: one removed locally stays on the server, unlisted in the
index. The server comes from `ZEITEISEN_SSH` in `.env.local` (gitignored, so
its address stays out of the repository; an exported variable works too, and
the script stops without either):

```sh
ZEITEISEN_SSH=ssh://root@example.org:2222
```

## Optional catalog

The app can read a directory of static JSON files served next to it, so
locations, subject information, semester dates and ready-made timetables do
not have to be collected by hand. It stays client-only: these are static asset
reads, there is no API and nothing is ever sent.

```text
srv/catalog/           # the copy in this repo, dev only
  index.json           # generated: npm run catalog -- ./srv/catalog
  locations.json       # building shortcut -> name, maps link, site link
  degrees/*.degree     # subject shortcut -> name, sws, description, exam (de + en);
                       # flat (no subdirectories); a subject names its file
                       # without extension in `degreeProgram` ("B-EI")
  dates.json           # the global dates, installed by the app on its own
  timetables/**/*.json # timetables offered in the timetable picker
```

`npm run dev` mounts `srv/catalog/` at `/catalog/` (dev server only, never part
of `dist/`). In production, serve such a directory under `catalog/` next to
`index.html` (the container: a volume at `/public/catalog`, see Deployment),
or point the app elsewhere at build time:

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
- `scripts/` — JSON schema, catalog index, AI skill zip, app icon and
  link preview card generators.
- `skill/zeiteisen-generator/` — the AI skill offered in the "Data" menu,
  which turns university PDFs and pages into the app's files.

Each directory with its own logic carries a `NOTES.md` with the reasons and
decisions behind it.

`srv/catalog/` is a complete catalog with the real test data — use it to try the
app without collecting files by hand.
