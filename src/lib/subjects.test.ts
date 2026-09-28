import { expect, it } from "vitest";
import type { Overrides } from "@/lib/primitives/overrides";
import { subjectName } from "@/lib/subjects";

const info = (code: string, en: string) => ({
  code,
  name: { de: en, en },
  sws: { lecture: 2, exercise: 0, laboratory: 0 },
  description: { de: "d", en: "d" },
  test: { de: "t", en: "t" },
});

// The same code means something else in each file: nothing is merged.
const tables: Overrides["degrees"] = {
  BEI: { M1: info("M1", "Maths 1"), TEG: info("TEG", "Electrical Engineering") },
  XYZ: { M1: info("M1", "Materials 1"), "CSEC1/1": info("CSEC1/1", "Security") },
};

it("names a subject from the file its degreeProgram names only", () => {
  expect(subjectName("M1", "BEI", tables)).toBe("Maths 1");
  expect(subjectName("m1", "XYZ", tables)).toBe("Materials 1");
  // Not in that file, even though another file knows it.
  expect(subjectName("CSEC1/1", "BEI", tables)).toBe("CSEC1 / 1");
});

it("shows the code without a degreeProgram or its file", () => {
  expect(subjectName("M1", undefined, tables)).toBe("M1");
  expect(subjectName("M1", "gone", tables)).toBe("M1");
});

it("keeps the slash fallback within the one file", () => {
  expect(subjectName("TEG/B", "BEI", tables)).toBe("Electrical Engineering / B");
  expect(subjectName("CSEC1/1", "XYZ", tables)).toBe("Security");
});

it("keeps a trailing slash as it is", () => {
  expect(subjectName("TEG/", "BEI", tables)).toBe("TEG/");
});
