# src — notes

- `src/lib/primitives/` is the model (own `NOTES.md`, edit only with
  permission). Everything else is glue: hooks own state, components render,
  `src/lib/*` words and wires. No second model — import types from
  primitives.
- **First paint = the shell and the grid.** `App.tsx` statically imports
  the design's shell (`AppShell`, `Views`, `ViewControls`, `Panel` with its
  compact sheet, the toaster; the drawer behind the week picker's `Popup`)
  plus header, week nav, week filter, day bar, grid, the state hooks and
  what they need. User decision (2026-10-25): the design's groups load
  their drawer and dialog code with them, that is fine — the first load
  should not become unpleasantly long, but no contortions to keep a
  container out of it (2026-10-25: 208 -> 238 KB gzip). One cheap rule
  stays: code in the first load takes a popup's own component
  (`ResponsivePopover` in `WeekNav`), not `Popup`, which brings every kind
  (menu, select, dialogs: 25 KB gzip). What the containers show stays
  deferred: the
  panels' bodies (groups, notes and their header buttons), the settings,
  the profile menu, the details' sheet, the dialogs come from ONE deferred
  chunk: `components/deferred.ts` re-exports them and App takes each through
  `lazyDeferred` (same `import()`). Never plain `lazy()` for it: that
  suspends on a component's first render even when the chunk came long ago,
  and React then holds the content back ~300 ms after the fallback; every
  panel, sheet and drawer opened for the first time hung that long.
  `lazyDeferred` answers synchronously once the chunk is in. Anything new
  that is not the shell or the grid goes behind that import. Fallbacks never
  shift the layout (panel bodies: `null` under the panel's header, the
  sidebar keeps its width; the profile menu: a disabled look-alike trigger).
  `vite.config.ts` names only a `react` chunk group, no catch-all `vendor`,
  so `ics` and `react-day-picker` stay next to their only user.
- A new version is offered, never forced (`registerType: "prompt"`, like
  faltung): `UpdatePrompt` (deferred chunk) registers the service worker and
  shows a toast "A new version is available" with "Reload" that stays until
  used or wiped away; the new worker waits until then, so an open tab keeps
  the files it started with. Besides the browser's own check on every start,
  it asks again when the page becomes visible or stays open, at most once an
  hour. Should a chunk still go missing (the user cleared the caches, or a
  tab from before this), `main.tsx` reloads on `vite:preloadError` (at most
  once a minute), and `ErrorBoundary` around App shows a reload button
  instead of a blank page if that is not enough, with backup and "Delete
  data…" from the deferred chunk below it (`components/NOTES.md`). Its
  reload lets a waiting new version take over first: a plain reload would
  start the failed one again.
- The first load is what the grid waits for: check it after touching anything
  App or `main.tsx` import statically — `vite build`, then add up the
  scripts, `modulepreload`s and stylesheet `dist/index.html` names (gzip).
  `week.ts` writes ISO days by hand (`isoDay`) because date-fns' `format`
  alone brought ~4 KB gzip of formatter and locale into it.
- The first render's CPU time matters as much (measured with a populated
  profile at 6x CPU throttle; a phone is that slow). Nothing App or the grid
  renders at startup may hash timetables (`Subjects.hash()` is an ohash over
  every subject, uncached on purpose; user decision: no hash cache, here or in
  primitives — keep hashing off the startup path instead): the picker builds
  its rows only while shown, the share link and the outside-catalog list live
  in the deferred chunk or are computed on click. Per-block component cost multiplies by
  hundreds of blocks (hence one grid popup, `components/NOTES.md`). The Debug
  info (`src/lib/NOTES.md`) shows these timings on a real device.
- "Now" is `useNow()` (state, ticks every minute), never `new Date()` in
  render: the React Compiler caches that forever. No function called during
  render may be named `use…` unless it is a hook: the compiler then skips the
  whole component, silently (App was, over `useCatalogDates`).
- `App.tsx` holds shell state: view, week filter, week, the phone's day, the
  open panel and category view, tree ↔ grid highlight and jump, and which of
  its dialogs is open (picker, update, import, subject info, subject editor).
  Dialogs sit outside the panels because they belong to no section, and
  the import one must work before a profile holds anything. A link opened
  directly is read on the first render; `useStripSharedUrl` strips the URL when the
  import dialog closes (import or cancel), so a reload keeps the link; a link
  some profile already shares exactly opens no dialog.
- Toasts only through the design's `@/lib/ohmtools/toast` (sonner's
  `toast`), never `sonner` directly. A toast fired before `AppShell`'s
  toaster subscribed is replayed by sonner, so the state hooks may toast
  from the first render on.
- `src/index.css` imports the design's stylesheet
  (`src/styles/ohmtools.css`: shadcn's CSS with the theme, kind colours, red
  accent, warning, grid lines, Geist, the `compact`, `wide` and `short`
  variants, `popup-glass`, the view transitions and the reduced-motion
  rule) and adds zeiteisen's own CSS below it (none yet).
- Tests sit beside their module, pure logic only (no component tests), and
  reuse `primitives/fixtures.test-util.ts`. `src/test-setup.ts` stubs
  `localStorage` because paraglide reads the locale from it.
- `src/i18n.ts` is the ONLY importer of paraglide; components do
  `import { m } from "@/i18n"`. `localized()` picks a `{ de, en }` value from
  catalog / dates files, never a message.
- A page keeps the locale it started with: `src/i18n.ts` overwrites
  paraglide's `getLocale` with the first answer, because paraglide otherwise
  re-reads localStorage on every message (thousands per full grid render). It
  is safe only because every locale change reloads: `setLocale`, another tab's
  switch (`followLocaleOfOtherTabs`, from `main.tsx`, which compares with
  paraglide's own uncached resolver), a restored backup and "Delete data…".
  Anything new that changes the locale without a reload breaks this.
- A `{count}` that can be 1 is a plural variant (`declarations`,
  `countPlural=one` / `other`, see `picker_added`), not a second message.
- A profile or timetable name inside a sentence is quoted in the message
  itself (en “…”, de „…“); not in titles, button labels or file names
  (`update_title`, `share_warning_download`) — user decision.
- `generated/paraglide/` is generated and gitignored, outside `src/` because
  `src/` is TypeScript only; `.d.ts` are emitted so `allowJs` stays off. The
  `@paraglide/*` alias lives in `tsconfig.app.json`, `vite.config.ts` and
  `vitest.config.ts` — change all three together.
- `npm run messages` (CLI) compiles with the default locale strategy (cookie
  first), the vite plugin with `localStorage` first: restart a running dev
  server after the CLI, or the `PARAGLIDE_LOCALE` trick for German
  screenshots does nothing.
- Link preview card (WhatsApp, Discord): static Open Graph tags in
  `index.html`, image `public/og.png` (German only: one card per URL, so it
  can't follow the viewer's language — user decision). Share links open on
  `/s/#…`, whose `dist/s/index.html` the `og-share` plugin in
  `vite.config.ts` writes at build time with the "Stundenplan geteilt" card
  (`public/og-share.png`). A card showing the _shared_ timetable is
  impossible: the state is in the fragment, which no server or crawler ever
  sees, and rendering per link would need a backend. Absolute URLs come from
  `VITE_SITE_URL` (`.env`); empty = no preview image, the build warns. The
  container image builds with the placeholder `__SITE_URL__` instead and
  `container-start.sh` fills in `SITE_URL` on every start (user decision: one
  image for any domain); the `Containerfile` fails if a file other than the
  two `index.html` gets the placeholder. The
  PNGs are marketing, own colours allowed; source `scripts/og/`. They are
  kept out of the service worker precache. The dev server needs nothing for
  `/s/`: Vite's SPA fallback serves `index.html`.
