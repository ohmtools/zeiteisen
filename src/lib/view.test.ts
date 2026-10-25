import { describe, expect, it } from "vitest";
import type { SemesterDates } from "@/lib/primitives/meta";
import type { Day } from "@/lib/primitives/subject";
import {
  calendarWeek,
  dayPick,
  defaultView,
  openingWeek,
  shownDay,
  shownWeek,
  weekPick,
  type Picked,
} from "@/lib/view";

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
    expect(defaultView(dates, at("2025-09-27"))).toBe("general");
    expect(defaultView(dates, at("2026-02-01"))).toBe("general");
  });

  it("opens on the week whose days ahead reach into the period", () => {
    // The period starts on a Wednesday.
    expect(defaultView(dates, at("2025-09-29"))).toBe("week");
    expect(defaultView(dates, at("2025-09-28"))).toBe("week");
    const toWednesday = { ...dates, lectureEnd: "2025-12-10" };
    expect(defaultView(toWednesday, at("2025-12-10"))).toBe("week");
    expect(defaultView(toWednesday, at("2025-12-11"))).toBe("general");
  });

  it("takes Sunday for the week ahead", () => {
    const fromMonday = { ...dates, lectureStart: "2025-10-06" };
    expect(defaultView(fromMonday, at("2025-10-05"))).toBe("week");
    const toSaturday = { ...dates, lectureEnd: "2025-12-13" };
    expect(defaultView(toSaturday, at("2025-12-13"))).toBe("week");
    expect(defaultView(toSaturday, at("2025-12-14"))).toBe("general");
  });

  it("opens on the general grid without dates or with an inverted period", () => {
    expect(defaultView(null, at("2025-12-10"))).toBe("general");
    const inverted = { ...dates, lectureStart: "2026-02-01" };
    expect(defaultView(inverted, at("2025-12-10"))).toBe("general");
  });
});

describe("shownWeek / shownDay", () => {
  const midnight = (iso: string) => new Date(`${iso}T00:00:00`).getTime();
  const time = (iso: string) => new Date(`${iso}:00`);
  // The phone's day in the week shown then.
  const day = (picked: Picked<Day> | null, now: Date, week = openingWeek(now)) =>
    shownDay(picked, now, week);

  it("show this week and today until the user picks", () => {
    expect(shownWeek(null, at("2025-10-09"))).toBe(midnight("2025-10-06"));
    expect(day(null, at("2025-10-09"))).toBe("thursday");
    expect(day(null, at("2025-10-11"))).toBe("other");
  });

  it("show the next day from 19:00 on", () => {
    expect(day(null, time("2025-10-09T18:59"))).toBe("thursday");
    expect(day(null, time("2025-10-09T19:00"))).toBe("friday");
    expect(day(null, time("2025-10-10T20:00"))).toBe("other");
    expect(day(null, time("2025-10-11T20:00"))).toBe("other");
  });

  it("show the next week and its Monday all Sunday", () => {
    expect(shownWeek(null, at("2025-10-11"))).toBe(midnight("2025-10-06"));
    for (const clock of ["00:00", "12:00", "19:30", "23:59"]) {
      const sunday = time(`2025-10-12T${clock}`);
      expect(shownWeek(null, sunday)).toBe(midnight("2025-10-13"));
      expect(day(null, sunday)).toBe("monday");
    }
  });

  it("keep Sunday's own list in the week ending", () => {
    const sunday = time("2025-10-12T20:00");
    expect(calendarWeek(sunday)).toBe(midnight("2025-10-06"));
    expect(day(null, sunday, calendarWeek(sunday))).toBe("other");
  });

  it("keep a week pick until the week moves on, like a fresh start", () => {
    const week = weekPick(midnight("2025-11-03"), at("2025-10-08"));
    expect(shownWeek(week, time("2025-10-11T23:59"))).toBe(midnight("2025-11-03"));
    expect(shownWeek(week, time("2025-10-12T00:00"))).toBe(midnight("2025-10-13"));
  });

  it("hold a week pick made on Sunday through the week ahead", () => {
    const week = weekPick(midnight("2025-11-03"), at("2025-10-12"));
    expect(shownWeek(week, time("2025-10-18T23:59"))).toBe(midnight("2025-11-03"));
    expect(shownWeek(week, time("2025-10-19T00:00"))).toBe(midnight("2025-10-20"));
  });

  it("end a look back made on Sunday with that day", () => {
    for (const back of ["2025-10-06", "2025-09-29"]) {
      const week = weekPick(midnight(back), time("2025-10-12T20:00"));
      expect(shownWeek(week, time("2025-10-12T23:59"))).toBe(midnight(back));
      expect(shownWeek(week, time("2025-10-13T00:00"))).toBe(midnight("2025-10-13"));
    }
  });

  it("keep a day pick until the next 19:00", () => {
    const pick = dayPick("monday", null, at("2025-10-09"));
    expect(day(pick, time("2025-10-09T18:59"))).toBe("monday");
    expect(day(pick, time("2025-10-09T19:00"))).toBe("friday");
  });

  it("keep an evening pick until the next evening", () => {
    const pick = dayPick("monday", null, time("2025-10-09T20:00"));
    expect(day(pick, time("2025-10-10T18:59"))).toBe("monday");
    expect(day(pick, time("2025-10-10T19:00"))).toBe("other");
  });

  it("end a Saturday evening pick at midnight, with the week", () => {
    const pick = dayPick("friday", null, time("2025-10-11T20:00"));
    expect(day(pick, time("2025-10-11T23:59"))).toBe("friday");
    expect(day(pick, time("2025-10-12T00:00"))).toBe("monday");
  });

  it("end a day pick made on Sunday at 19:00, one made later the next evening", () => {
    const morning = dayPick("friday", null, time("2025-10-12T10:00"));
    expect(day(morning, time("2025-10-12T18:59"))).toBe("friday");
    expect(day(morning, time("2025-10-12T19:00"))).toBe("monday");
    expect(day(morning, time("2025-10-13T08:00"))).toBe("monday");
    const evening = dayPick("friday", null, time("2025-10-12T20:00"));
    expect(day(evening, time("2025-10-13T18:59"))).toBe("friday");
    expect(day(evening, time("2025-10-13T19:00"))).toBe("tuesday");
  });

  it("hold a day pick in another week as long as the week pick", () => {
    const now = time("2025-10-08T18:30");
    const week = weekPick(midnight("2025-09-29"), now);
    const pick = dayPick("other", week, now);
    expect(day(pick, time("2025-10-08T19:00"), shownWeek(week, now))).toBe("other");
    expect(day(pick, time("2025-10-11T23:59"), shownWeek(week, now))).toBe("other");
    const sunday = time("2025-10-12T00:00");
    expect(shownWeek(week, sunday)).toBe(midnight("2025-10-13"));
    expect(day(pick, sunday)).toBe("monday");
  });

  it("move a day pick on with the clock in the week the app opens on", () => {
    const now = time("2025-10-08T18:30");
    const pick = dayPick("monday", weekPick(midnight("2025-10-06"), now), now);
    expect(day(pick, time("2025-10-08T19:00"))).toBe("thursday");
  });

  it("end a look back's day pick made on Sunday with that day too", () => {
    const now = time("2025-10-12T20:00");
    const week = weekPick(calendarWeek(now), now);
    const pick = dayPick("other", week, now);
    expect(day(pick, time("2025-10-12T23:59"), shownWeek(week, now))).toBe("other");
    expect(day(pick, time("2025-10-13T08:00"))).toBe("monday");
  });
});
