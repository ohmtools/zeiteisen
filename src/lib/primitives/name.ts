// "Name", "Name 2", "Name 3", … — the first one not taken yet. Profile names are
// unique on the device, timetable names within one profile.
export function uniqueName(taken: Iterable<string>, wanted: string): string {
  const names = new Set(taken);
  if (!names.has(wanted)) return wanted;
  for (let i = 2; ; i++) {
    const candidate = `${wanted} ${i}`;
    if (!names.has(candidate)) return candidate;
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
