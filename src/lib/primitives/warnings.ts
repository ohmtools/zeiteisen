import { groupName, isOverlapping, type Group, type GroupCategory, type GroupName } from "./group";
import { getSubjectKey, type Subject, type SubjectKey } from "./subject";
import { enabledSubjects, type Timetable } from "./timetable";
import { categoriesOf } from "./tree";
import { isUnclearRepeat } from "./week";

// The domain's two rules, checked against one timetable's enabled subjects: a
// student is in exactly one group per subject, and in at least one index of
// every category. Different subjects of one category may sit in different
// groups (the index is free per subject after the first vote). Nothing is ever forbidden (tinkering is the point); the
// caller only shows these. Structured, not text: the UI words them.

export const Warn = {
  EmptyCategory: "empty-category",
  MultiGroupForSubject: "multi-group-for-subject",
  NonOverlap: "non-overlap",
  NoClassForSubject: "no-class-for-subject",
  ShRange: "sh-range",
} as const;

export type Warn = (typeof Warn)[keyof typeof Warn];

export type Warning =
  // No group of the category has an enabled subject.
  | { code: typeof Warn.EmptyCategory; category: GroupCategory | null }
  // One subject has enabled classes in more than one group.
  | {
      code: typeof Warn.MultiGroupForSubject;
      key: SubjectKey;
      subject: Subject;
      groups: GroupName[];
    }
  // The single chosen groups of all categories do not share a slice.
  | { code: typeof Warn.NonOverlap; group: GroupName }
  // Every class of a subject is disabled.
  | { code: typeof Warn.NoClassForSubject; key: SubjectKey; subject: Subject }
  // An enabled SH1/SH2 subject: its date range is unknown.
  | { code: typeof Warn.ShRange };

export function warningsFor(timetable: Timetable): Warning[] {
  const { subjects } = timetable;
  const enabled = (i: number) => subjects.getExtra(i).enabled;
  const warnings: Warning[] = [];

  // Only categories with exactly one active group take part in the overlap
  // check: with several, the subjects of that category picked their groups
  // freely, and no single slice stands for the category.
  const chosen: Group[] = [];
  for (const { category, groups } of categoriesOf(subjects)) {
    const active = groups.filter((g) => g.indexes.some(enabled));
    if (active.length === 0) {
      warnings.push({ code: Warn.EmptyCategory, category });
    } else if (active.length === 1 && active[0].group) {
      chosen.push(active[0].group);
    }
  }

  const [overlaps, blame] = isOverlapping(chosen);
  if (!overlaps) warnings.push({ code: Warn.NonOverlap, group: blame });

  // Per subject: whether any class is enabled, and the groups of those that are.
  const keys = new Map<SubjectKey, { subject: Subject; covered: boolean; groups: Group[] }>();
  subjects.forEach((subject, extra) => {
    const key = getSubjectKey(subject);
    const seen = keys.get(key) ?? { subject, covered: false, groups: [] };
    seen.covered ||= extra.enabled;
    const group = subject.group;
    if (
      extra.enabled &&
      group &&
      !seen.groups.some((g) => g.category === group.category && g.index === group.index)
    ) {
      seen.groups.push(group);
    }
    keys.set(key, seen);
  });
  for (const [key, { subject, covered, groups }] of keys) {
    if (!covered) warnings.push({ code: Warn.NoClassForSubject, key, subject });
    if (groups.length > 1) {
      warnings.push({
        code: Warn.MultiGroupForSubject,
        key,
        subject,
        groups: groups.sort((a, b) => a.category - b.category || a.index - b.index).map(groupName),
      });
    }
  }

  if (enabledSubjects(timetable).some(({ subject }) => isUnclearRepeat(subject.repeat))) {
    warnings.push({ code: Warn.ShRange });
  }

  return warnings;
}
