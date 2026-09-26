import { describe, expect, it } from "vitest";
import { dated, subject, timetable, weekly } from "@/lib/primitives/fixtures.test-util";
import {
  draftOf,
  nextDate,
  parseTime,
  subjectOfDraft,
  suggestionsFor,
  withDates,
} from "@/lib/edit";

describe("draft round trip", () => {
  it("gives back the very subject it was made from", () => {
    const weeklyOne = subject("M1", {
      group: { category: 2, index: 1 },
      note: "bring a laptop",
      repeat: weekly("tuesday", "G", { professor: "Koch", location: "WE.107" }),
    });
    const datedOne = subject("PH", { repeat: dated("2026-10-12", "2026-10-05") });
    for (const one of [weeklyOne, datedOne]) {
      const result = subjectOfDraft(draftOf(one));
      expect(result.problems).toEqual([]);
      expect("subject" in result && result.subject).toEqual(
        one.repeat.type === "I" ? { ...one, repeat: dated("2026-10-05", "2026-10-12") } : one,
      );
    }
  });

  it("leaves out an empty group and note instead of storing undefined", () => {
    const draft = {
      ...draftOf(),
      name: "M1",
      slot: { ...draftOf().slot, start: "8:00", end: "9:30" },
    };
    const result = subjectOfDraft(draft);
    expect("subject" in result && Object.keys(result.subject).sort()).toEqual(
      ["kind", "name", "onDemand", "repeat"].sort(),
    );
  });

  it("names every broken field", () => {
    const draft = {
      ...draftOf(),
      kinds: [],
      group: "2.3",
      slot: { professor: "", location: "", start: "10:00", end: "09:00" },
    };
    expect(subjectOfDraft(draft).problems).toEqual(["name", "kinds", "group", "time"]);
    expect(subjectOfDraft({ ...draftOf(), name: "M1", type: "I" }).problems).toEqual(["dates"]);
  });

  it("reads times", () => {
    expect(parseTime("08:15")).toEqual({ hour: 8, minute: 15 });
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("")).toBeNull();
  });
});

describe("dates", () => {
  const base = draftOf(subject("PH", { repeat: dated("2026-10-05") }));

  it("repeats the last date a week later", () => {
    expect(nextDate(base, new Date(2026, 0, 1)).date).toBe("2026-10-12");
    expect(nextDate({ ...base, dates: [] }, new Date(2026, 0, 1)).date).toBe("2026-01-01");
  });

  it("keeps a picked date's own time and gives new ones the last date's", () => {
    const own = { ...base, dates: [{ ...base.dates[0], start: "10:00", end: "11:00" }] };
    const dates = withDates(own, [new Date(2026, 9, 19), new Date(2026, 9, 5)]);
    expect(dates.map((one) => [one.date, one.start])).toEqual([
      ["2026-10-05", "10:00"],
      ["2026-10-19", "10:00"],
    ]);
  });

  it("keeps every slot of a date listed twice", () => {
    const block = {
      ...base,
      dates: [base.dates[0], { ...base.dates[0], start: "10:00", end: "11:30" }],
    };
    const dates = withDates(block, [new Date(2026, 9, 5), new Date(2026, 9, 12)]);
    expect(dates.map((one) => [one.date, one.start])).toEqual([
      ["2026-10-05", "08:00"],
      ["2026-10-05", "10:00"],
      ["2026-10-12", "10:00"],
    ]);
  });
});

describe("suggestionsFor", () => {
  it("lists what the device knows, the subject's own rooms first", () => {
    const many = [
      subject("M1", { repeat: weekly("monday", "A", { location: "KA.1" }) }),
      subject("PH", { repeat: weekly("monday", "A", { location: "WE.1" }) }),
      subject("PH", { repeat: weekly("tuesday", "A", { location: "WE.1" }) }),
    ];
    const found = suggestionsFor([timetable("BEI3", many)], { name: "M1", kinds: ["SU"] });
    expect(found.names).toEqual(["PH", "M1"]);
    expect(found.locations).toEqual(["KA.1", "WE.1"]);
    expect(found.slots.map((one) => one.start + "-" + one.end)).toEqual([
      "08:00-09:30",
      "09:45-11:15",
      "11:30-13:00",
      "14:00-15:30",
      "15:45-17:15",
      "17:30-19:00",
    ]);
  });
});
