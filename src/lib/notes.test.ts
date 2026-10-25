import { describe, expect, it } from "vitest";
import {
  insertInline,
  insertLine,
  notesFromFile,
  notesLines,
  opensMention,
  toggleTask,
} from "@/lib/notes";

function rebuilt(text: string): string {
  // Every piece sits at its `start`: the view maps clicks back by it.
  return notesLines(text)
    .flatMap((line) => line.pieces)
    .map((piece) => {
      expect(text.slice(piece.start, piece.start + piece.text.length)).toBe(piece.text);
      return piece.text;
    })
    .join("|");
}

describe("notesLines", () => {
  it("cuts lines, empty ones included, with their offsets", () => {
    const lines = notesLines("a\n\nbc");
    expect(lines.map((line) => line.start)).toEqual([0, 2, 3]);
    expect(lines[1].pieces).toEqual([]);
    expect(rebuilt("a\n\nbc")).toBe("a|bc");
  });

  it("finds http(s) and www links and trims the sentence around them", () => {
    const text = "See https://example.org/a. Or (www.th-nuernberg.de), ok?";
    const links = notesLines(text)[0].pieces.filter((piece) => piece.kind === "link");
    expect(links.map((link) => [link.text, link.kind === "link" && link.href])).toEqual([
      ["https://example.org/a", "https://example.org/a"],
      ["www.th-nuernberg.de", "https://www.th-nuernberg.de/"],
    ]);
    expect(rebuilt(text)).toBe("See |https://example.org/a|. Or (|www.th-nuernberg.de|), ok?");
  });

  it("keeps brackets the link opens itself", () => {
    const [piece] = notesLines("https://de.wikipedia.org/wiki/A_(B)")[0].pieces;
    expect(piece.text).toBe("https://de.wikipedia.org/wiki/A_(B)");
  });

  it("leaves other schemes as text", () => {
    const pieces = notesLines("javascript:alert(1) file:///etc/passwd")[0].pieces;
    expect(pieces.every((piece) => piece.kind === "text")).toBe(true);
  });

  it("reads task lines, indented ones too, and points at the box", () => {
    const text = "- [ ] lab coat\n  * [x] register https://example.org\n-[ ] not a task";
    const [open, done, plain] = notesLines(text);
    expect(open.task).toEqual({ done: false, at: 3 });
    expect(open.pieces).toEqual([{ kind: "text", start: 6, text: "lab coat" }]);
    expect(done.indent).toBe("  ");
    expect(done.task?.done).toBe(true);
    expect(text[done.task!.at]).toBe("x");
    expect(done.pieces.map((piece) => piece.kind)).toEqual(["text", "link"]);
    expect(plain.task).toBeNull();
  });
});

describe("headings and links to a Termin", () => {
  it("reads # lines as headings, without the marks", () => {
    const [h1, h3, plain, empty] = notesLines("# Exams\n### Lab\n#nope\n# ");
    expect(h1.heading).toBe(true);
    expect(h1.pieces).toEqual([{ kind: "text", start: 2, text: "Exams" }]);
    expect(h3.heading).toBe(true);
    expect(plain.heading).toBe(false);
    expect(empty.heading).toBe(true);
    expect(empty.pieces).toEqual([]);
  });

  it("finds links to a Termin among text and web links", () => {
    const text = "- [ ] Sheet 3 @[2026-10-26#a3F9_-1c MA3 Ue 1.1], see www.th-nuernberg.de";
    const [line] = notesLines(text);
    expect(line.pieces.map((piece) => piece.kind)).toEqual(["text", "mention", "text", "link"]);
    const mention = line.pieces[1];
    expect(mention).toMatchObject({
      kind: "mention",
      date: "2026-10-26",
      hash: "a3F9_-1c",
      label: "MA3 Ue 1.1",
    });
    expect(rebuilt(text)).toBe(
      "Sheet 3 |@[2026-10-26#a3F9_-1c MA3 Ue 1.1]|, see |www.th-nuernberg.de",
    );
  });

  it("takes a link without a label, and leaves broken ones as text", () => {
    const [line] = notesLines("@[2026-10-26#abc] @[26.10.#abc x] @[2026-10-26 x]");
    expect(line.pieces.map((piece) => piece.kind)).toEqual(["mention", "text"]);
    expect(line.pieces[0]).toMatchObject({ label: "" });
  });
});

describe("insertLine", () => {
  it("uses the empty line the caret is on", () => {
    expect(insertLine("a\n\nb", 2, "- [ ] ")).toEqual({ text: "a\n- [ ] \nb", caret: 8 });
    expect(insertLine("", 0, "# ")).toEqual({ text: "# ", caret: 2 });
  });

  it("adds a line after the caret's line", () => {
    expect(insertLine("ab\ncd", 1, "- [ ] ")).toEqual({ text: "ab\n- [ ] \ncd", caret: 9 });
    expect(insertLine("ab", 2, "# ")).toEqual({ text: "ab\n# ", caret: 5 });
  });
});

describe("insertInline", () => {
  it("replaces the typed @, spaced from the words around it", () => {
    expect(insertInline("Exam @", 5, "@[x]", 1)).toEqual({ text: "Exam @[x] ", caret: 10 });
    expect(insertInline("Exam @ ok", 5, "@[x]", 1)).toEqual({ text: "Exam @[x] ok", caret: 9 });
  });

  it("puts a space before it after a word", () => {
    expect(insertInline("Exam", 4, "@[x]")).toEqual({ text: "Exam @[x] ", caret: 10 });
    expect(insertInline("(", 1, "@[x]")).toEqual({ text: "(@[x] ", caret: 6 });
  });
});

describe("opensMention", () => {
  it("opens at a line start, after a space or a bracket only", () => {
    expect(opensMention("@", 0)).toBe(true);
    expect(opensMention("a\n@", 2)).toBe(true);
    expect(opensMention("Exam @", 5)).toBe(true);
    expect(opensMention("(@", 1)).toBe(true);
    expect(opensMention("name@th.de", 4)).toBe(false);
    expect(opensMention("a b", 1)).toBe(false);
  });
});

describe("toggleTask", () => {
  it("ticks and unticks one box", () => {
    const text = "- [ ] a\n- [X] b";
    const [a, b] = notesLines(text);
    expect(toggleTask(text, a.task!.at)).toBe("- [x] a\n- [X] b");
    expect(toggleTask(text, b.task!.at)).toBe("- [ ] a\n- [ ] b");
  });

  it("leaves the text alone when no box sits there", () => {
    expect(toggleTask("- [ ] a", 0)).toBe("- [ ] a");
  });
});

describe("notesFromFile", () => {
  const bytes = (text: string) => new TextEncoder().encode(text);

  it("reads UTF-8 without its byte order mark, line ends as \\n", () => {
    expect(notesFromFile(bytes("﻿ä\r\nb\rc\n"), 100)).toEqual({ text: "ä\nb\nc\n" });
  });

  it("refuses what is not text", () => {
    expect(notesFromFile(new Uint8Array([0xff, 0xfe, 0x41]), 100)).toEqual({ error: "encoding" });
    expect(notesFromFile(bytes("a\0b"), 100)).toEqual({ error: "encoding" });
  });

  it("refuses notes over the limit, counted after the line ends", () => {
    expect(notesFromFile(bytes("ab\r\n"), 3)).toEqual({ text: "ab\n" });
    expect(notesFromFile(bytes("abcd"), 3)).toEqual({ error: "length" });
  });
});
