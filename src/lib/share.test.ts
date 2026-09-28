import { describe, expect, it } from "vitest";
import { profile, subject, timetable } from "@/lib/primitives/fixtures.test-util";
import { getSharedTimetables, parseProfileFile } from "@/lib/primitives/profile";
import {
  MAX_SHARE_LENGTH,
  decodeShare,
  decodeShareInput,
  encodeShare,
  profileFileText,
} from "@/lib/share";

// The link carries per timetable its hash and `enabled` bits, no names and
// never the timetables themselves or the global dates.

const first = timetable("BEI1", [subject("M1"), subject("PH")]);
first.subjects = first.subjects.with(1, { enabled: false });
const simon = profile("Simon", [first, timetable("BEI3", [subject("ET1")])]);

describe("encodeShare / decodeShare", () => {
  it("round-trips the shared timetables, no names", () => {
    const query = encodeShare(simon);
    expect(decodeShare(query)).toEqual(getSharedTimetables(simon));
    expect(query).not.toContain("Simon");
    expect(query).not.toContain("BEI1");
  });

  it("is a readable query: version, then one `t=<hash>.<bits>` per timetable", () => {
    const [one, two] = getSharedTimetables(simon);
    // BEI3 has every subject enabled: its hash alone.
    expect(two.subjects).toBeUndefined();
    expect(encodeShare(simon)).toBe(`v=1&t=${one.hash}.${one.subjects}&t=${two.hash}`);
    expect(encodeShare(profile("Empty", []))).toBe("v=1");
    expect(decodeShare("v=1")).toBeNull();
  });

  it("rejects garbage and other versions", () => {
    expect(decodeShare("nope")).toBeNull();
    expect(decodeShare("%E0%A4%A")).toBeNull();
    expect(decodeShare("v=1&t=nodot")).toEqual([{ hash: "nodot" }]);
    expect(decodeShare("v=1&t=.bits")).toBeNull();
    expect(decodeShare("v=2&t=abc.A")).toBeNull();
  });
});

describe("decodeShareInput", () => {
  const query = encodeShare(simon);
  const expected = getSharedTimetables(simon);

  it("takes a whole link, a bare fragment or the query alone", () => {
    expect(decodeShareInput(`https://example.org/app/#${query}`)).toEqual(expected);
    expect(decodeShareInput(`#${query}`)).toEqual(expected);
    expect(decodeShareInput(`  ${query}  `)).toEqual(expected);
  });

  it("is null for empty or broken input", () => {
    expect(decodeShareInput("   ")).toBeNull();
    expect(decodeShareInput("https://example.org/#v=1&t=")).toBeNull();
  });
});

it("profileFileText reads back through parseProfileFile", () => {
  const read = parseProfileFile(JSON.parse(profileFileText(simon)), "Simon.json", [])!;
  expect(read.name).toBe("Simon");
  expect(getSharedTimetables(read)).toEqual(getSharedTimetables(simon));
});

it("keeps a real-size profile far below the length guard", () => {
  // About the size of a real semester timetable: 100 subjects.
  const semester = Array.from({ length: 100 }, (_, i) => subject(`S${i}`));
  const big = profile(
    "Simon",
    ["BEI1", "BEI2", "BEI3", "BEI4"].map((name) => {
      const one = timetable(name, semester);
      // Some subjects off, so the link carries the bits too.
      one.subjects = one.subjects.with(0, { enabled: false });
      return one;
    }),
  );
  // Four full semesters: the link grows with the number of timetables, not
  // with their size.
  expect(encodeShare(big).length).toBeLessThan(MAX_SHARE_LENGTH / 2);
});
