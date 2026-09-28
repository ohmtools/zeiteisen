import { sameName } from "@/lib/primitives/name";
import type { OwnDegreeFile } from "@/lib/primitives/storage";

// The own files after adding `added`: one held under the same name, in any
// case, is replaced; the added ones go last, in upload order.
export function withOwnDegrees(
  held: readonly OwnDegreeFile[],
  added: readonly OwnDegreeFile[],
): OwnDegreeFile[] {
  return [...held.filter((own) => !added.some((file) => sameName(file.name, own.name))), ...added];
}
