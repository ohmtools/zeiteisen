import { describe, expect, it } from "vitest";
import type { SemesterDates } from "@/lib/primitives/meta";
import { defaultView } from "@/lib/view";

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
