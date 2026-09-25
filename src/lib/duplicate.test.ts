import { describe, expect, it } from "vitest";
import { profile, subject, timetable } from "@/lib/primitives/fixtures.test-util";
import { duplicateName, duplicateProfile } from "@/lib/duplicate";

describe("duplicateProfile", () => {
  const bei3 = timetable("BEI3", [subject("M1"), subject("PH")], {
    origin: { kind: "catalog", path: "BEI3.json" },
    rejected: ["abcd1234"],
  });
  bei3.subjects = bei3.subjects.with(1, { enabled: false });
  const source = { ...profile("Plan A", [bei3]), locked: true };

  it("copies timetables, selection, origin and refusals, unlocked", () => {
    const copy = duplicateProfile(source, "Plan A 2");
    expect(copy.name).toBe("Plan A 2");
    expect(copy.locked).toBe(false);
    expect(copy.timetables).toHaveLength(1);
    const [held] = copy.timetables;
    expect(held.origin).toEqual({ kind: "catalog", path: "BEI3.json" });
    expect(held.rejected).toEqual(["abcd1234"]);
    expect(held.subjects.map((_, extra) => extra.enabled)).toEqual([true, false]);
    expect(held.subjects.hash()).toBe(bei3.subjects.hash());
  });

  it("leaves the source as it was", () => {
    duplicateProfile(source, "Copy");
    expect(source).toMatchObject({ name: "Plan A", locked: true });
  });

  it("suggests the next free name", () => {
    expect(duplicateName([source], source)).toBe("Plan A 2");
    expect(duplicateName([source, profile("Plan A 2", [])], source)).toBe("Plan A 3");
  });
});
