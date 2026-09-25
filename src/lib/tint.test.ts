import { expect, test } from "vitest";
import { tintSteps } from "@/lib/tint";

test("timetables shown together get distinct steps in name order", () => {
  const steps = tintSteps(["BEI6", "BEI1", "BEI10", "BEI2"]);
  expect([...steps]).toEqual([
    ["BEI1", 0],
    ["BEI2", 1],
    ["BEI6", 2],
    ["BEI10", 3],
  ]);
});

test("the ramp starts over after four timetables", () => {
  expect(tintSteps(["A", "B", "C", "D", "E"]).get("E")).toBe(0);
});
