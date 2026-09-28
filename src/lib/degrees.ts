import { m } from "@/i18n";
import { nameProblemText } from "@/lib/names";
import { normalizeName, sameName } from "@/lib/primitives/name";
import type { OwnDegreeFile } from "@/lib/primitives/storage";

// Names of own degree files follow the app's name rule: a name is taken in any
// case and Unicode form (`sameName`), as for every name that is a file name.
// Subjects look their degree file up by its exact spelling, so a name that
// matches a catalog file in another case takes the catalog's spelling: it
// replaces that file, as the user meant, instead of missing it.

export type DegreeName = {
  // What the file is stored under.
  name: string;
  // Why it cannot be stored (worded), `null` when it can. An empty name gets
  // no words: the dialog disables its button.
  problem: string | null;
  // What loading it replaces: an own file of that name, else a catalog file.
  replaces: "own" | "catalog" | null;
};

// The names typed in the degree names dialog, one per picked file, checked
// against each other, the own files held and the catalog's files.
export function degreeNames(
  typed: readonly string[],
  held: readonly OwnDegreeFile[],
  catalog: readonly string[],
): DegreeName[] {
  const normalized = typed.map(normalizeName);
  return normalized.map((name, i) => {
    const repeated = normalized.findIndex((other) => sameName(other, name)) !== i;
    const catalogName = catalog.find((program) => sameName(program, name));
    return {
      name: catalogName ?? name,
      problem: nameProblemText(name) ?? (repeated ? m.degree_name_duplicate() : null),
      replaces: held.some((own) => sameName(own.name, name))
        ? "own"
        : catalogName !== undefined
          ? "catalog"
          : null,
    };
  });
}
