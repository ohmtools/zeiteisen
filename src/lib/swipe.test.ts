import { describe, expect, it } from "vitest";
import { firstAxis, swipeDirection, swipeStep } from "@/lib/swipe";

describe("swipeDirection", () => {
  it("goes on for a move to the left, back for one to the right", () => {
    expect(swipeDirection(-60, 0)).toBe(1);
    expect(swipeDirection(60, 10)).toBe(-1);
  });

  it("takes a short or steep move for none", () => {
    expect(swipeDirection(-40, 0)).toBe(0);
    expect(swipeDirection(-60, 50)).toBe(0);
  });
});

describe("firstAxis", () => {
  it("waits until the touch leaves the slop", () => {
    expect(firstAxis(10, -10)).toBeNull();
  });

  it("tells sideways from up or down", () => {
    expect(firstAxis(-12, 8)).toBe("x");
    expect(firstAxis(8, 12)).toBe("y");
  });
});

describe("swipeStep", () => {
  it("moves to the next day that way", () => {
    expect(swipeStep("tuesday", 1, true)).toEqual({ day: "wednesday", week: 0 });
    expect(swipeStep("other", -1, false)).toEqual({ day: "friday", week: 0 });
  });

  it("crosses the week's ends into the next or last week", () => {
    expect(swipeStep("other", 1, true)).toEqual({ day: "monday", week: 1 });
    expect(swipeStep("monday", -1, true)).toEqual({ day: "other", week: -1 });
  });

  it("stops at the ends without weeks", () => {
    expect(swipeStep("other", 1, false)).toBeNull();
    expect(swipeStep("monday", -1, false)).toBeNull();
  });
});
