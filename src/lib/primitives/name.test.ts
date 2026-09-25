import { expect, test } from "vitest";
import { compareNames, nameFromFile, uniqueNames } from "./name";

test("uniqueNames: each later name sees the earlier ones taken", () => {
  expect(uniqueNames(["A"], ["A", "B", "A", "B"])).toEqual(["A 2", "B", "A 3", "B 2"]);
  expect(uniqueNames([], [])).toEqual([]);
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
