import { describe, expect, it } from "vitest";
import { degreeNames } from "@/lib/degrees";
import { withOwnDegrees } from "@/lib/ownDegrees";
import type { OwnDegreeFile } from "@/lib/primitives/storage";

const own = (name: string, codes: string[] = []): OwnDegreeFile => ({
  name,
  data: {
    subjects: codes.map((code) => ({
      code,
      name: { de: code, en: code },
      sws: { lecture: 0, exercise: 0, laboratory: 0 },
      description: { de: "-", en: "-" },
      test: { de: "-", en: "-" },
    })),
  },
});

describe("degreeNames", () => {
  it("stores typed names NFC and trimmed, and says what they replace", () => {
    const [plain, held, catalog] = degreeNames(
      [" B-Wirtschäft ", "B-ME", "B-EI"],
      [own("B-ME")],
      ["B-EI"],
    );
    expect(plain).toEqual({ name: "B-Wirtschäft", problem: null, replaces: null });
    expect(held).toEqual({ name: "B-ME", problem: null, replaces: "own" });
    expect(catalog).toEqual({ name: "B-EI", problem: null, replaces: "catalog" });
  });

  it("matches held and catalog files in any case; a catalog file keeps its spelling", () => {
    const [held, catalog] = degreeNames(["b-me", "b-ei"], [own("B-ME")], ["B-EI"]);
    expect(held).toMatchObject({ name: "b-me", replaces: "own" });
    expect(catalog).toMatchObject({ name: "B-EI", replaces: "catalog" });
  });

  it("refuses a name repeated in any case, and names that are no file names", () => {
    const [first, again, bad] = degreeNames(["B-EI", "b-ei", "a/b"], [], []);
    expect(first.problem).toBeNull();
    expect(again.problem).not.toBeNull();
    expect(bad.problem).not.toBeNull();
  });
});

describe("withOwnDegrees", () => {
  it("replaces a held file of the same name in any case; added files go last", () => {
    const next = withOwnDegrees([own("B-EI", ["OLD"]), own("B-ME")], [own("b-ei", ["NEW"])]);
    expect(next.map((file) => file.name)).toEqual(["B-ME", "b-ei"]);
    expect(next[1].data.subjects[0].code).toBe("NEW");
  });
});
