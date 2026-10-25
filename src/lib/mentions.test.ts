import { describe, expect, it } from "vitest";
import { dated, subject, timetable, weekly } from "@/lib/primitives/fixtures.test-util";
import type { SemesterDates } from "@/lib/primitives/meta";
import {
  mentionLabel,
  mentionResolver,
  mentionsOfText,
  mentionToken,
  parseMentionQuery,
  pickerRange,
  pickerRows,
  plainText,
  seriesIn,
  termHash,
} from "@/lib/mentions";

const DATES: SemesterDates = {
  year: 2026,
  lectureStart: "2026-10-05",
  lectureEnd: "2026-11-06",
  events: [
    {
      title: { de: "Ferien", en: "Break" },
      startDate: "2026-10-19",
      endDate: "2026-10-23",
      noLectures: true,
    },
  ],
};

const MA3 = subject("MA3", { kind: ["Ue"], group: { category: 2, index: 1 } });
const PH2 = subject("PH2", {
  repeat: weekly("wednesday", "A", { startTime: { hour: 14, minute: 0 } }),
});
const EXAM = subject("PH2", { kind: ["SU"], repeat: dated("2027-02-10") });
const TIMETABLES = [timetable("BEI3", [MA3, PH2, EXAM])];
// Sunday 25.10.2026
const TODAY = new Date(2026, 9, 25);

describe("termHash", () => {
  it("ignores room, professor and end, not the start time or group", () => {
    const slot = { startTime: { hour: 8, minute: 0 } };
    const hash = termHash(MA3, slot);
    expect(hash).toHaveLength(8);
    expect(termHash({ ...MA3, note: "x" }, slot)).toBe(hash);
    expect(termHash(MA3, { startTime: { hour: 9, minute: 0 } })).not.toBe(hash);
    expect(termHash({ ...MA3, group: { category: 2, index: 2 } }, slot)).not.toBe(hash);
  });

  it("labels a link readably, without brackets", () => {
    expect(mentionLabel(MA3)).toBe("MA3 Ue 2.1");
    expect(mentionLabel(subject("A]b"))).toBe("A b SU");
  });
});

describe("mentionResolver", () => {
  const resolve = mentionResolver(TIMETABLES, DATES);

  it("finds the block of a link written for it", () => {
    const [entry] = resolve.onDate("2026-10-26");
    expect(entry.subject.name).toBe("MA3");
    const [mention] = mentionsOfText(`- [ ] Sheet ${mentionToken(entry)}`);
    expect(resolve.entry(mention)?.key).toBe(entry.key);
  });

  it("finds nothing on a day off, nor for another hash", () => {
    expect(resolve.onDate("2026-10-19")).toEqual([]);
    const [mention] = mentionsOfText("@[2026-10-26#nothere0 MA3]");
    expect(resolve.entry(mention)).toBeNull();
  });

  it("words a line without the link it is shown for", () => {
    const [mention] = mentionsOfText("Exam in @[2026-10-28#y PH2 Ue], open book.");
    expect(plainText(mention.line.pieces)).toBe("Exam in PH2 Ue, open book.");
    expect(plainText(mention.line.pieces, mention.start)).toBe("Exam in, open book.");
  });

  it("keeps each link's line and heading", () => {
    const [a, b] = mentionsOfText("@[2026-10-26#x A]\n# Exams\n- [ ] @[2026-10-28#y B]");
    expect(a.heading).toBe("");
    expect(b.heading).toBe("Exams");
    expect(b.line.task?.done).toBe(false);
  });
});

describe("the picker", () => {
  const series = seriesIn(TIMETABLES, DATES, pickerRange(TIMETABLES, DATES, TODAY));
  const haystack = (entry: { subject: { name: string; kind: string[] } }) =>
    `${entry.subject.name} ${entry.subject.kind.join(" ")}`;

  it("has a row per class and time, its dates in order, the exam too", () => {
    // By weekday, then time: the exam (Wed 08:00) before the exercise (Wed 14:00).
    expect(series.map((one) => `${one.entry.subject.name} ${one.dates.length}`)).toEqual([
      "MA3 4",
      "PH2 1",
      "PH2 4",
    ]);
  });

  it("links a row to the next date", () => {
    const rows = pickerRows(series, parseMentionQuery("ma3", TODAY), haystack, TODAY);
    expect(rows.map((row) => [row.entry.meeting.date, row.exact])).toEqual([["2026-10-26", false]]);
  });

  it("narrows to a typed date, weekday or week", () => {
    const onDate = pickerRows(series, parseMentionQuery("ph2 4.11", TODAY), haystack, TODAY);
    expect(onDate.map((row) => [row.entry.meeting.date, row.exact])).toEqual([
      ["2026-11-04", true],
    ]);
    const wed = pickerRows(series, parseMentionQuery("mi", TODAY), haystack, TODAY);
    // The exam on Wed 10.2. too.
    expect(wed.map((row) => row.entry.meeting.day)).toEqual(["wednesday", "wednesday"]);
    const week = pickerRows(series, parseMentionQuery("kw45", TODAY), haystack, TODAY);
    expect(week.map((row) => row.entry.meeting.date)).toEqual(["2026-11-02", "2026-11-04"]);
  });

  it("reads dates without a year as the nearest one", () => {
    expect(parseMentionQuery("9.11", TODAY).date).toBe("2026-11-09");
    expect(parseMentionQuery("10.2.", TODAY).date).toBe("2027-02-10");
    expect(parseMentionQuery("morgen x", TODAY)).toEqual({
      words: ["x"],
      date: "2026-10-26",
      weekday: null,
      week: null,
    });
  });
});
