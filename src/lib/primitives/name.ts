// Profile and timetable names become file names (`<name>.profile`,
// `<name>.timetable`, `<name>.ics`) and file names become names again on
// upload, so every name is one that saves as a file on Windows, Linux, Android
// and iOS alike. Windows (and Android's FAT storage) is the strictest, so its
// rules are the rules: forbidden characters, trailing dots, device names, and
// names that differ only in case or Unicode form are the same file.

// Forbidden on Windows / FAT, plus every control character.
// oxlint-disable-next-line no-control-regex
const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f\u007f]/u;
// oxlint-disable-next-line no-control-regex
const FORBIDDEN_RUNS = /[<>:"/\\|?*\u0000-\u001f\u007f]+/gu;

// The characters `nameProblem` refuses as "chars", for the message.
export const FORBIDDEN_CHARS = '< > : " / \\ | ? *';

// Device names Windows refuses as a file name, with any extension too
// ("CON.profile"), in any case.
const RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])$/iu;

// 255 bytes is the file name limit (ext4, UTF-8); the longest extension the
// app appends, ".timetable", leaves this much for the name.
export const MAX_NAME_BYTES = 245;

export type NameProblem = "empty" | "chars" | "end" | "reserved" | "long";

const bytes = (text: string) => new TextEncoder().encode(text).length;

// `text` cut to at most `max` UTF-8 bytes, by code point, so a character is
// never cut in half.
function cutToBytes(text: string, max: number): string {
  if (bytes(text) <= max) return text;
  let kept = "";
  let size = 0;
  for (const char of text) {
    size += bytes(char);
    if (size > max) break;
    kept += char;
  }
  return kept;
}

function isReserved(name: string): boolean {
  return RESERVED.test(name.split(".")[0].trimEnd());
}

// A typed name as the app stores it: NFC (macOS and iOS hand out decomposed
// "ä" in file names), no surrounding spaces.
export function normalizeName(name: string): string {
  return name.normalize("NFC").trim();
}

// What makes two names the same file: case and Unicode form do not count.
function nameKey(name: string): string {
  return name.normalize("NFC").toLowerCase();
}

// Whether two names would be the same file, i.e. clash as names.
export function sameName(a: string, b: string): boolean {
  return nameKey(a) === nameKey(b);
}

// Why `name` (normalized by the caller, `normalizeName`) cannot be a file
// name, `null` when it can. Checked in this order, so the first thing to fix
// comes first.
export function nameProblem(name: string): NameProblem | null {
  if (!name) return "empty";
  if (FORBIDDEN.test(name)) return "chars";
  if (/[. ]$/u.test(name)) return "end";
  if (isReserved(name)) return "reserved";
  if (bytes(name) > MAX_NAME_BYTES) return "long";
  return null;
}

// Any name made into one `nameProblem` accepts, changing as little as
// possible: NFC, forbidden runs become "-", trailing dots and spaces go, a
// reserved name gets a "_", an overlong one is cut. `fallback` when nothing is
// left. A valid name comes back unchanged.
export function cleanName(name: string, fallback: string): string {
  let clean = name.normalize("NFC").replace(FORBIDDEN_RUNS, "-").trim();
  const trimEnd = () => {
    clean = clean.replace(/[. ]+$/u, "");
  };
  trimEnd();
  if (isReserved(clean)) clean = clean.replace(/^[^.]*/u, (stem) => stem.trimEnd() + "_");
  if (bytes(clean) > MAX_NAME_BYTES) {
    clean = cutToBytes(clean, MAX_NAME_BYTES);
    trimEnd();
  }
  return clean || fallback;
}

// "Name", "Name 2", "Name 3", … — the first one not taken yet, in any case
// (`sameName`). Profile names are unique on the device, timetable names within
// one profile. A name close to `MAX_NAME_BYTES` gives up its end for the
// number, so the numbered one is still a valid file name.
export function uniqueName(taken: Iterable<string>, wanted: string): string {
  const names = new Set([...taken].map(nameKey));
  if (!names.has(nameKey(wanted))) return wanted;
  for (let i = 2; ; i++) {
    const suffix = ` ${i}`;
    const candidate = cutToBytes(wanted, MAX_NAME_BYTES - bytes(suffix)) + suffix;
    if (!names.has(nameKey(candidate))) return candidate;
  }
}

// `uniqueName` for several names landing in one place, in order: each takes
// its own name or the next free "Name 2", and every later one sees it taken.
export function uniqueNames(taken: Iterable<string>, wanted: readonly string[]): string[] {
  const names = [...taken];
  return wanted.map((one) => {
    const name = uniqueName(names, one);
    names.push(name);
    return name;
  });
}

// The one order of names in the app's lists: numbers compare as numbers, so
// "BEI10" follows "BEI9", and case does not matter.
export function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

// The name a file gives what it holds: "semester/BEI3.json" -> "BEI3". Local
// timetable uploads (`.timetable`), profile files (`.profile`) and catalog
// timetables (`.json`) are named this way.
const FILE_EXTENSIONS = [".timetable", ".profile", ".json"];

export function nameFromFile(path: string): string {
  const file = path.slice(path.lastIndexOf("/") + 1);
  const extension = FILE_EXTENSIONS.find((one) => file.endsWith(one));
  return extension ? file.slice(0, -extension.length) : file;
}
