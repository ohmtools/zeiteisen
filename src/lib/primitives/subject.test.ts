import { expect, test } from "vitest";
import { dated, subject } from "./fixtures.test-util";
import {
  HASH_LENGTH,
  isDuplicate,
  sameSubject,
  subjectSchema,
  Subjects,
  subjectsHash,
} from "./subject";

// Every hash a link, `rejected` or the catalog index holds depends on ohash's
// `serialize`. A changed value here means an ohash upgrade broke them all.
test("subjectsHash is 8 characters, order-independent and stable", () => {
  const a = subject("A");
  const b = subject("B", { group: { category: 2, index: 1 } });
  expect(subjectsHash([a, b])).toHaveLength(HASH_LENGTH);
  expect(subjectsHash([a, b])).toBe(subjectsHash([b, a]));
  expect(subjectsHash([a, b])).toMatchInlineSnapshot(`"mzxJ4p-m"`);
});

// ohash keeps array order, so the schema stores listed dates sorted and
// without duplicates: the same dates in another order are the same content.
test("subjectSchema stores listed dates in one canonical order", () => {
  const parse = (...dates: string[]) =>
    subjectSchema.parse(subject("D", { repeat: dated(...dates) }));
  const sorted = parse("2026-10-05", "2026-10-12");
  expect(parse("2026-10-12", "2026-10-05", "2026-10-12")).toEqual(sorted);
  expect(subjectsHash([parse("2026-10-12", "2026-10-05")])).toBe(subjectsHash([sorted]));
  expect(subjectSchema.safeParse(subject("D", { repeat: dated("2026-13-01") })).success).toBe(
    false,
  );
  expect(subjectSchema.safeParse(subject("D", { repeat: dated() })).success).toBe(false);
});

test("isDuplicate finds the same subject elsewhere, never the one being edited", () => {
  const subjects = Subjects.fromSubjects([subject("M1"), subject("PH")], () => ({}));
  expect(isDuplicate(subjects, subject("M1"))).toBe(true);
  expect(isDuplicate(subjects, subject("M1"), 0)).toBe(false);
  expect(isDuplicate(subjects, subject("M1"), 1)).toBe(true);
  expect(isDuplicate(subjects, subject("M2"))).toBe(false);
  expect(sameSubject(subject("M1"), subject("M1", { note: "x" }))).toBe(false);
});

test("a slot must end after it starts, weekly and dated alike", () => {
  const weekly = subject("A");
  const backwards = { ...weekly.repeat, endTime: { hour: 8, minute: 0 } };
  expect(subjectSchema.safeParse(weekly).success).toBe(true);
  const refused = subjectSchema.safeParse({ ...weekly, repeat: backwards });
  expect(refused.success).toBe(false);
  expect(refused.error?.issues[0].path).toEqual(["repeat", "endTime"]);

  const once = dated("2026-10-05");
  if (once.type !== "I") throw new Error("dated fixture");
  const [slot] = once.dates;
  const late = { ...once, dates: [{ ...slot, startTime: { hour: 10, minute: 0 } }] };
  expect(subjectSchema.safeParse({ ...weekly, repeat: late }).success).toBe(false);
});
