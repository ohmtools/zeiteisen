import { serialize } from "ohash";
import { getSubjectID, type Repeat, type Subject } from "./subject";

// What an update changes, for the update dialog. Subjects are compared in
// every field first; identical subjects pair up one to one. Of the rest, a
// removed and an added subject with the same `SubjectID` (name, kinds,
// group) are one changed class — but only where that pair is unique: the ID
// names a class, not an entry (BEI3 lists ELK1:SU:2.1 twice), so two or more
// candidates on a side stay removed and added, exactly what the user has to
// see then.

// What differs between the two versions of a changed class.
export type SubjectField =
  | "repeat"
  | "day"
  | "time"
  | "location"
  | "professor"
  | "dates"
  | "note"
  | "onDemand"
  | "degreeProgram";

export type SubjectChange = { before: Subject; after: Subject; fields: SubjectField[] };

export type SubjectsDiff = {
  added: Subject[];
  removed: Subject[];
  changed: SubjectChange[];
  // Subjects both versions share, unchanged.
  sameCount: number;
};

function repeatFields(a: Repeat, b: Repeat): SubjectField[] {
  if (a.type !== b.type && (a.type === "I" || b.type === "I")) return ["repeat"];
  if (a.type === "I" || b.type === "I") {
    return serialize(a) === serialize(b) ? [] : ["dates"];
  }
  const fields: SubjectField[] = [];
  if (a.type !== b.type) fields.push("repeat");
  if (a.day !== b.day) fields.push("day");
  if (serialize([a.startTime, a.endTime]) !== serialize([b.startTime, b.endTime])) {
    fields.push("time");
  }
  if (a.location !== b.location) fields.push("location");
  if (a.professor !== b.professor) fields.push("professor");
  return fields;
}

// The fields two versions of one class differ in, in the order the dialog
// names them.
export function changedFields(before: Subject, after: Subject): SubjectField[] {
  const fields = repeatFields(before.repeat, after.repeat);
  if ((before.note ?? "") !== (after.note ?? "")) fields.push("note");
  if (before.onDemand !== after.onDemand) fields.push("onDemand");
  if ((before.degreeProgram ?? "") !== (after.degreeProgram ?? "")) fields.push("degreeProgram");
  return fields;
}

function byId(subjects: readonly Subject[]): Map<string, Subject[]> {
  const groups = new Map<string, Subject[]>();
  for (const subject of subjects) {
    const id = getSubjectID(subject);
    groups.set(id, [...(groups.get(id) ?? []), subject]);
  }
  return groups;
}

export function diffSubjects(before: readonly Subject[], after: readonly Subject[]): SubjectsDiff {
  const left = new Map<string, Subject[]>();
  for (const subject of before) {
    const key = serialize(subject);
    left.set(key, [...(left.get(key) ?? []), subject]);
  }

  const fresh: Subject[] = [];
  let sameCount = 0;
  for (const subject of after) {
    const matches = left.get(serialize(subject));
    if (matches?.length) {
      matches.pop();
      sameCount++;
    } else {
      fresh.push(subject);
    }
  }
  const gone = [...left.values()].flat();

  // Unique pairs by `SubjectID` become changes, in the order the new version
  // lists them.
  const goneById = byId(gone);
  const freshById = byId(fresh);
  const paired = new Set<Subject>();
  const changed: SubjectChange[] = [];
  for (const subject of fresh) {
    const id = getSubjectID(subject);
    const was = goneById.get(id);
    if (freshById.get(id)?.length !== 1 || was?.length !== 1) continue;
    paired.add(subject).add(was[0]);
    // Differing only in a way the dialog cannot name (an empty note against
    // none): unchanged, not a change without lines.
    const fields = changedFields(was[0], subject);
    if (fields.length === 0) sameCount++;
    else changed.push({ before: was[0], after: subject, fields });
  }

  return {
    added: fresh.filter((subject) => !paired.has(subject)),
    removed: gone.filter((subject) => !paired.has(subject)),
    changed,
    sameCount,
  };
}
