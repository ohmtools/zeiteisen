import { describe, expect, it } from "vitest";
import type { SemesterDates } from "@/lib/primitives/meta";
import { defaultView, shownDay, shownWeek } from "@/lib/view";

const dates: SemesterDates = {
  year: 2025,
  lectureStart: "2025-10-01",
  lectureEnd: "2026-01-31",
  events: [],
};

const at = (iso: string) => new Date(`${iso}T12:00:00`);

describe("defaultView", () => {
  it("opens on the current week inside the lecture period, both ends included", () => {
    expect(defaultView(dates, at("2025-10-01"))).toBe("week");
    expect(defaultView(dates, at("2025-12-10"))).toBe("week");
    expect(defaultView(dates, at("2026-01-31"))).toBe("week");
  });

  it("opens on the general grid before and after the period", () => {
    expect(defaultView(dates, at("2025-09-30"))).toBe("general");
    expect(defaultView(dates, at("2026-02-01"))).toBe("general");
  });

  it("opens on the general grid without dates or with an inverted period", () => {
    expect(defaultView(null, at("2025-12-10"))).toBe("general");
    const inverted = { ...dates, lectureStart: "2026-02-01" };
    expect(defaultView(inverted, at("2025-12-10"))).toBe("general");
  });
});

describe("shownWeek / shownDay", () => {
  const midnight = (iso: string) => new Date(`${iso}T00:00:00`).getTime();

  it("show this week and today until the user picks", () => {
    expect(shownWeek(null, at("2025-10-09"))).toBe(midnight("2025-10-06"));
    expect(shownDay(null, at("2025-10-09"))).toBe("thursday");
    expect(shownDay(null, at("2025-10-11"))).toBe("other");
  });

  it("keep a pick while its week or day lasts", () => {
    const week = { value: midnight("2025-11-03"), pickedIn: midnight("2025-10-06") };
    expect(shownWeek(week, at("2025-10-12"))).toBe(midnight("2025-11-03"));
    const day = { value: "monday" as const, pickedIn: midnight("2025-10-09") };
    expect(shownDay(day, at("2025-10-09"))).toBe("monday");
  });

  it("show the next day from 19:00 on, within the shown week", () => {
    expect(shownDay(null, new Date("2025-10-09T18:59:00"))).toBe("thursday");
    expect(shownDay(null, new Date("2025-10-09T19:00:00"))).toBe("friday");
    expect(shownDay(null, new Date("2025-10-10T20:00:00"))).toBe("other");
    expect(shownDay(null, new Date("2025-10-12T19:30:00"))).toBe("other");
  });

  it("keep an evening pick until the next evening", () => {
    const day = { value: "monday" as const, pickedIn: midnight("2025-10-10") };
    expect(shownDay(day, new Date("2025-10-10T18:00:00"))).toBe("monday");
    expect(shownDay(day, new Date("2025-10-10T19:00:00"))).toBe("other");
  });

  it("move on to the new week and day, like a fresh start", () => {
    const week = { value: midnight("2025-10-06"), pickedIn: midnight("2025-10-06") };
    expect(shownWeek(week, at("2025-10-13"))).toBe(midnight("2025-10-13"));
    const day = { value: "friday" as const, pickedIn: midnight("2025-10-10") };
    expect(shownDay(day, at("2025-10-13"))).toBe("monday");
  });
});
