import { m } from "@/i18n";
import { cleanName, FORBIDDEN_CHARS, nameProblem, uniqueNames } from "@/lib/primitives/name";

// The words for why a typed profile or timetable name cannot be a file name
// (`nameProblem`), `null` when it can. An empty name gets no words here: the
// dialogs just disable their button, the tree rename says so itself.
export function nameProblemText(name: string): string | null {
  switch (nameProblem(name)) {
    case null:
    case "empty":
      return null;
    case "chars":
      return m.name_invalid_chars({ chars: FORBIDDEN_CHARS });
    case "end":
      return m.name_invalid_end();
    case "reserved":
      return m.name_invalid_reserved({ name });
    case "long":
      return m.name_invalid_long();
  }
}

// A timetable name that did not come from the keyboard (a file name, the
// catalog, another profile's copy, a stored name), made file-safe.
export function cleanTimetableName(name: string): string {
  return cleanName(name, m.timetable_default_name());
}

// A profile's timetables with file-safe names, still unique in it: "a:b" next
// to "a-b" becomes "a-b 2".
export function withCleanNames<T extends { name: string }>(timetables: readonly T[]): T[] {
  const names = uniqueNames(
    [],
    timetables.map((timetable) => cleanTimetableName(timetable.name)),
  );
  return timetables.map((timetable, i) =>
    names[i] === timetable.name ? timetable : { ...timetable, name: names[i] },
  );
}
