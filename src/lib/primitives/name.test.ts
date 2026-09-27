import { expect, test } from "vitest";
import {
  cleanName,
  compareNames,
  MAX_NAME_BYTES,
  nameFromFile,
  nameProblem,
  normalizeName,
  sameName,
  uniqueName,
  uniqueNames,
} from "./name";

test("uniqueNames: each later name sees the earlier ones taken", () => {
  expect(uniqueNames(["A"], ["A", "B", "A", "B"])).toEqual(["A 2", "B", "A 3", "B 2"]);
  expect(uniqueNames([], [])).toEqual([]);
});

test("uniqueName: case and Unicode form do not tell names apart", () => {
  expect(uniqueName(["BEI3"], "bei3")).toBe("bei3 2");
  expect(uniqueName(["Plan", "PLAN 2"], "plan")).toBe("plan 3");
  expect(uniqueName(["Wahlf\u00e4cher"], "Wahlfa\u0308cher")).toBe("Wahlfa\u0308cher 2");
  expect(uniqueNames([], ["A", "a"])).toEqual(["A", "a 2"]);
});

test("sameName / normalizeName: one file on every system", () => {
  expect(sameName("BEI3", "bei3")).toBe(true);
  expect(sameName("\u00e4", "a\u0308")).toBe(true);
  expect(sameName("BEI3", "BEI 3")).toBe(false);
  expect(normalizeName("  a\u0308 ")).toBe("\u00e4");
});

test("nameProblem: accepts ordinary names, spaces, umlauts, dots inside and emoji", () => {
  for (const name of ["BEI 3", "Plan (B)", "Wahlfächer", "v1.2", ".hidden", "Plan 🎓", "CONSOLE"]) {
    expect(nameProblem(name)).toBeNull();
  }
});

test("nameProblem: names the first thing wrong", () => {
  expect(nameProblem("")).toBe("empty");
  expect(nameProblem("WS 24/25")).toBe("chars");
  expect(nameProblem("a:b")).toBe("chars");
  expect(nameProblem("tab\there")).toBe("chars");
  expect(nameProblem("Plan.")).toBe("end");
  expect(nameProblem("..")).toBe("end");
  expect(nameProblem("CON")).toBe("reserved");
  expect(nameProblem("nul.backup")).toBe("reserved");
  expect(nameProblem("com¹")).toBe("reserved");
  expect(nameProblem("ä".repeat(MAX_NAME_BYTES / 2 + 1))).toBe("long");
});

test("cleanName: a valid name stays, anything else changes as little as possible", () => {
  expect(cleanName("BEI 3", "x")).toBe("BEI 3");
  expect(cleanName("WS 24/25", "x")).toBe("WS 24-25");
  expect(cleanName('a<>:"b', "x")).toBe("a-b");
  expect(cleanName("Plan. . ", "x")).toBe("Plan");
  expect(cleanName("CON", "x")).toBe("CON_");
  expect(cleanName("aux.x", "x")).toBe("aux_.x");
  expect(cleanName("...", "x")).toBe("x");
  expect(cleanName("a\u0308", "x")).toBe("\u00e4");
  const long = cleanName("ä".repeat(200), "x");
  expect(new TextEncoder().encode(long).length).toBeLessThanOrEqual(MAX_NAME_BYTES);
  for (const name of ["a/b.", " . ", "LPT1", "x\u0000y", "é".repeat(300) + ".", long]) {
    expect(nameProblem(cleanName(name, "fallback"))).toBeNull();
  }
});

test("compareNames: numbers as numbers, case ignored", () => {
  expect(["BEI10", "bei2", "BEI9"].sort(compareNames)).toEqual(["bei2", "BEI9", "BEI10"]);
});

test("nameFromFile: drops the folder and the app's own or the catalog's extension", () => {
  expect(nameFromFile("semester/BEI3.json")).toBe("BEI3");
  expect(nameFromFile("BEI3.timetable")).toBe("BEI3");
  expect(nameFromFile("Plan A.profile")).toBe("Plan A");
  expect(nameFromFile("notes.txt")).toBe("notes.txt");
});
