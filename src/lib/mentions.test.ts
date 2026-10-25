import { describe, expect, it } from "vitest";
import { dated, profile, subject, timetable, weekly } from "@/lib/primitives/fixtures.test-util";
import type { SemesterDates } from "@/lib/primitives/meta";
import {
  followMentions,
  labelParts,
  mentionLabel,
  mentionResolver,
  mentionsOfText,
  mentionToken,
  parseMentionQuery,
  pickerRange,
  pickerRows,
  plainText,
  seriesIn,
  successorIndex,
} from "@/lib/mentions";
import type { Subjects } from "@/lib/primitives/subject";
import type { Timetable } from "@/lib/primitives/timetable";

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
const PROFILES = [profile("Main", TIMETABLES)];
// Sunday 25.10.2026
const TODAY = new Date(2026, 9, 25);

// MA3's link on Monday 26.10., 08:00.
const LINK = "- [ ] Sheet 3 @[2026-10-26 08:00 MA3 Ue 2.1]";

function withSubjects(subjects: Subjects<{ enabled: boolean }>): Timetable {
  return { ...TIMETABLES[0], subjects };
}

describe("labels", () => {
  it("spell name, kinds and group, and read back from the end", () => {
    expect(mentionLabel(MA3)).toBe("MA3 Ue 2.1");
    expect(labelParts("Mathe 3 SU,Ue 2.1")).toEqual({
      name: "Mathe 3",
      kinds: "SU,Ue",
      group: "2.1",
    });
    expect(labelParts("PH2 SU")).toEqual({ name: "PH2", kinds: "SU", group: "" });
    expect(labelParts("PH2")).toBeNull();
    expect(labelParts("PH2 Lecture")).toBeNull();
  });

  it("keep brackets and line ends out of a name", () => {
    expect(mentionLabel(subject("A]b"))).toBe("A b SU");
  });
});

describe("mentionResolver", () => {
  it("finds the block of a link written for it", () => {
    const [mention] = mentionsOfText(LINK);
    const status = mentionResolver(PROFILES, "Main", DATES).status(mention);
    expect(status.kind).toBe("ok");
    if (status.kind !== "ok") return;
    expect(mentionToken(status.entry)).toBe(mention.text);
  });

  it("tells a switched-off class and one in another profile from a gone one", () => {
    const [mention] = mentionsOfText(LINK);
    const off = withSubjects(
      TIMETABLES[0].subjects.withMappedExtra((_, i) => ({ enabled: i !== 0 })),
    );
    expect(mentionResolver([profile("Main", [off])], "Main", DATES).status(mention).kind).toBe(
      "off",
    );
    const elsewhere = mentionResolver([profile("Empty", []), ...PROFILES], "Empty", DATES);
    expect(elsewhere.status(mention)).toMatchObject({ kind: "elsewhere", profile: "Main" });
  });

  it("offers the class at its new time for a link that no longer fits", () => {
    const [mention] = mentionsOfText("@[2026-10-26 09:45 MA3 Ue 2.1]");
    const status = mentionResolver(PROFILES, "Main", DATES).status(mention);
    expect(status.kind).toBe("broken");
    if (status.kind !== "broken") return;
    expect(status.candidates.map((entry) => entry.subject.name)).toEqual(["MA3"]);
  });

  it("finds nothing on a day off", () => {
    const [mention] = mentionsOfText("@[2026-10-19 08:00 MA3 Ue 2.1]");
    expect(mentionResolver(PROFILES, "Main", DATES).status(mention)).toEqual({
      kind: "broken",
      candidates: [],
    });
  });

  it("words a line without the link it is shown for", () => {
    const [mention] = mentionsOfText("Exam in @[2026-10-28 14:00 PH2 SU], open book.");
    expect(plainText(mention.line.pieces)).toBe("Exam in PH2 SU, open book.");
    expect(plainText(mention.line.pieces, mention.start)).toBe("Exam in, open book.");
  });

  it("keeps each link's line and heading", () => {
    const [a, b] = mentionsOfText(
      "@[2026-10-26 08:00 A SU]\n# Exams\n- [ ] @[2026-10-28 08:00 B SU]",
    );
    expect(a.heading).toBe("");
    expect(b.heading).toBe("Exams");
    expect(b.line.task?.done).toBe(false);
  });
});

describe("followMentions", () => {
  const edited = (patch: Partial<typeof MA3>) =>
    profile("Main", [
      withSubjects(
        TIMETABLES[0].subjects.withMappedSubjects((one, i) =>
          i === 0 ? { ...one, ...patch } : one,
        ),
      ),
    ]);

  it("moves a link along with an edit of its class", () => {
    const after = [
      edited({ repeat: weekly("monday", "A", { startTime: { hour: 9, minute: 45 } }) }),
    ];
    expect(followMentions(LINK, PROFILES, after, DATES, "Main")).toEqual({
      text: "- [ ] Sheet 3 @[2026-10-26 09:45 MA3 Ue 2.1]",
      moved: 1,
      lost: 0,
    });
  });

  it("follows the edited profile's class even where another profile keeps it", () => {
    const after = [
      edited({ repeat: weekly("monday", "A", { startTime: { hour: 9, minute: 45 } }) }),
      profile("Other", TIMETABLES),
    ];
    expect(
      followMentions(LINK, [...PROFILES, profile("Other", TIMETABLES)], after, DATES, "Main"),
    ).toMatchObject({ moved: 1, lost: 0 });
  });

  it("counts a link lost when its date is gone, or without following", () => {
    const tuesday = [edited({ repeat: weekly("tuesday") })];
    expect(followMentions(LINK, PROFILES, tuesday, DATES, "Main")).toMatchObject({
      moved: 0,
      lost: 1,
    });
    const renamed = [edited({ name: "MA4" })];
    expect(followMentions(LINK, PROFILES, renamed, DATES, null)).toMatchObject({
      moved: 0,
      lost: 1,
    });
    const removed = [profile("Main", [withSubjects(TIMETABLES[0].subjects.withRemoved(0))])];
    expect(followMentions(LINK, PROFILES, removed, DATES, null)).toMatchObject({ lost: 1 });
  });

  it("leaves links alone on switching off and renaming a timetable", () => {
    const off = [
      profile("Main", [
        withSubjects(TIMETABLES[0].subjects.withMappedExtra(() => ({ enabled: false }))),
      ]),
    ];
    expect(followMentions(LINK, PROFILES, off, DATES, "Main")).toEqual({
      text: LINK,
      moved: 0,
      lost: 0,
    });
    const renamed = [profile("Main", [{ ...TIMETABLES[0], name: "Other" }])];
    expect(followMentions(LINK, PROFILES, renamed, DATES, "Main")).toEqual({
      text: LINK,
      moved: 0,
      lost: 0,
    });
  });

  it("follows only the one subject that changed", () => {
    const a = subject("A");
    const b = subject("B");
    expect(successorIndex([a, b], [a, { ...b, name: "C" }], 1)).toBe(1);
    expect(successorIndex([a, b], [b, { ...a, name: "C" }], 0)).toBe(1);
    expect(
      successorIndex(
        [a, b],
        [
          { ...a, name: "X" },
          { ...b, name: "Y" },
        ],
        0,
      ),
    ).toBeNull();
    expect(successorIndex([a, b], [b], 0)).toBeNull();
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
