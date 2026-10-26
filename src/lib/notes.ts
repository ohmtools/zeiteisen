import { Kind } from "@/lib/primitives/subject";

// The notes' read view: plain text cut into lines, each line into text,
// links (bare or `[text](url)`) and links to a Termin, `- [ ]` / `- [x]` lines into tasks, `# `
// lines into headings. Every piece carries its `start` in the text, so a
// click on the view puts the caret at the very character in the text area,
// and ticking a task changes exactly one character.

export type NotesPiece =
  | { kind: "text"; start: number; text: string }
  // A bare address is its own text; `[text](url)` shows its text alone,
  // `start` is where that text begins.
  | { kind: "link"; start: number; text: string; href: string }
  // `@[2026-10-26 09:45 MA3 Ue 2.1]`: the Termin on that date at that start
  // time whose name, kinds and group the label spells (`@/lib/mentions`).
  // `@[MA3 Ue 2.1]`, without date and time: every Termin of that class.
  | ({ kind: "mention"; start: number; text: string; label: string } & (
      | { date: string; time: string }
      | { date: null; time: null }
    ));

export type NotesLine = {
  start: number;
  // A task line: `at` is the index of the box character (" " or "x").
  task: { done: boolean; at: number } | null;
  // A `# ` line (up to three `#`): a heading, its pieces without the marks.
  heading: boolean;
  // Whitespace before a task's dash, kept so nested tasks stay indented.
  indent: string;
  pieces: NotesPiece[];
};

// GitHub's task list syntax, with `*` or `-`.
const TASK = /^(\s*)[-*] \[([ xX])\] /;

// Markdown's headings; one look for all three levels.
const HEADING = /^#{1,3} /;

// A link to a Termin: date, start time and label, brackets around; without
// date and time a link to every Termin of the class.
const MENTION = /@\[(?:(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) )?([^\]\n]+)\]/g;

const KINDS = new Set<string>(Object.values(Kind));

export function isKind(value: string): value is Kind {
  return KINDS.has(value);
}

// A link's label back in its parts, read from the end (a name may hold
// spaces): a group like "2.1", the kinds ("SU,Ue"), the name; `null` for a
// part not there. Without kinds the name is one word, so `@[…]` around
// words stays text. `null` when it reads as none.
export type LabelParts = { name: string; kinds: string | null; group: string | null };

export function labelParts(label: string): LabelParts | null {
  const words = label.trim().split(/ +/);
  const group = words.length > 1 && /^\d+\.\d+$/.test(words.at(-1)!) ? words.pop()! : null;
  const kinds = words.length > 1 && words.at(-1)!.split(",").every(isKind) ? words.pop()! : null;
  if (words.length === 0 || words[0] === "" || (kinds === null && words.length > 1)) return null;
  return { name: words.join(" "), kinds, group };
}

// http(s) and bare `www.` addresses; anything else (`javascript:`, `file:`)
// stays text.
const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;

// Markdown's link with its own text: `[text](url)`, the address one level of
// brackets deep (Wikipedia's "…_(Begriffsklärung)").
const NAMED_LINK = /\[([^\]\n]+)\]\(((?:https?:\/\/|www\.)(?:[^\s()]|\([^\s()]*\))+)\)/gi;

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
        heading: false,
        indent,
        pieces: inlinePieces(line.slice(prefix.length), start + prefix.length),
      });
    } else {
      const heading = HEADING.exec(line);
      const skip = heading ? heading[0].length : 0;
      lines.push({
        start,
        task: null,
        heading: heading !== null,
        indent: "",
        pieces: inlinePieces(line.slice(skip), start + skip),
      });
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

// Links to a Termin first, links with their own text in the text between
// them, then bare addresses.
function inlinePieces(text: string, start: number): NotesPiece[] {
  const pieces: NotesPiece[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION)) {
    const [token, date, time, label] = match;
    // Without a date only a label makes a link (a whole one, or hand-typed
    // a part: `@[MA3]`, `@[MA3 Ue]`, `@[MA3 2.1]`): `@[…]` typed around
    // anything else stays text.
    if (date === undefined && labelParts(label) === null) continue;
    const at = match.index;
    if (at > last) pieces.push(...namedLinkPieces(text.slice(last, at), start + last));
    const piece = { kind: "mention" as const, start: start + at, text: token, label: label.trim() };
    pieces.push(
      date === undefined ? { ...piece, date: null, time: null } : { ...piece, date, time },
    );
    last = at + match[0].length;
  }
  if (last < text.length) pieces.push(...namedLinkPieces(text.slice(last), start + last));
  return pieces;
}

// `[text](url)`: the text alone, at its own offset (the brackets and the
// address are only in the text area). An address that is no http(s) one
// stays as typed.
function namedLinkPieces(text: string, start: number): NotesPiece[] {
  const pieces: NotesPiece[] = [];
  let last = 0;
  for (const match of text.matchAll(NAMED_LINK)) {
    const href = hrefOf(match[2]);
    const label = match[1];
    if (!href || label.trim() === "") continue;
    const at = match.index;
    if (at > last) pieces.push(...linkPieces(text.slice(last, at), start + last));
    pieces.push({ kind: "link", start: start + at + 1, text: label, href });
    last = at + match[0].length;
  }
  if (last < text.length) pieces.push(...linkPieces(text.slice(last), start + last));
  return pieces;
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

// The insert bar's "Task" and "Heading": `prefix` on the empty line the
// caret is on, else on a new line after the caret's line. The caret goes
// after the prefix.
export function insertLine(
  text: string,
  at: number,
  prefix: string,
): { text: string; caret: number } {
  const lineStart = text.lastIndexOf("\n", at - 1) + 1;
  const found = text.indexOf("\n", at);
  const lineEnd = found === -1 ? text.length : found;
  if (text.slice(lineStart, lineEnd).trim() === "") {
    const next = text.slice(0, lineStart) + prefix + text.slice(lineEnd);
    return { text: next, caret: lineStart + prefix.length };
  }
  const next = text.slice(0, lineEnd) + "\n" + prefix + text.slice(lineEnd);
  return { text: next, caret: lineEnd + 1 + prefix.length };
}

// A link to a Termin put in at `at`, replacing `replace` characters there
// (the typed `@`): a space before it unless a line, a space or a bracket
// comes first, a space after it unless one follows. The caret goes after it.
export function insertInline(
  text: string,
  at: number,
  token: string,
  replace = 0,
): { text: string; caret: number } {
  const before = text.slice(0, at);
  const after = text.slice(at + replace);
  const inserted =
    (before === "" || /[\s(]$/.test(before) ? "" : " ") + token + (/^\s/.test(after) ? "" : " ");
  return { text: before + inserted + after, caret: before.length + inserted.length };
}

// The insert bar's "Link": `[label](url)` in place of `from`–`to` (the
// selection, or the caret where they are equal), a bare address without a
// label. Brackets in the label would end it early, so they turn round;
// brackets in the address are escaped. A space before it unless a line, a
// space or a bracket comes first, a space after it unless a space or a
// sentence's mark follows. The caret goes after it. `null`: no http(s)
// address (`linkHref`).
export function insertLink(
  text: string,
  from: number,
  to: number,
  label: string,
  url: string,
): { text: string; caret: number } | null {
  const href = linkHref(url);
  if (!href) return null;
  const name = label.replace(/\s+/g, " ").trim().replace(/\[/g, "(").replace(/\]/g, ")");
  const address = href.replace(/\(/g, "%28").replace(/\)/g, "%29");
  const token = name === "" || name === href ? address : `[${name}](${address})`;
  const before = text.slice(0, from);
  const after = text.slice(to);
  const inserted =
    (before === "" || /[\s(]$/.test(before) ? "" : " ") +
    token +
    (/^[\s.,;:!?)\]]/.test(after) ? "" : " ");
  return { text: before + inserted + after, caret: before.length + inserted.length };
}

// What was typed into the link's address field as the address it links to:
// `https://` added where no scheme was typed; `null` for anything but http(s)
// or without a host.
export function linkHref(url: string): string | null {
  const typed = url.trim();
  if (typed === "" || /\s/.test(typed)) return null;
  const absolute = /^[a-z][a-z\d+.-]*:/i.test(typed) ? typed : `https://${typed}`;
  try {
    const parsed = new URL(absolute);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.hostname.includes(".") || parsed.hostname === "localhost" ? parsed.href : null;
  } catch {
    return null;
  }
}

// Whether the `@` just typed at `at` starts a link to a Termin: at the
// start of a line, after a space or a bracket. Inside a word (an e-mail
// address) it stays a character.
export function opensMention(text: string, at: number): boolean {
  return text[at] === "@" && (at === 0 || /[\s(]/.test(text[at - 1]));
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
