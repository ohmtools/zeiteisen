import { expect, test } from "vitest";
import { dated, subject, timetable, weekly } from "@/lib/primitives/fixtures.test-util";
import { eventsForWeek } from "@/lib/primitives/week";
import { byDay, generalEntries, weekEntries } from "@/lib/layout";

const late = { startTime: { hour: 19, minute: 0 }, endTime: { hour: 21, minute: 0 } };

test("the `other` list takes what the hour grid cannot hold, first to last", () => {
  const t = timetable("T", [
    subject("MON", { repeat: weekly("monday") }),
    subject("SAT", { repeat: weekly("other", "G") }),
    subject("SH", { repeat: weekly("tuesday", "SH1") }),
    subject("LATE", { repeat: weekly("monday", "A", late) }),
    subject("DATES", { repeat: dated("2026-09-23", "2026-09-30") }),
  ]);
  const { grid, list } = byDay(generalEntries([t]));
  expect(grid.monday.map((p) => p.entry.subject.name)).toEqual(["MON"]);
  expect(list.map((e) => e.subject.name)).toEqual(["LATE", "SH", "DATES", "SAT"]);
});

test("in a week, weekend dates come Saturday before Sunday", () => {
  const t = timetable("T", [
    subject("SUN", { repeat: dated("2026-09-27") }),
    subject("SAT", { repeat: dated("2026-09-26") }),
    subject("WED", { repeat: dated("2026-09-23") }),
  ]);
  const weekStart = new Date("2026-09-21T00:00:00");
  const entries = weekEntries([t], 1, weekStart, eventsForWeek(null, weekStart));
  const { grid, list } = byDay(entries);
  expect(grid.wednesday.map((p) => p.entry.subject.name)).toEqual(["WED"]);
  expect(list.map((e) => e.subject.name)).toEqual(["SAT", "SUN"]);
});
