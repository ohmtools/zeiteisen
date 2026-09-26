# scripts — notes

- `scripts/json-schema.mjs` turn the primitives' zod mirrors (`subjectsFileSchema`,
  `semesterDatesSchema`, `locationsSchema`, `abbreviationsSchema`,
  `catalogIndexSchema`, zod/mini) into classic `z.toJSONSchema` (`io: "input"`,
  works across the shared core); `jiti` load the
  TypeScript directly. Primitives import only relative paths, zod and ohash, so no
  alias and no `npm run messages` first. `schema:timetable` = a plain `Subject[]`.
- `scripts/catalog-index.mjs` (`npm run catalog -- <dir>`) walk `locations.json`,
  `dates.json` (ONE file, like locations), `abbreviations/*.json`,
  `timetables/**/*.{json,timetable}` (subdirectories allowed; `.timetable` is
  the app's own download, dropped in as is) and write `<dir>/index.json`: per file `path`, `kind`,
  8-char `hash` and file mtime as `modified` (ISO, the "last changed" the picker
  dialog show), nothing else — a timetable is named after its file. A timetable's
  hash is `subjectsHash` of its zod-parsed subjects, loaded from
  `src/lib/primitives/subject.ts` through jiti, so it is exactly what the app
  match and re-check against; every other file get `shortHash` of its parsed
  JSON. Missing subdirectory, unreadable file, a file with another extension and a
  timetable that fail the schema are skipped with a `skipped …` line on
  stderr, not fatal. Abbreviations files are checked against
  `abbreviationsSchema` (`meta.ts`, through jiti) and warned about, never
  refused: a file not matching the format, and every code (upper case, as the
  app compares) listed more than once across files or within one, naming the
  file the app will use (the last in index order, i.e. path order). The
  index is still written. Re-run after every catalog change — hash is
  what invalidate client cache. `--stdout` print instead of write. Args go
  through `node:util` `parseArgs` (strict: unknown flag or not exactly one dir
  is an error, `-h` usage). `npm run index-remote-catalog` run it on the server
  against `/home/caddy/.config/containers/srv/zeiteisen/catalog`.
- `scripts/schemas.mjs` hold the `schemas` map and `z.toJSONSchema` options,
  shared by `json-schema.mjs` and `skill.mjs`, so both write the same bytes.
- `scripts/skill.mjs` (`npm run skill`, part of `npm run build`) write the four
  `skill/timetable-generator/<kind>/schema.json` (timetable, dates, locations,
  abbreviations; git-ignored, identical to `npm run schema:<kind>`), then zip
  `skill/timetable-generator/` with `fflate` to `public/timetable-generator.zip`
  (git-ignored, precached by the PWA). One top-level `timetable-generator/`
  folder in the zip, as Claude's skill upload expects; dotfiles and
  `__pycache__` skipped; a fixed entry date, so an unchanged skill gives the
  same zip. Optional positional = other output path; `parseArgs` strict, `-h`.
  The skill's own texts live in `skill/`; edit them there and re-run.
- `scripts/og/card.mjs` (`node scripts/og/card.mjs`, by hand) write the link
  preview cards `og.svg` / `og-share.svg` from one template (favicon watch,
  mini Mo–Fr grid in the favicon's and timetable tints' reds, Inter from
  `node_modules`) and render them with `web-shot` to `public/og.png` /
  `public/og-share.png`, 1200×630, both committed. PNG because WhatsApp
  refuses SVG; keep each under 300 KB (WhatsApp's limit).
