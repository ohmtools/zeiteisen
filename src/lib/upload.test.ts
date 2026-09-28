import { expect, it } from "vitest";
import { subject } from "@/lib/primitives/fixtures.test-util";
import { readDegreeFile, readDatesFile, readLocationsFile, readTimetableFiles } from "@/lib/upload";

const file = (name: string, content: unknown) =>
  new File([typeof content === "string" ? content : JSON.stringify(content)], name);

it("reads a plain Subject[] named after its file, local, all enabled", async () => {
  const { sources, errors } = await readTimetableFiles([file("BEI3.json", [subject("M1")])]);
  expect(errors).toEqual([]);
  expect(sources.map((s) => [s.name, s.origin.kind, s.subjects.toExtra()])).toEqual([
    ["BEI3", "local", [{ enabled: true }]],
  ]);
});

it("reports broken JSON, a wrong shape, a bad group and an empty name per file", async () => {
  const { sources, errors } = await readTimetableFiles([
    file("a.json", "{"),
    file("b.json", { name: "old", semester: {}, subjects: [] }),
    file("c.json", [subject("M1", { group: { category: 2, index: 3 } })]),
    file(".json", []),
    file("ok.json", []),
  ]);
  expect(sources.map((s) => s.name)).toEqual(["ok"]);
  expect(errors.map((e) => e.file)).toEqual(["a.json", "b.json", "c.json", ".json"]);
  expect(errors[2].details?.[0]).toMatch(/^\[0\] \("M1"\)\.group/);
});

it("reads a dates file", async () => {
  const dates = { year: 2025, lectureStart: "2025-10-01", lectureEnd: "2026-01-31" };
  expect(await readDatesFile(file("dates.json", dates))).toEqual({
    data: { ...dates, events: [] },
  });
  expect("error" in (await readDatesFile(file("dates.json", { year: 1 })))).toBe(true);
});

it("reads locations and degrees, refusing a file that lists none", async () => {
  const locations = { locations: [{ code: "WE", name: "Wassertorstraße" }] };
  expect(await readLocationsFile(file("l.json", locations))).toEqual({ data: locations });
  const degrees = {
    subjects: [
      {
        code: "M1",
        name: { de: "Mathe 1", en: "Maths 1" },
        sws: { lecture: 2, exercise: 1, laboratory: 0 },
        lp: 5,
        description: { de: "d", en: "d" },
        test: { de: "t", en: "t" },
      },
    ],
  };
  expect(await readDegreeFile(file("a.degree", degrees))).toEqual({
    data: degrees,
  });
  // A dates file picked by mistake parses as an empty list otherwise.
  const dates = { year: 2025, lectureStart: "2025-10-01", lectureEnd: "2026-01-31" };
  expect("error" in (await readLocationsFile(file("dates.json", dates)))).toBe(true);
  expect("error" in (await readDegreeFile(file("dates.json", dates)))).toBe(true);
  expect("error" in (await readLocationsFile(file("l.json", { locations: [{}] })))).toBe(true);
});
