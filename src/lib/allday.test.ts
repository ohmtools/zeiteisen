import { expect, test } from "vitest";
import { allDaySegments } from "@/lib/allday";
import type { GlobalEvent } from "@/lib/primitives/meta";
import { Day } from "@/lib/primitives/subject";

const holiday: GlobalEvent = {
  title: { de: "Feiertag", en: "Holiday" },
  startDate: "2026-11-04",
  noLectures: true,
};
const events = {
  [Day.Monday]: [],
  [Day.Tuesday]: [],
  [Day.Wednesday]: [holiday],
  [Day.Thursday]: [holiday],
  [Day.Friday]: [],
  [Day.other]: [],
};

test("neighbouring days with the same events share one chip", () => {
  expect(allDaySegments(events)).toEqual([{ from: 2, to: 3, events: [holiday] }]);
});

test("a phone's single column keeps its own day", () => {
  expect(allDaySegments(events, [Day.Thursday])).toEqual([{ from: 3, to: 3, events: [holiday] }]);
});
