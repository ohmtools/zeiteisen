import { describe, expect, it } from "vitest";
import { m } from "@/i18n";
import { profile, subject, timetable } from "@/lib/primitives/fixtures.test-util";
import {
  initialState,
  removedState,
  renamedState,
  restoredState,
  syncedState,
  withTimetableBack,
  withTimetableRestored,
  type ProfilesState,
} from "@/lib/profileState";

const a = profile("A", [timetable("BEI3", [subject("M1")])]);
const b = profile("B", []);
const state = (active: string, ...profiles: ReturnType<typeof profile>[]): ProfilesState => ({
  profiles,
  active,
});
const names = (s: ProfilesState) => s.profiles.map((one) => one.name);

describe("initialState", () => {
  it("opens the stored active profile while it exists, else the first", () => {
    expect(initialState([a, b], "B").active).toBe("B");
    expect(initialState([a, b], "Gone").active).toBe("A");
    expect(initialState([a, b], null).active).toBe("A");
  });

  it("starts a fresh default profile on an empty device", () => {
    const fresh = initialState([], "A");
    expect(names(fresh)).toEqual([m.profile_default()]);
    expect(fresh.active).toBe(m.profile_default());
  });
});

describe("syncedState (another tab wrote the profiles)", () => {
  it("keeps this tab's active profile while it exists", () => {
    const next = syncedState(state("B", a, b), [a, b, profile("C", [])]);
    expect(next.active).toBe("B");
    expect(names(next)).toEqual(["A", "B", "C"]);
  });

  it("follows the active profile renamed there", () => {
    const next = syncedState(state("B", a, b), [a, profile("B renamed", [])]);
    expect(next.active).toBe("B renamed");
  });

  it("falls back to the first profile when the active one was deleted there", () => {
    expect(syncedState(state("B", a, b), [a]).active).toBe("A");
    // One gone and one new at an unchanged count reads as a rename; with the
    // count changed it cannot be one.
    expect(syncedState(state("B", a, b), [a, profile("C", [])]).active).toBe("C");
    expect(syncedState(state("B", a, b, profile("X", [])), [a, profile("C", [])]).active).toBe("A");
  });

  it("starts a fresh default when every profile was deleted there", () => {
    const next = syncedState(state("A", a, b), []);
    expect(names(next)).toEqual([m.profile_default()]);
    expect(next.active).toBe(m.profile_default());
  });
});

describe("renamedState", () => {
  it("renames, and the active name moves along", () => {
    const next = renamedState(state("A", a, b), "A", "  Plan ");
    expect(names(next)).toEqual(["Plan", "B"]);
    expect(next.active).toBe("Plan");
    expect(next.profiles[0].timetables).toBe(a.timetables);
  });

  it("refuses a taken name, an empty one and a locked profile; case alone is a rename", () => {
    const before = state("A", a, b);
    expect(renamedState(before, "A", "b")).toBe(before);
    expect(renamedState(before, "A", " ")).toBe(before);
    expect(renamedState(state("A", { ...a, locked: true }, b), "A", "C").active).toBe("A");
    expect(names(renamedState(before, "A", "a"))).toEqual(["a", "B"]);
  });
});

describe("removedState", () => {
  it("moves the active profile to the first one left", () => {
    expect(removedState(state("A", a, b), "A")).toEqual(state("B", b));
    expect(removedState(state("A", a, b), "B")).toEqual(state("A", a));
  });

  it("refuses a locked profile, and deleting the last one starts a fresh default", () => {
    const locked = state("A", { ...a, locked: true });
    expect(removedState(locked, "A")).toBe(locked);
    expect(names(removedState(state("B", b), "B"))).toEqual([m.profile_default()]);
  });
});

describe("restoredState (undo a deleted profile)", () => {
  it("brings back the state before when nothing changed since", () => {
    const before = state("B", a, b);
    const after = removedState(before, "B");
    expect(restoredState(after, before, after, "B")).toBe(before);
  });

  it("drops the fresh default that deleting the last profile started", () => {
    const before = state("A", a);
    const after = removedState(before, "A");
    expect(names(restoredState(after, before, after, "A"))).toEqual(["A"]);
  });

  it("puts the profile back at its place and keeps the active one after other changes", () => {
    const before = state("A", a, b, profile("C", []));
    const after = removedState(before, "B");
    const later = { ...after, profiles: [...after.profiles, profile("D", [])], active: "D" };
    const back = restoredState(later, before, after, "B");
    expect(names(back)).toEqual(["A", "B", "C", "D"]);
    expect(back.active).toBe("D");
  });

  it("leaves it gone when its name is taken by now", () => {
    const before = state("A", a, b);
    const after = removedState(before, "B");
    const later = { ...after, profiles: [...after.profiles, profile("b", [])] };
    expect(restoredState(later, before, after, "B")).toBe(later);
  });
});

describe("withTimetableBack (undo a removed timetable)", () => {
  const one = timetable("BEI3", [subject("M1")]);
  const two = timetable("BEI4", []);

  it("puts the timetable back at its place", () => {
    const removed = profile("P", [two]);
    expect(withTimetableBack(removed, one, 0).timetables.map((t) => t.name)).toEqual([
      "BEI3",
      "BEI4",
    ]);
  });

  it("refuses while locked or with the name taken in any case", () => {
    const locked = { ...profile("P", [two]), locked: true };
    expect(withTimetableBack(locked, one, 0)).toBe(locked);
    const taken = profile("P", [timetable("bei3", [])]);
    expect(withTimetableBack(taken, one, 0)).toBe(taken);
  });
});

describe("withTimetableRestored (undo a deleted class)", () => {
  const before = timetable("BEI3", [subject("M1"), subject("M2")], {
    origin: { kind: "catalog", path: "timetables/BEI3.json" },
  });
  const after = before.subjects.withRemoved(1);
  const edited = profile("P", [{ ...before, subjects: after, origin: { kind: "local" } }]);

  it("brings back the timetable as it was, origin included", () => {
    expect(withTimetableRestored(edited, before, after).timetables[0]).toBe(before);
  });

  it("changes nothing once the timetable was edited again", () => {
    const again = profile("P", [{ ...before, subjects: after.withRemoved(0) }]);
    expect(withTimetableRestored(again, before, after)).toBe(again);
  });
});
