# scripts — notes

- `scripts/json-schema.mjs` turn the primitives' zod mirrors (`subjectsFileSchema`,
  `semesterDatesSchema`, `locationsSchema`, `abbreviationsSchema`,
  `catalogIndexSchema`, zod/mini) into classic `z.toJSONSchema` (`io: "input"`,
  works across the shared core); `jiti` load the
  TypeScript directly. Primitives import only relative paths, zod and ohash, so no
  alias and no `npm run messages` first. `schema:timetable` = a plain `Subject[]`.
- `scripts/catalog-index.mjs` (`npm run catalog -- <dir>`) walk `locations.json`,
  `dates.json` (ONE file, like locations), `abbreviations/`, `timetables/**`
  (subdirectories allowed) and write `<dir>/index.json`: per file `path`, `kind`,
  8-char `hash` and file mtime as `modified` (ISO, the "last changed" the picker
  dialog show), nothing else — a timetable is named after its file. A timetable's
  hash is `subjectsHash` of its zod-parsed subjects, loaded from
  `src/lib/primitives/subject.ts` through jiti, so it is exactly what the app
  match and re-check against; every other file get `shortHash` of its parsed
  JSON. Missing subdirectory, unreadable file and a timetable that fail the
  schema are skipped, not fatal. Re-run after every catalog change — hash is
  what invalidate client cache. `--stdout` print instead of write. Args go
  through `node:util` `parseArgs` (strict: unknown flag or not exactly one dir
  is an error, `-h` usage). `npm run index-remote-catalog` run it on the server
  against `/home/caddy/.config/containers/srv/zeiteisen/catalog`.
