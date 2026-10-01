// The notes' read view: plain text cut into lines, each line into text and
// links, `- [ ]` / `- [x]` lines into tasks. Every piece carries its `start`
// in the text, so a click on the view puts the caret at the very character
// in the text area, and ticking a task changes exactly one character.

export type NotesPiece =
  | { kind: "text"; start: number; text: string }
  | { kind: "link"; start: number; text: string; href: string };

export type NotesLine = {
  start: number;
  // A task line: `at` is the index of the box character (" " or "x").
  task: { done: boolean; at: number } | null;
  // Whitespace before a task's dash, kept so nested tasks stay indented.
  indent: string;
  pieces: NotesPiece[];
};

// GitHub's task list syntax, with `*` or `-`.
const TASK = /^(\s*)[-*] \[([ xX])\] /;

// http(s) and bare `www.` addresses; anything else (`javascript:`, `file:`)
// stays text.
const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;

export function notesLines(text: string): NotesLine[] {
  const lines: NotesLine[] = [];
  let start = 0;
  for (const line of text.split("\n")) {
    const task = TASK.exec(line);
    if (task) {
      const [prefix, indent, box] = task;
      lines.push({
        start,
        task: { done: box !== " ", at: start + prefix.length - 3 },
        indent,
        pieces: linkPieces(line.slice(prefix.length), start + prefix.length),
      });
    } else {
      lines.push({ start, task: null, indent: "", pieces: linkPieces(line, start) });
    }
    start += line.length + 1;
  }
  return lines;
}

// Ticks or unticks the task whose box character sits at `at`; anything else
// there leaves the text as it is.
export function toggleTask(text: string, at: number): string {
  const box = text[at];
  if (box !== " " && box !== "x" && box !== "X") return text;
  return text.slice(0, at) + (box === " " ? "x" : " ") + text.slice(at + 1);
}

function linkPieces(text: string, start: number): NotesPiece[] {
  const pieces: NotesPiece[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const link = trimLink(match[0]);
    const href = hrefOf(link);
    if (!href) continue;
    const at = match.index;
    if (at > last) pieces.push({ kind: "text", start: start + last, text: text.slice(last, at) });
    pieces.push({ kind: "link", start: start + at, text: link, href });
    last = at + link.length;
  }
  if (last < text.length)
    pieces.push({ kind: "text", start: start + last, text: text.slice(last) });
  return pieces;
}

// A sentence's full stop, a closing bracket around the link or quotes are
// not part of it. Brackets the link itself opens stay (Wikipedia's
// "…_(Begriffsklärung)").
function trimLink(link: string): string {
  let end = link.length;
  for (;;) {
    const last = link[end - 1];
    const body = link.slice(0, end);
    if (".,;:!?'".includes(last)) end--;
    else if (last === ")" && count(body, "(") < count(body, ")")) end--;
    else if (last === "]" && count(body, "[") < count(body, "]")) end--;
    else return body;
  }
}

function count(text: string, char: string): number {
  return text.split(char).length - 1;
}

function hrefOf(link: string): string | null {
  const absolute = /^www\./i.test(link) ? `https://${link}` : link;
  try {
    const url = new URL(absolute);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

// An uploaded notes file (the download, or any plain text) as notes: UTF-8
// only, its byte order mark dropped, Windows line ends made `\n` as the text
// area makes them. Refused: anything not text (`encoding`, a NUL byte counts:
// UTF-8 allows it, text files never hold it) and anything over the limit the
// text area keeps to (`length`).
export function notesFromFile(
  bytes: BufferSource,
  max: number,
): { text: string } | { error: "encoding" | "length" } {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { error: "encoding" };
  }
  if (text.includes("\0")) return { error: "encoding" };
  text = text.replace(/\r\n?/g, "\n");
  return text.length > max ? { error: "length" } : { text };
}
