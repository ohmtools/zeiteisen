# scripts — notes

- `scripts/json-schema.mjs` turn the primitives' zod mirrors (`subjectsFileSchema`,
  `semesterDatesSchema`, `locationsSchema`, `degreeSchema`,
  `catalogIndexSchema`, zod/mini) into classic `z.toJSONSchema` (`io: "input"`,
  works across the shared core); `jiti` load the
  TypeScript directly. Primitives import only relative paths, zod and ohash, so no
  alias and no `npm run messages` first. `schema:timetable` = a plain `Subject[]`.
- `scripts/catalog-index.mjs` (`npm run catalog -- <dir>`) walk `locations.json`,
  `dates.json` (ONE file, like locations), `degrees/*.degree` (FLAT: a
  subdirectory of `degrees/` is the one hard error — nothing is written, exit
  1 — since a subject names its degree file by its bare name),
  `timetables/**/*.{json,timetable}` (subdirectories allowed; `.timetable` is
  the app's own download, dropped in as is) and write `<dir>/index.json`: per file `path`, `kind`,
  8-char `hash` and file mtime as `modified` (ISO, the "last changed" the picker
  dialog show), nothing else — a timetable is named after its file. A timetable's
  hash is `subjectsHash` of its zod-parsed subjects, loaded from
  `src/lib/primitives/subject.ts` through jiti, so it is exactly what the app
  match and re-check against; every other file get `shortHash` of its parsed
  JSON. Missing subdirectory, unreadable file, a file with another extension and a
  timetable that fail the schema are skipped with a `skipped …` line on
  stderr, not fatal. Degree files are checked against
  `degreeSchema` (`meta.ts`, through jiti) and warned about, never
  refused: a file not matching the format, a timetable subject whose
  `degreeProgram` names no `degrees/<name>.degree` (or a skipped or broken
  one, said so), and one whose code (or the part before its last slash, with
  something after it, like `splitVariant`) is not in that file. Files are never merged, so a
  code in several files is fine. The index is still written. Every path segment is checked against `nameProblem`
  (`src/lib/primitives/name.ts`, through jiti) and a timetable whose file name the
  app would clean gets the name it will show; warnings, never refusals. Re-run after every catalog change — hash is
  what invalidate client cache. `--stdout` print instead of write. Args go
  through `node:util` `parseArgs` (strict: unknown flag or not exactly one dir
  is an error, `-h` usage). `npm run catalog-remote` run it on the server
  against `/home/caddy/.config/containers/srv/zeiteisen/catalog`.
- `scripts/schemas.mjs` hold the `schemas` map and `z.toJSONSchema` options,
  shared by `json-schema.mjs` and `skill.mjs`, so both write the same bytes.
- `scripts/skill.mjs` (`npm run skill`, part of `npm run build`) write the four
  `skill/zeiteisen-generator/<kind>/schema.json` (timetable, dates, locations,
  degree; git-ignored, identical to `npm run schema:<kind>`), then zip
  `skill/zeiteisen-generator/` with `fflate` to `public/zeiteisen-generator.zip`
  (git-ignored, precached by the PWA). One top-level `zeiteisen-generator/`
  folder in the zip, as Claude's skill upload expects; dotfiles and
  `__pycache__` skipped; a fixed entry date, so an unchanged skill gives the
  same zip. Optional positional = other output path; `parseArgs` strict, `-h`.
  The skill's own texts live in `skill/`; edit them there and re-run.
- `scripts/app-icons.mjs` (`node scripts/app-icons.mjs`, by hand after a
  logo change) renders `public/logo.svg` to the app icons, all committed:
  `apple-touch-icon.png` 180×180 full-bleed (square backdrop, no rim: iOS
  rounds corners itself and paints transparency black; `index.html` links it,
  iOS never reads the manifest's icons), `icon-192.png` / `icon-512.png` as
  drawn with transparent corners (the manifest's PNGs next to the SVG, for
  Android browsers that take no SVG) and `icon-maskable-512.png` full-bleed
  (Android crops to its own shape; without it, the icon shrinks onto a white
  plate). The watch stays inside the maskable safe zone (circle of 40%
  radius) as drawn: check that after a logo change. The service worker skips
  all four (read once, at install).
- `scripts/og/card.mjs` (`node scripts/og/card.mjs`, by hand) write the link
  preview cards `og.svg` / `og-share.svg` from one template (favicon watch,
  mini Mo–Fr grid in the favicon's and timetable tints' reds, Inter from
  `node_modules`) and render them with `web-shot` to `public/og.png` /
  `public/og-share.png`, 1200×630, both committed. PNG because WhatsApp
  refuses SVG; keep each under 300 KB (WhatsApp's limit).
- `scripts/bump-version.mjs`, run by `.githooks/pre-commit` (`npm install`
  points `core.hooksPath` there through `prepare` → `npm run hooks`): bumps
  the patch version in `package.json` and `package-lock.json` on every commit
  whose staged `package.json` version equals HEAD's, so the version `Brand`
  shows tells deploys apart (user decision). A version changed by hand is
  kept, and the lockfile is synced to it. The staged and working copies are
  rewritten separately (index blob via `update-index --cacheinfo`), so
  unstaged edits stay unstaged. `--amend` (read from the parent `git commit`
  process: `/proc`, else `ps`) compares against `HEAD~1`, or every amend
  would bump again. `git commit <paths>` commits from a temporary
  `next-index-*.lock`; `index.lock`, the real index afterwards, gets the
  bump too, or the index ends up a version behind HEAD. The first commit,
  `SKIP_VERSION_BUMP=1` and `--no-verify` skip it; a version that is not
  `major.minor.patch` is warned about and left alone.
