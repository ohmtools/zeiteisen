import { describe, expect, it } from "vitest";
import type { GlobalEvent, SemesterDates } from "@/lib/primitives/meta";
import { subject as base, dated, timetable, weekly } from "@/lib/primitives/fixtures.test-util";
import { type Day, type Subject, type WeeklyRepeatType } from "@/lib/primitives/subject";
import { icsFile } from "@/lib/ics";

// The export writes one VEVENT per occurrence (dates from the primitives'
// `occurrencesOf`) as UTC instants of Europe/Berlin wall-clock times — a wrong
// offset moves every lecture of a semester by an hour.

const SLOT = {
  professor: "Prof. Weber",
  location: "WE.105",
  startTime: { hour: 8, minute: 30 },
  endTime: { hour: 10, minute: 0 },
};

const on = (day: Day, type: WeeklyRepeatType = "A") => weekly(day, type, SLOT);

const subject = (patch: Partial<Subject> = {}): Subject =>
  base("M1", { group: { category: 2, index: 1 }, repeat: on("wednesday"), ...patch });

const dates = (events: GlobalEvent[] = []): SemesterDates => ({
  year: 2025,
  lectureStart: "2025-10-01",
  lectureEnd: "2025-10-31",
  events,
});

const day = (iso: string) => new Date(`${iso}T00:00:00`);
const range = { start: day("2025-10-01"), end: day("2025-10-15") };

// The one file of an export, or a failing test.
function exported(...args: Parameters<typeof icsFile>) {
  const { file, error } = icsFile(...args);
  if (!file || error) throw new Error(error ?? "no file");
  return file;
}

describe("icsFile", () => {
  it("writes one file per profile, named and titled after it", () => {
    const file = exported(
      [timetable("BEI3", [subject()]), timetable("BEI 4", [subject({ name: "PH" })])],
      dates(),
      range,
      "Simon K",
    );
    expect(file.filename).toBe("Simon K.ics");
    expect(file.text).toContain("X-WR-CALNAME:Simon K");
    expect(file.text).toContain("SUMMARY:M1 (SU) · BEI3");
    expect(file.text).toContain("SUMMARY:PH (SU) · BEI 4");
    expect(file.count).toBe(6);
  });

  it("exports only the enabled subjects", () => {
    const one = timetable("BEI3", [subject(), subject({ name: "PH", repeat: on("thursday") })]);
    one.subjects = one.subjects.with(1, { enabled: false });
    const file = exported([one], dates(), range, "Simon");
    expect(file.text).toContain("M1 (SU)");
    expect(file.text).not.toContain("PH (SU)");
  });

  it("skips a noLectures day", () => {
    const holiday = { title: { de: "Frei", en: "Off" }, startDate: "2025-10-08", noLectures: true };
    const file = exported([timetable("T", [subject()])], dates([holiday]), range, "S");
    expect(file.count).toBe(2);
  });

  it("writes Europe/Berlin wall-clock times as UTC instants, across the DST switch", () => {
    const wide = { start: day("2025-10-01"), end: day("2025-11-05") };
    const file = exported([timetable("T", [subject()])], null, wide, "Simon");
    // Summer time: 08:30 local is 06:30Z. Winter time (from 26.10.): 07:30Z.
    expect(file.text).toContain("DTSTART:20251001T063000Z");
    expect(file.text).toContain("DTSTART:20251105T073000Z");
  });

  it("puts group, professor and repeat in the description", () => {
    const file = exported(
      [timetable("T", [subject({ repeat: on("wednesday", "U") })])],
      null,
      range,
      "S",
    );
    const text = file.text.replace(/\r\n /g, "");
    expect(text).toContain("LOCATION:WE.105");
    expect(text).toMatch(/DESCRIPTION:.*2\.1/);
    expect(text).toMatch(/DESCRIPTION:.*Prof. Weber/);
  });

  it("writes no RRULE, one VEVENT per occurrence", () => {
    const file = exported([timetable("T", [subject()])], dates(), range, "S");
    expect(file.text).not.toContain("RRULE");
    expect(file.text.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(file.count).toBe(3);
  });

  it("exports listed dates with their own slot, even on a noLectures day", () => {
    const holiday = { title: { de: "Frei", en: "Off" }, startDate: "2025-10-04", noLectures: true };
    const repeat = dated("2025-10-04");
    if (repeat.type !== "I") throw new Error("dated");
    repeat.dates[0].location = "KA.101";
    const file = exported([timetable("T", [subject({ repeat })])], dates([holiday]), range, "S");
    // 04.10.2025 is a Saturday; 08:00 summer time is 06:00Z.
    expect(file.count).toBe(1);
    expect(file.text).toContain("DTSTART:20251004T060000Z");
    expect(file.text).toContain("LOCATION:KA.101");
  });

  it("returns no file when nothing is enabled", () => {
    const off = timetable("T", [subject()]);
    off.subjects = off.subjects.withAllExtra({ enabled: false });
    expect(icsFile([off], dates(), range, "S")).toEqual({ file: null, error: null });
  });

  it("keeps UIDs apart for the same subject in two timetables", () => {
    const file = exported(
      [timetable("A", [subject()]), timetable("B", [subject()])],
      dates(),
      range,
      "S",
    );
    const uids = file.text.match(/UID:.*/g) ?? [];
    expect(new Set(uids).size).toBe(6);
  });

  it("writes stable UIDs: the same export twice, and a changed room, keep them", () => {
    const uids = (text: string) => text.match(/UID:.*/g) ?? [];
    const export1 = exported([timetable("T", [subject()])], dates(), range, "S");
    const export2 = exported([timetable("T", [subject()])], dates(), range, "S");
    expect(uids(export1.text)).toHaveLength(3);
    expect(new Set(uids(export1.text)).size).toBe(3);
    expect(uids(export2.text)).toEqual(uids(export1.text));

    const moved = weekly("wednesday", "A", { ...SLOT, location: "KA.101" });
    const export3 = exported([timetable("T", [subject({ repeat: moved })])], dates(), range, "S");
    expect(uids(export3.text)).toEqual(uids(export1.text));
  });

  it("keeps UIDs apart for a subject listed twice on the same slot", () => {
    const other = weekly("wednesday", "A", { ...SLOT, location: "KA.101" });
    const file = exported(
      [timetable("T", [subject(), subject({ repeat: other })])],
      dates(),
      range,
      "S",
    );
    const uids = file.text.match(/UID:.*/g) ?? [];
    expect(uids).toHaveLength(6);
    expect(new Set(uids).size).toBe(6);
  });
});
