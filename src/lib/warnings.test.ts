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

const noClass = (name: string): Warning => ({
  code: Warn.NoClassForSubject,
  key: `${name}:SU`,
  subject: subject(name),
});

it("says each kind of warning once, where its first one stood", () => {
  const lines = warningLines([
    { code: Warn.EmptyCategory, category: 3 },
    multi("M1", ["10.1", "10.2"]),
    noClass("PH"),
    multi("M2", ["2.1", "2.2"]),
    { code: Warn.EmptyCategory, category: 6 },
    noClass("DT"),
    multi("M3", ["10.10", "10.2", "10.3"]),
    noClass("IN"),
    { code: Warn.EmptyCategory, category: 12 },
  ]);
  expect(lines.map((line) => line.text)).toEqual([
    "No group selected for categories “3”, “6”, and “12”.",
    "More than one group selected for “M1 (SU)”, “M2 (SU)”, and “M3 (SU)”: 10.1, 10.2, 10.3, 10.10; 2.1, 2.2.",
    "No class selected for “PH (SU)”, “DT (SU)”, and “IN (SU)”.",
  ]);
  expect(new Set(lines.map((line) => line.key)).size).toBe(lines.length);
});

it("names a single category or subject alone", () => {
  const lines = warningLines([{ code: Warn.EmptyCategory, category: 3 }, noClass("PH")]);
  expect(lines.map((line) => line.text)).toEqual([
    "No group selected for category “3”.",
    "No class selected for “PH (SU)”.",
  ]);
});
