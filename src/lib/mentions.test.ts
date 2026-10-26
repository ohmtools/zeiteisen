import { describe, expect, it } from "vitest";
import { dated, profile, subject, timetable, weekly } from "@/lib/primitives/fixtures.test-util";
import type { SemesterDates } from "@/lib/primitives/meta";
import {
  classRows,
  followMentions,
  labelParts,
  lastDay,
  mentionLabel,
  mentionMatches,
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
      kinds: ["SU", "Ue"],
      group: "2.1",
    });
    expect(labelParts("PH2 SU")).toEqual({ name: "PH2", kinds: ["SU"], group: null });
    // Kinds in any case.
    expect(labelParts("ph2 su,UE")).toEqual({ name: "ph2", kinds: ["SU", "Ue"], group: null });
    expect(labelParts("PH2")).toEqual({ name: "PH2", kinds: null, group: null });
    expect(labelParts("MA3 2.1")).toEqual({ name: "MA3", kinds: null, group: "2.1" });
    // Without kinds one word only: words in brackets are no label.
    expect(labelParts("PH2 Lecture")).toBeNull();
    expect(labelParts("2.1")).toEqual({ name: "2.1", kinds: null, group: null });
  });

  it("keep brackets and line ends out of a name", () => {
    expect(mentionLabel(subject("A]b"))).toBe("A b SU");
  });
});

describe("mentionResolver", () => {
  it("finds the block of a link written for it", () => {
    const [mention] = mentionsOfText(LINK);
    const status = mentionResolver(PROFILES, "Main", DATES, TODAY).status(mention);
    expect(status.kind).toBe("ok");
    if (status.kind !== "ok") return;
    expect(mentionToken(status.entry)).toBe(mention.text);
  });

  it("tells a switched-off class and one in another profile from a gone one", () => {
    const [mention] = mentionsOfText(LINK);
    const off = withSubjects(
      TIMETABLES[0].subjects.withMappedExtra((_, i) => ({ enabled: i !== 0 })),
    );
    expect(
      mentionResolver([profile("Main", [off])], "Main", DATES, TODAY).status(mention).kind,
    ).toBe("off");
    const elsewhere = mentionResolver([profile("Empty", []), ...PROFILES], "Empty", DATES, TODAY);
    expect(elsewhere.status(mention)).toMatchObject({ kind: "elsewhere", profile: "Main" });
  });

  it("offers the class at its new time for a link that no longer fits", () => {
    const [mention] = mentionsOfText("@[2026-10-26 09:45 MA3 Ue 2.1]");
    const status = mentionResolver(PROFILES, "Main", DATES, TODAY).status(mention);
    expect(status.kind).toBe("broken");
    if (status.kind !== "broken") return;
    expect(status.candidates.map((entry) => entry.subject.name)).toEqual(["MA3"]);
  });

  it("finds nothing on a day off", () => {
    const [mention] = mentionsOfText("@[2026-10-19 08:00 MA3 Ue 2.1]");
    expect(mentionResolver(PROFILES, "Main", DATES, TODAY).status(mention)).toEqual({
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

describe("links to every Termin of a class", () => {
  const EVERY = "Read up @[MA3 Ue 2.1] first";

  it("read as a link without date and time, only for a class's label", () => {
    const [mention] = mentionsOfText(EVERY);
    expect(mention).toMatchObject({
      days: [],
      from: null,
      until: null,
      time: null,
      label: "MA3 Ue 2.1",
    });
    expect(mentionsOfText("see @[the slides] and @[]")).toEqual([]);
  });

  it("stand for the class's next Termin, today's included", () => {
    const [mention] = mentionsOfText(EVERY);
    const status = mentionResolver(PROFILES, "Main", DATES, TODAY).status(mention);
    expect(status.kind).toBe("ok");
    if (status.kind !== "ok") return;
    expect(status.entry.meeting.date).toBe("2026-10-26");
    const later = mentionResolver(PROFILES, "Main", DATES, new Date(2026, 9, 27)).status(mention);
    expect(later).toMatchObject({ kind: "ok", entry: { meeting: { date: "2026-11-02" } } });
    // After the last one: the last one.
    const after = mentionResolver(PROFILES, "Main", DATES, new Date(2027, 0, 1)).status(mention);
    expect(after).toMatchObject({ kind: "ok", entry: { meeting: { date: "2026-11-02" } } });
  });

  it("offer the classes of that name when theirs is gone", () => {
    const [mention] = mentionsOfText("@[MA3 SU]");
    const status = mentionResolver(PROFILES, "Main", DATES, TODAY).status(mention);
    expect(status.kind).toBe("broken");
    if (status.kind !== "broken") return;
    expect(status.candidates.map((entry) => mentionLabel(entry.subject))).toEqual(["MA3 Ue 2.1"]);
  });

  it("follow their class, whatever its time, and count it lost when gone", () => {
    const moved = [
      profile("Main", [
        withSubjects(
          TIMETABLES[0].subjects.withMappedSubjects((one, i) =>
            i === 0 ? { ...one, repeat: weekly("tuesday") } : one,
          ),
        ),
      ]),
    ];
    expect(followMentions(EVERY, PROFILES, moved, DATES, "Main")).toEqual({
      text: EVERY,
      moved: 0,
      lost: 0,
    });
    const regrouped = [
      profile("Main", [
        withSubjects(
          TIMETABLES[0].subjects.withMappedSubjects((one, i) =>
            i === 0 ? { ...one, group: { category: 2, index: 2 } } : one,
          ),
        ),
      ]),
    ];
    expect(followMentions(EVERY, PROFILES, regrouped, DATES, "Main")).toEqual({
      text: "Read up @[MA3 Ue 2.2] first",
      moved: 1,
      lost: 0,
    });
    const removed = [profile("Main", [withSubjects(TIMETABLES[0].subjects.withRemoved(0))])];
    expect(followMentions(EVERY, PROFILES, removed, DATES, null)).toMatchObject({ lost: 1 });
  });
});

describe("hand-typed links to part of a label", () => {
  const MA3_SU = subject("MA3", { kind: ["SU"] });
  const MA3_UE_2 = subject("MA3", {
    kind: ["Ue"],
    group: { category: 2, index: 2 },
    repeat: weekly("tuesday"),
  });
  const MA3_PR = subject("MA3", {
    kind: ["Pr"],
    group: { category: 2, index: 1 },
    repeat: weekly("thursday"),
  });
  const MA3_SU_UE = subject("MA3", { kind: ["SU", "Ue"], repeat: weekly("friday") });
  const ALL = [MA3, MA3_SU, MA3_UE_2, MA3_PR, MA3_SU_UE, PH2];
  const ON = [profile("Main", [timetable("BEI3", ALL)])];
  const named = (text: string) => {
    const [mention] = mentionsOfText(text);
    return ALL.filter((one) =>
      mentionMatches(mention, { subject: one, meeting: { date: null } } as never),
    ).map(mentionLabel);
  };

  it("point at every class whose label has the parts given", () => {
    expect(named("@[MA3]")).toEqual([
      "MA3 Ue 2.1",
      "MA3 SU",
      "MA3 Ue 2.2",
      "MA3 Pr 2.1",
      "MA3 SU,Ue",
    ]);
    expect(named("@[MA3 2.1]")).toEqual(["MA3 Ue 2.1", "MA3 Pr 2.1"]);
    expect(named("@[MA3 Ue 2.1]")).toEqual(["MA3 Ue 2.1"]);
  });

  it("take every class holding the kinds named, among others too", () => {
    expect(named("@[MA3 Ue]")).toEqual(["MA3 Ue 2.1", "MA3 Ue 2.2", "MA3 SU,Ue"]);
    expect(named("@[MA3 SU]")).toEqual(["MA3 SU", "MA3 SU,Ue"]);
    expect(named("@[MA3 Ue,SU]")).toEqual(["MA3 SU,Ue"]);
  });

  it("read name and kinds in any case", () => {
    expect(named("@[ma3 ue]")).toEqual(named("@[MA3 Ue]"));
    expect(named("@[Ma3 2.1]")).toEqual(named("@[MA3 2.1]"));
    const [one] = mentionsOfText("@[2026-10-26 08:00 ma3 ue 2.1]");
    expect(mentionResolver(PROFILES, "Main", DATES, TODAY).status(one).kind).toBe("ok");
  });

  it("stand for the next Termin of any of them", () => {
    const [mention] = mentionsOfText("@[MA3 2.1]");
    // Thursday's lab comes before next Monday's exercise.
    expect(mentionResolver(ON, "Main", DATES, new Date(2026, 9, 27)).status(mention)).toMatchObject(
      { kind: "ok", entry: { meeting: { date: "2026-10-29" } } },
    );
  });

  it("keep their shape when following a renamed class", () => {
    const renamed = [
      profile("Main", [
        timetable(
          "BEI3",
          ALL.map((one) => (one === MA3_PR ? { ...one, name: "MA4" } : one)),
        ),
      ]),
    ];
    const before = [profile("Main", [timetable("BEI3", ALL)])];
    expect(followMentions("@[MA3 Pr]", before, renamed, DATES, "Main").text).toBe("@[MA4 Pr]");
    // Others still fit: nothing to follow.
    expect(followMentions("@[MA3]", before, renamed, DATES, "Main")).toMatchObject({
      moved: 0,
      lost: 0,
    });
  });
});

describe("hand-typed links in any order", () => {
  const fields = (text: string) => {
    const [mention] = mentionsOfText(text);
    return (
      mention && {
        days: mention.days,
        from: mention.from,
        time: mention.time,
        parts: labelParts(mention.label),
      }
    );
  };

  it("read their parts wherever they stand", () => {
    const usual = fields("@[2026-10-26 08:00 MA3 Ue 2.1]");
    expect(fields("@[2.1 Ue 08:00 MA3 2026-10-26]")).toEqual(usual);
    expect(fields("@[ue ma3 8:00 2.1 2026-10-26]")).toMatchObject({
      days: ["2026-10-26"],
      time: "08:00",
      parts: { name: "ma3", kinds: ["Ue"], group: "2.1" },
    });
    expect(fields("@[Ue MA3 2026-11-05+]")).toMatchObject({
      days: [],
      from: "2026-11-05",
      parts: { name: "MA3", kinds: ["Ue"], group: null },
    });
    expect(fields("@[2.1 MA3]")).toMatchObject({
      parts: { name: "MA3", kinds: null, group: "2.1" },
    });
    // Kinds in two words add up.
    expect(labelParts("SU MA3 Ue")).toEqual({ name: "MA3", kinds: ["SU", "Ue"], group: null });
  });

  it("match as the usual order does", () => {
    const [one] = mentionsOfText("@[2.1 ue 2026-10-26 08:00 MA3]");
    expect(mentionResolver(PROFILES, "Main", DATES, TODAY).status(one).kind).toBe("ok");
  });

  it("keep a name of kind codes read from the end", () => {
    expect(labelParts("S SU")).toEqual({ name: "S", kinds: ["SU"], group: null });
  });
});

describe("hand-typed links from or up to a date", () => {
  const dates = (text: string, today = TODAY) => {
    const [mention] = mentionsOfText(text);
    const series = seriesIn(TIMETABLES, DATES, pickerRange(TIMETABLES, DATES, today));
    return series
      .flatMap((one) => one.dates)
      .filter((entry) => mentionMatches(mention, entry))
      .map((entry) => entry.meeting.date!)
      .sort((a, b) => a.localeCompare(b));
  };

  it("read the sign after the date, the time optional", () => {
    expect(mentionsOfText("@[2026-11-02+ MA3]")[0]).toMatchObject({
      days: [],
      from: "2026-11-02",
      until: null,
      time: null,
      label: "MA3",
    });
    expect(mentionsOfText("@[2026-11-02- 08:00 MA3 Ue]")[0]).toMatchObject({
      time: "08:00",
      until: "2026-11-02",
    });
    // One of each sign; a time needs a date.
    expect(mentionsOfText("@[2026-11-02+ 2026-11-09+ MA3] @[08:00 MA3]")).toEqual([]);
  });

  it("take every Termin on the days named, at the time if given", () => {
    expect(dates("@[2026-10-12 2026-11-02 MA3]")).toEqual(["2026-10-12", "2026-11-02"]);
    // A day without the class names nothing more.
    expect(dates("@[2026-10-13 2026-10-26 MA3]")).toEqual(["2026-10-26"]);
    expect(dates("@[2026-10-12 2026-11-02 09:00 MA3]")).toEqual([]);
  });

  it("take what lies between a from and an up to, or both ends when crossed", () => {
    expect(dates("@[2026-10-12+ 2026-10-26- MA3]")).toEqual(["2026-10-12", "2026-10-26"]);
    expect(dates("@[2026-10-26+ 2026-10-12- MA3]")).toEqual([
      "2026-10-05",
      "2026-10-12",
      "2026-10-26",
      "2026-11-02",
    ]);
    expect(dates("@[2026-11-02+ 2026-10-05- MA3]")).toEqual(["2026-10-05", "2026-11-02"]);
    // Days named alone add to the span.
    expect(dates("@[2026-10-05 2026-10-26+ MA3]")).toEqual([
      "2026-10-05",
      "2026-10-26",
      "2026-11-02",
    ]);
  });

  it("are past once the last day they can name is", () => {
    const last = (text: string) => lastDay(mentionsOfText(text)[0]);
    expect(last("@[2026-10-12 2026-11-02 MA3]")).toBe("2026-11-02");
    expect(last("@[2026-10-12+ 2026-10-26- MA3]")).toBe("2026-10-26");
    expect(last("@[2026-10-12+ MA3]")).toBeNull();
    expect(last("@[2026-10-26+ 2026-10-12- MA3]")).toBeNull();
    expect(last("@[MA3]")).toBeNull();
  });

  it("take the date's Termin and every one after / before it", () => {
    // MA3 meets Mondays 08:00: 5.10., 12.10., 26.10., 2.11. (19.10. off).
    expect(dates("@[2026-10-26+ MA3]")).toEqual(["2026-10-26", "2026-11-02"]);
    expect(dates("@[2026-10-26- MA3]")).toEqual(["2026-10-05", "2026-10-12", "2026-10-26"]);
    expect(dates("@[2026-10-26+ 08:01 MA3]")).toEqual(["2026-11-02"]);
    expect(dates("@[2026-10-26- 07:59 MA3]")).toEqual(["2026-10-05", "2026-10-12"]);
  });

  it("stand for the next Termin in their span", () => {
    const resolve = (text: string, today: Date) =>
      mentionResolver(PROFILES, "Main", DATES, today).status(mentionsOfText(text)[0]);
    expect(resolve("@[2026-11-02+ MA3]", TODAY)).toMatchObject({
      kind: "ok",
      entry: { meeting: { date: "2026-11-02" } },
    });
    // Up to a date gone by: its last one.
    expect(resolve("@[2026-10-12- MA3]", TODAY)).toMatchObject({
      kind: "ok",
      entry: { meeting: { date: "2026-10-12" } },
    });
    expect(resolve("@[2026-11-03+ MA3]", TODAY).kind).toBe("broken");
  });

  it("keep date and sign when following their class", () => {
    const renamed = [
      profile("Main", [
        withSubjects(
          TIMETABLES[0].subjects.withMappedSubjects((one, i) =>
            i === 0 ? { ...one, name: "MA4" } : one,
          ),
        ),
      ]),
    ];
    expect(
      followMentions("@[2026-10-26+ 08:00 MA3 Ue]", PROFILES, renamed, DATES, "Main").text,
    ).toBe("@[2026-10-26+ 08:00 MA4 Ue]");
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

  it("has a row per class for every date, a lecture and its exam as one", () => {
    const rows = classRows(series, parseMentionQuery("", TODAY), haystack, TODAY);
    expect(rows.map((row) => [row.key, row.count, row.entry.meeting.date])).toEqual([
      ["MA3 Ue 2.1", 4, "2026-10-26"],
      ["PH2 SU", 5, "2026-10-28"],
    ]);
    const wed = classRows(series, parseMentionQuery("mi", TODAY), haystack, TODAY);
    expect(wed.map((row) => row.key)).toEqual(["PH2 SU"]);
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
