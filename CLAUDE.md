# Zeiteisen — working notes

Client-only PWA (static hosting, **no backend, no API calls ever** — the only
network read is the optional static catalog). Purpose: try out group
combinations for a personal university timetable.

Status: **released.** Real user data lives in browsers, backups, share
links, profile and timetable files and cached catalog indexes. A change after
which the app no longer reads what is already out there — the shape behind a
localStorage key (`tt.*.v1`), the share link (`v: 1`), the backup (`v: 1`),
the `.profile` / `.timetable` / `.degree` / dates / locations files, the
catalog index (`version: 1`) — is a **breaking change**. Before making one,
**ask the user whether to implement a migration** (and bump the version),
every time. Never decide it yourself, either way: not "no migration needed",
not "migrate anyway".

## Domain

Why groups exist — read before touching the tree, `ClassPicker` or warnings.

A subject is taught in several variations (`Kind`: `SU` lecture, `Pr`
laboratory, `Ue` exercise, `Tu` tutorial, `S` seminar, `WF` elective subject
/ Wahlfach), each split into classes:

- The university assigns each subject variation to exactly one group
  category; several may share one. Category _n_ = the whole student body split
  into _n_ equal parts, so group `n.i` covers slice `[(i-1)/n, i/n]`. Two
  groups of different categories are compatible exactly when their slices
  overlap — `isOverlapping`, and why tree rows are aligned rulers.
- Students pick their index per category (first vote under the overlap rule,
  later free per subject), so the tool allows ANY combination.

Two rules follow, and `warnings` warns about their violation, never forbids
it (tinkering is the point): exactly one group per subject, at least one index
of every category.

Terms: a **timetable file** is a plain `Subject[]`. A **`Timetable`** is what a
profile holds: name + subjects with their `enabled` flag + origin + refused
updates. A **profile** is one saved variant of the user's timetable, owning
full copies of its timetables — nothing shared between profiles. There is no
per-timetable grid: the grid shows every timetable of the active profile. No
semesters.

## Non-negotiables

- `src/lib/primitives/**` (code AND its `NOTES.md`): edit only with explicit
  permission from the user, asked every time, listing what changes and why.
- Primitives are the single source of truth for types, zod mirrors, overlap
  math, hashing, storage and catalog. Import from there, never redefine.
- Validate every upload with zod against the primitives' schemas; reject with
  a localized error.
- Timetables are never auto-updated; updates come from the catalog only and
  are offered, never applied, per profile.
- The catalog (`VITE_CATALOG_URL`, dev copy `srv/catalog/`, mounted in
  `npm run dev` only) is optional and read-only: missing, broken or offline
  changes nothing; the user can also point it elsewhere or ignore it
  (settings). Building links and subject full names live ONLY there (or in the
  user's own files uploaded in the settings); a subject's full name comes
  only from the degree file its `degreeProgram` names (`B-EI` ->
  `degrees/B-EI.degree`, flat), never merged.
  Re-run `npm run catalog -- ./srv/catalog` after editing it.
- Global dates and the notes never go into a link, a profile file or anywhere
  but this device (and its backup).
- All UI strings via paraglide (`messages/en.json` + `messages/de.json`,
  then `npm run messages`), imported from `@/i18n`. Catalog / dates texts are
  `{ de, en }` rendered with `localized()`.
- Keep the entry chunk free of panel, sheet, dialog and menu code
  (`src/components/deferred.ts`; toasts via `@/lib/toast`).

## Where the details live

Every directory with its own logic has a `NOTES.md` holding why, user
decisions and invariants; read it before touching code there and put new
directory-specific knowledge there, not here.

- `src/lib/primitives/NOTES.md` — domain model, storage, backup, catalog.
- `src/NOTES.md` — `App` / deferred chunk, tests, i18n.
- `src/lib/NOTES.md` — app glue: picker rows, share link, ICS, kind colours, backup.
- `src/hooks/NOTES.md` — persisted state.
- `src/components/NOTES.md` — shell, panels, bottom bar, grid, tree ↔ grid, group tree.
- `src/components/ui/NOTES.md` — shadcn rules and hand-edits.
- `scripts/NOTES.md` — schema, catalog index and AI skill zip generators.
- `skill/zeiteisen-generator/` — the downloadable AI skill (settings), also
  the plugin `zeiteisen` of the `ohmtools/claude-plugins` marketplace, which
  names this path: moving the folder breaks the plugin. Its manifest is
  `.claude-plugin/plugin.json` there (Claude.ai refuses the plugin without
  it). After editing the primitives, run `npm run skill` and commit the
  schemas.

## Stack / tooling

Vite 8 + React 19 (React Compiler) + TypeScript + Tailwind v4. `zod/mini`
(never classic zod), `ohash`, `ics`, `date-fns`, `lucide-react`, `sonner`,
`vite-plugin-pwa`, `@inlang/paraglide-js`. Lint/format: `oxlint` + `oxfmt`.

```sh
npm run dev       # dev server
npm run build     # messages -> tsc -b -> skill -> vite build
npm run messages  # regenerate generated/paraglide/ after editing messages/*.json
npm run schema    # JSON schemas (also :timetable :dates :locations :degree :catalog)
npm run catalog -- <dir>   # (re)write <dir>/index.json from its files
npm run skill     # schemas + public/zeiteisen-generator.zip, after editing skill/
npm run lint && npm run fmt
npm test          # vitest, `src/**/*.test.ts`, pure logic only
npm run hooks     # point git at .githooks/ (also run by npm install)
```

- Imports use the `@/` alias without extensions. Only `src/i18n.ts` imports
  `@paraglide/*`. `allowJs` stays off.
- TypeScript 7 removed `baseUrl`; if a tool (e.g. `shadcn init`) adds it back,
  delete it.

## Global UI decisions

- The redesign (user decision, a complete switch): shadcn `base-vega` (Base
  UI) with the app's own theme in `src/index.css` — OLED black / white
  grounds, neutral primary, red (`--accent-red`) as the ONE accent, blocks
  coloured by kind (`--kind-*`), never by timetable. Geist and Geist Mono
  via `@fontsource` (no CDN: the app runs offline); mono only for times,
  rooms, dates, week numbers, group numbers, file endings. Radii 6px
  (blocks, badges, tab fields), 8px (buttons, fields, menus), 10px (grid
  frame, dialogs, drawers). Buttons are ghost unless they are the main
  action.
- **No uppercase text, no boxes** (divider lines instead), **no theme
  toggle**, no counters or legends except where a number tells things apart
  ("14 of 40 picked") — user decisions, do not bring back.
- Three steps, the same content in other containers (`compact:` / `wide:`
  variants, `@/lib/media`): narrow (below 40rem: one day, panels as pages,
  tabs + week + day bar at the bottom), compact (from 40rem or a short
  landscape screen: the whole week, one header row, panels as a 380px sheet
  from the right), wide (from 64rem AND 600px height: a closable 340px
  sidebar beside the grid). Every step is one viewport tall, no page scroll;
  grid, panels and pages scroll inside themselves.
- One spacing unit around every divider: 24px (16px on phones), plus the
  safe areas.
- Dark mode and language follow the browser; the only language control is
  the tabs in the settings.
- Check every visible change at 360px and 400px, German and English, at
  1440px desktop and on a landscape phone (844×390); dark and light where
  colours are involved.

## Verifying UI changes

Headless chromium is available. Vite binds localhost, the browser shares its
network namespace:

```sh
npx vite --port 5173 --strictPort &   # in the background
web-shot -s 1440x1100 http://localhost:5173/ <scratchpad>/page.png  # then Read it
web-shot -c http://localhost:5173/    # console output only
```

- Screenshots can't click or hover: flip a `useState` default temporarily and
  restore it.
- Populated profile: a throwaway `public/_seed.html` that fetches
  `/catalog/timetables/BEI3.json`, writes `tt.profiles.v1` / `tt.active.v1`
  (and `PARAGLIDE_LOCALE`) and renders `/` in a full-size iframe (a
  `location.href` redirect hangs headless chromium with a populated profile).
  Open menus render unreliably inside that iframe: shoot `/` directly for them.
  Without `srv/catalog/` (gitignored, may be missing): a `<script
  type="module">` in the seed page can import
  `/src/lib/primitives/fixtures.test-util.ts` and `storage.ts` and
  `saveProfiles` a profile built with `subject` / `timetable` / `profile`.
- German: `localStorage.setItem("PARAGLIDE_LOCALE","de")` before loading `/`;
  after `npm run messages` restart the dev server or it has no effect.
- Dark mode: temporarily force `classList.toggle("dark", true)` in
  `theme-provider.tsx` (headless ignores color-scheme flags), or drive
  Playwright yourself with `colorScheme: "dark"`.
- Delete throwaway `public/_*.html` files afterwards.
- Stop the dev server by PID (`ps -eo pid,args | grep "[v]ite --port"`), in a
  separate Bash call from the one that started it, never with
  `pkill -f` / `pgrep -f` (the pattern matches the calling shell).
