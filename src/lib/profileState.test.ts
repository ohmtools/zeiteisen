import { describe, expect, it } from "vitest";
import { m } from "@/i18n";
import { profile, subject, timetable } from "@/lib/primitives/fixtures.test-util";
import {
  initialState,
  removedState,
  renamedState,
  syncedState,
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
