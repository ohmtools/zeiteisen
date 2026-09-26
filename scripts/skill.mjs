// Packs the AI skill in skill/zeiteisen-generator/ into the zip the app offers
// for download (Data menu, timetable picker).
//
// Usage: npm run skill [-- <out.zip>]   default public/zeiteisen-generator.zip
//
// First writes <kind>/schema.json for the four upload formats, generated from
// the primitives exactly like `npm run schema:<kind>`, so the skill never
// describes a format the app no longer accepts. Then zips the folder with
// `zeiteisen-generator/` as the one top-level entry, the shape Claude's skill
// upload expects. Every entry gets the same fixed date, so an unchanged skill
// gives a byte-identical zip.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { zipSync } from "fflate";
import { schemaText } from "./schemas.mjs";

const usage = "usage: npm run skill [-- <out.zip>]\n";
const name = "zeiteisen-generator";
const root = path.join(import.meta.dirname, "..");
const source = path.join(root, "skill", name);
const kinds = ["timetable", "dates", "locations", "degreeinformation"];

let options;
try {
  options = parseArgs({
    allowPositionals: true,
    options: { help: { type: "boolean", short: "h" } },
  });
} catch (error) {
  process.stderr.write(`${error.message}\n${usage}`);
  process.exit(1);
}
if (options.values.help) {
  process.stdout.write(usage);
  process.exit(0);
}
if (options.positionals.length > 1) {
  process.stderr.write(usage);
  process.exit(1);
}
const out = options.positionals[0] ?? path.join(root, "public", `${name}.zip`);

for (const kind of kinds) {
  await mkdir(path.join(source, kind), { recursive: true });
  await writeFile(path.join(source, kind, "schema.json"), schemaText(kind));
}

// Every file below the skill folder, as zip paths; dotfiles and Python caches
// never go in.
async function collect(dir, prefix) {
  const files = {};
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "__pycache__") continue;
    const full = path.join(dir, entry.name);
    const zipped = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) Object.assign(files, await collect(full, zipped));
    else if (entry.isFile()) files[zipped] = new Uint8Array(await readFile(full));
  }
  return files;
}

const files = await collect(source, name);
const zip = zipSync(files, { level: 9, mtime: new Date(2000, 0, 1) });
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, zip);
process.stdout.write(
  `wrote ${path.relative(process.cwd(), out)} (${Object.keys(files).length} files, ${(zip.length / 1024).toFixed(1)} KB)\n`,
);
