import { serialize } from "ohash";
import type { Subject } from "./subject";

// What an update changes, for the update dialog. Subjects are compared in
// every field, so a class whose time, room or repeat changed shows up as one
// removed and one added subject — exactly what the user has to see. Identical
// subjects pair up one to one.

export type SubjectsDiff = {
  added: Subject[];
  removed: Subject[];
  // Subjects both versions share, unchanged.
  sameCount: number;
};

export function diffSubjects(before: readonly Subject[], after: readonly Subject[]): SubjectsDiff {
  const left = new Map<string, Subject[]>();
  for (const subject of before) {
    const key = serialize(subject);
    left.set(key, [...(left.get(key) ?? []), subject]);
  }

  const added: Subject[] = [];
  let sameCount = 0;
  for (const subject of after) {
    const matches = left.get(serialize(subject));
    if (matches?.length) {
      matches.pop();
      sameCount++;
    } else {
      added.push(subject);
    }
  }

  return { added, removed: [...left.values()].flat(), sameCount };
}
