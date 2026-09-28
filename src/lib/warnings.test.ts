import { expect, it } from "vitest";
import { subject } from "@/lib/primitives/fixtures.test-util";
import { Warn, type Warning } from "@/lib/primitives/warnings";
import { warningLines } from "@/lib/warnings";

const multi = (name: string, groups: string[]): Warning => ({
  code: Warn.MultiGroupForSubject,
  key: `${name}:SU`,
  subject: subject(name),
  groups,
});

it("says more than one group once per category, where its first subject stood", () => {
  const lines = warningLines([
    { code: Warn.EmptyCategory, category: 3 },
    multi("M1", ["10.1", "10.2"]),
    { code: Warn.NoClassForSubject, key: "PH:SU", subject: subject("PH") },
    multi("M2", ["2.1", "2.2"]),
    multi("M3", ["10.10", "10.2", "10.3"]),
  ]);
  expect(lines.map((line) => line.text)).toEqual([
    "No group selected in category 3.",
    "More than one group selected in category 10 for M1 (SU), M3 (SU): 10.1, 10.2, 10.3, 10.10.",
    "No class selected for PH (SU).",
    "More than one group selected in category 2 for M2 (SU): 2.1, 2.2.",
  ]);
  expect(new Set(lines.map((line) => line.key)).size).toBe(lines.length);
});
