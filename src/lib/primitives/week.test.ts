import { describe, expect, test } from "vitest";
import type { SemesterDates } from "./meta";
import { lectureRange, occurrencesOf, wallClockInstant } from "./occurrence";
import { dated, subject, weekly } from "./fixtures.test-util";
import { Day, type WeeklyRepeatType } from "./subject";
import {
  cycleCode,
  eventsForWeek,
  generalColumn,
  isoDay,
  isoWeek,
  meetingsInWeek,
  repeatMatches,
  semesterBegin,
  semesterWeek,
} from "./week";

const day = (iso: string) => new Date(`${iso}T00:00:00`);

const dates = (patch: Partial<SemesterDates> = {}): SemesterDates => ({
  year: 2025,
  lectureStart: "2025-10-01",
  lectureEnd: "2026-01-23",
  events: [],
  ...patch,
});

describe("semesterBegin", () => {
  test("the last begin on or before the week's Sunday", () => {
    expect(semesterBegin(day("2026-02-09"))).toEqual(day("2025-10-01"));
    expect(semesterBegin(day("2026-09-21"))).toEqual(day("2026-03-15"));
  });

  test("a week containing a begin already belongs to the new semester", () => {
    // 01.10.2026 is a Thursday: its Monday 28.09. is in the winter semester.
    expect(semesterBegin(day("2026-09-28"))).toEqual(day("2026-10-01"));
    // 15.03.2026 is a Sunday, the last day of its week.
    expect(semesterBegin(day("2026-03-09"))).toEqual(day("2026-03-15"));
    // Any day of the week gives the same semester.
    expect(semesterBegin(day("2026-10-04"))).toEqual(day("2026-10-01"));
  });
});

test("semesterWeek counts from the week containing its own begin", () => {
  // 01.10.2025 is a Wednesday, so week 1 starts on 29.09.2025.
  expect(semesterWeek(day("2025-09-29"))).toBe(1);
  expect(semesterWeek(day("2026-01-05"))).toBe(15);
  // The week before belongs to the summer semester (begin 15.03.2025).
  expect(semesterWeek(day("2025-09-22"))).toBe(29);
  // Whatever today is: the week after 01.10.2026 is week 2.
  expect(semesterWeek(day("2026-10-05"))).toBe(2);
});

test("isoWeek is the ISO-8601 calendar week", () => {
  expect(isoWeek(day("2026-09-28"))).toBe(40);
  // 29.12.2025 is the Monday of ISO week 1 of 2026.
  expect(isoWeek(day("2025-12-29"))).toBe(1);
  // 2026 has 53 ISO weeks.
  expect(isoWeek(day("2026-12-28"))).toBe(53);
});

test("cycleCode runs U1, G1, U2, G2 from the university's week 1", () => {
  const weeks = [
    "2026-09-21",
    "2026-09-28",
    "2026-10-05",
    "2026-10-12",
    "2026-10-19",
    "2026-10-26",
  ];
  // 21.09.2026 is week 29 of the summer semester, 28.09. week 1 of the winter.
  expect(weeks.map((w) => cycleCode(day(w)))).toEqual(["U1", "U1", "G1", "U2", "G2", "U1"]);
});

test("repeatMatches: G/U by ISO week, G1/G2/U1/U2 by the university's count", () => {
  const weeks = ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"];
  const matching = (type: WeeklyRepeatType) =>
    weeks.filter((week) => repeatMatches(type, day(week)));
  // ISO weeks 40-43; the university's weeks 1-4.
  expect(matching("G")).toEqual(["2026-09-28", "2026-10-12"]);
  expect(matching("U")).toEqual(["2026-10-05", "2026-10-19"]);
  expect(matching("U1")).toEqual(["2026-09-28"]);
  expect(matching("G1")).toEqual(["2026-10-05"]);
  expect(matching("U2")).toEqual(["2026-10-12"]);
  expect(matching("G2")).toEqual(["2026-10-19"]);
  expect(matching("A")).toEqual(weeks);
  // ISO week 53 and the following week 1 are both odd.
  expect(repeatMatches("U", day("2026-12-28"))).toBe(true);
  expect(repeatMatches("U", day("2027-01-04"))).toBe(true);
});

describe("meetingsInWeek", () => {
  const holiday = dates({
    events: [
      {
        title: { de: "Feiertag", en: "Holiday" },
        startDate: "2025-10-03",
        noLectures: true,
      },
    ],
  });
  const weekStart = day("2025-09-29");
  const events = eventsForWeek(holiday, weekStart);
  const dates_ = (repeat: Parameters<typeof meetingsInWeek>[0]) =>
    meetingsInWeek(repeat, weekStart, events).map((meeting) => meeting.date);

  test("a weekly rhythm skips no-lectures days and days outside the period", () => {
    // 03.10.2025 is the Friday; Monday 29.09. is before the lecture start.
    // ISO week 40 is even.
    expect(dates_(weekly(Day.Thursday))).toEqual(["2025-10-02"]);
    expect(dates_(weekly(Day.Friday))).toEqual([]);
    expect(dates_(weekly(Day.Monday))).toEqual([]);
    expect(dates_(weekly(Day.Thursday, "G"))).toEqual(["2025-10-02"]);
    expect(dates_(weekly(Day.Thursday, "U"))).toEqual([]);
    expect(dates_(weekly(Day.other))).toEqual([null]);
  });

  test("listed dates win over no-lectures days and the lecture period", () => {
    expect(dates_(dated("2025-09-29", "2025-10-03", "2025-10-04", "2025-10-06"))).toEqual([
      "2025-09-29",
      "2025-10-03",
      "2025-10-04",
    ]);
    const [saturday] = meetingsInWeek(dated("2025-10-04"), weekStart, events);
    expect(saturday.day).toBe(Day.other);
  });
});

test("generalColumn sends SH1/SH2, dates and weekends to `other`", () => {
  expect(generalColumn(weekly(Day.Tuesday, "G"))).toBe(Day.Tuesday);
  expect(generalColumn(weekly(Day.Tuesday, "SH1"))).toBe(Day.other);
  expect(generalColumn(weekly(Day.Tuesday, "SH2"))).toBe(Day.other);
  expect(generalColumn(weekly(Day.other))).toBe(Day.other);
  expect(generalColumn(dated("2025-10-01"))).toBe(Day.other);
});

describe("occurrencesOf", () => {
  test("one date per matching week, inside the period, never for a weekly `other`", () => {
    const range = lectureRange(dates({ lectureEnd: "2025-10-19" }))!;
    const subjects = [
      subject("W", { repeat: weekly(Day.Monday) }),
      subject("G", { repeat: weekly(Day.Wednesday, "G") }),
      subject("O", { repeat: weekly(Day.other) }),
      // The Saturday is listed, the date after the range is not exported.
      subject("D", { repeat: dated("2025-10-11", "2025-10-20") }),
    ];
    const got = occurrencesOf(subjects, range, dates({ lectureEnd: "2025-10-19" }));
    expect(got.map((o) => [o.subject.name, o.index, o.date])).toEqual([
      // ISO weeks 40 and 42 are even.
      ["G", 1, day("2025-10-01")],
      ["W", 0, day("2025-10-06")],
      ["D", 3, day("2025-10-11")],
      ["W", 0, day("2025-10-13")],
      ["G", 1, day("2025-10-15")],
    ]);
  });

  test("a range across a semester begin switches the four-week rhythm there", () => {
    // Summer 2026: 14.09. is week 28 (G2), 21.09. week 29 (U1). Winter: 28.09.
    // is week 1 (U1), 05.10. week 2 (G1).
    const range = { start: day("2026-09-14"), end: day("2026-10-11") };
    const got = occurrencesOf([subject("U1", { repeat: weekly(Day.Monday, "U1") })], range, null);
    expect(got.map((o) => o.date)).toEqual([day("2026-09-21"), day("2026-09-28")]);
  });

  test("G/U ignore the semester begin and follow the ISO weeks", () => {
    // ISO weeks 38-41.
    const range = { start: day("2026-09-14"), end: day("2026-10-11") };
    const got = occurrencesOf([subject("G", { repeat: weekly(Day.Monday, "G") })], range, null);
    expect(got.map((o) => o.date)).toEqual([day("2026-09-14"), day("2026-09-28")]);
  });

  test("lectureRange is null without dates or with an inverted period", () => {
    expect(lectureRange(null)).toBeNull();
    expect(lectureRange(dates({ lectureEnd: "2025-01-01" }))).toBeNull();
  });
});

test("wallClockInstant follows the DST switch", () => {
  const time = { hour: 8, minute: 0 };
  expect(wallClockInstant(day("2025-10-20"), time).toISOString()).toBe("2025-10-20T06:00:00.000Z");
  expect(wallClockInstant(day("2025-10-27"), time).toISOString()).toBe("2025-10-27T07:00:00.000Z");
});

test("isoDay: the local calendar day, zero-padded, at any time of day", () => {
  expect(isoDay(new Date(2026, 0, 5))).toBe("2026-01-05");
  expect(isoDay(new Date(2025, 11, 31, 23, 59))).toBe("2025-12-31");
  // The day of the DST switch keeps its date.
  expect(isoDay(new Date(2025, 9, 26, 0, 30))).toBe("2025-10-26");
});
