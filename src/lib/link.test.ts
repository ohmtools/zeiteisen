import { describe, expect, it } from "vitest";
import { isHighlighted, sameHighlight } from "@/lib/link";

describe("isHighlighted", () => {
  const highlight = { timetableName: "BEI3", indexes: [1, 4] };

  it("matches the cell's subjects of its own timetable only", () => {
    expect(isHighlighted({ timetableName: "BEI3", index: 4 }, highlight)).toBe(true);
    expect(isHighlighted({ timetableName: "BEI3", index: 2 }, highlight)).toBe(false);
    // The same index in another timetable is another subject.
    expect(isHighlighted({ timetableName: "BEI4", index: 4 }, highlight)).toBe(false);
  });
});

describe("sameHighlight", () => {
  it("compares by timetable and indexes, not by identity", () => {
    const a = { timetableName: "BEI3", indexes: [1, 4] };
    expect(sameHighlight(a, { timetableName: "BEI3", indexes: [1, 4] })).toBe(true);
    expect(sameHighlight(a, { timetableName: "BEI3", indexes: [1] })).toBe(false);
    expect(sameHighlight(a, { timetableName: "BEI4", indexes: [1, 4] })).toBe(false);
    expect(sameHighlight(null, null)).toBe(true);
    expect(sameHighlight(a, null)).toBe(false);
  });
});
