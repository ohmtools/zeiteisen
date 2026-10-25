import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  AtSign,
  CircleAlert,
  Download,
  Heading,
  Link2,
  SquareCheck,
  Type,
  Unlink,
  Upload,
} from "lucide-react";
import { cn } from "cn";
import { getLocale, m } from "@/i18n";
import { MentionPicker } from "@/components/MentionPicker";
import { Popup } from "@/components/ohmtools/popup";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { dayStamp, downloadText } from "@/lib/download";
import { kindClass } from "@/lib/kinds";
import {
  isPast,
  mentionResolver,
  mentionsIn,
  mentionToken,
  type MentionTarget,
} from "@/lib/mentions";
import {
  insertInline,
  insertLine,
  notesFromFile,
  notesLines,
  opensMention,
  toggleTask,
  type NotesPiece,
} from "@/lib/notes";
import { useStep } from "@/lib/ohmtools/steps";
import { toast } from "@/lib/ohmtools/toast";
import type { SemesterDates } from "@/lib/primitives/meta";
import { formatTime } from "@/lib/primitives/subject";
import { MAX_NOTES_LENGTH } from "@/lib/primitives/storage";
import type { Timetable } from "@/lib/primitives/timetable";
import type { Entry } from "@/lib/layout";
import { dayDateLabel } from "@/lib/subjects";

// From 90% of the limit on, the count shows.
const SHOW_COUNT_FROM = MAX_NOTES_LENGTH * 0.9;

// The read view mirrors the text area's box and type (a 1px border, the
// text area's padding), so switching between them moves no line. Neither has
// the input's underline (user decision). Headings keep the text's size for
// the same reason, bold only.
const VIEW =
  "relative min-h-0 flex-1 cursor-text overflow-y-auto rounded-lg border border-transparent px-2.5 py-2 text-base whitespace-pre-wrap wrap-break-word outline-none md:text-sm";

export type NotesHandle = {
  // Puts the caret at `at`, the end without (the N shortcut).
  edit: (at?: number) => void;
};

// Where the Termin picker's link goes: at `at`, replacing `replace`
// characters there (the typed `@`, or nothing from the insert bar); `null`
// without a caret: on a line of its own at the end.
type Target = { at: number | null; replace: number };

// The user's notes, plain text. Read as a view where links open, `- [ ]`
// lines are checkboxes, `# ` lines headings and links to a Termin chips in
// the Termin's kind colour (struck through once past, red once the Termin
// is gone); a click on the text (or Tab to it, or N) turns it into the text
// area with the caret there, leaving it turns it back. Every keystroke is
// saved (`useNotes`): there is no edit or save button. Empty notes are the
// text area alone. The insert bar adds a task, a heading or a link to a
// Termin (`MentionPicker`, also opened by an `@` typed at a word's start):
// on top from compact on, at the bottom on phones, within thumb reach. The
// body of a panel (`Panel`: sidebar, sheet or page; user decision, was a
// strip under the grid), its header buttons are `NotesActions`. Lives in the
// deferred chunk.
export function NotesSection({
  ref,
  notes,
  onChange,
  onLeave,
  timetables,
  dates,
  today,
  onJump,
  reveal,
}: {
  ref?: React.Ref<NotesHandle>;
  notes: string;
  onChange: (notes: string) => void;
  // Escape in the text area: back to the grid.
  onLeave: () => void;
  // What links to a Termin are looked up in: the active profile's grid.
  timetables: readonly Timetable[];
  dates: SemesterDates | null;
  today: Date;
  // A press on a link to a Termin: the grid shows it.
  onJump: (mention: MentionTarget) => void;
  // "Go to note" in a block's details: the line starting at `start` scrolls
  // into view and lights up.
  reveal: { start: number; nonce: number } | null;
}) {
  const narrow = useStep() === "narrow";
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  // Where the caret goes once the text area is on screen, and how far it is
  // scrolled (`null` = to the end).
  const pending = useRef<{ at: number; scrollTop: number | null } | null>(null);
  const showTextarea = editing || notes === "";
  const [picking, setPicking] = useState<Target | null>(null);
  // The revealed line is lit until its moment is over.
  const [faded, setFaded] = useState<number | null>(null);
  const lit = reveal && reveal.nonce !== faded ? reveal.start : null;
  const lines = notesLines(notes);
  const mentions = mentionsIn(lines);
  // One lookup per profile and dates, each week built once.
  const resolver = useMemo(() => mentionResolver(timetables, dates), [timetables, dates]);

  useEffect(() => {
    const textarea = textareaRef.current;
    const caret = pending.current;
    if (!textarea || !caret) return;
    pending.current = null;
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(caret.at, caret.at);
    textarea.scrollTop = caret.scrollTop ?? textarea.scrollHeight;
  });

  // "Go to note": the line into view, lit for a moment.
  useEffect(() => {
    if (!reveal) return;
    const frame = requestAnimationFrame(() =>
      viewRef.current
        ?.querySelector(`[data-line="${reveal.start}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" }),
    );
    const done = setTimeout(() => setFaded(reveal.nonce), 1600);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(done);
    };
  }, [reveal]);

  const startEditing = (at: number, scrollTop: number | null) => {
    pending.current = { at, scrollTop };
    setEditing(true);
    // Already on screen: no render follows to run the effect.
    const textarea = textareaRef.current;
    if (textarea) {
      pending.current = null;
      textarea.focus();
      textarea.setSelectionRange(at, at);
      if (scrollTop === null) textarea.scrollTop = textarea.scrollHeight;
    }
  };

  useImperativeHandle(ref, () => ({ edit: (at) => startEditing(at ?? notes.length, null) }));

  // The caret where the text area has one.
  const caret = () => {
    const textarea = textareaRef.current;
    return textarea && document.activeElement === textarea ? textarea.selectionStart : null;
  };
  // A change from the insert bar or the picker: the text area with the caret
  // after what came in, once the new text is rendered.
  const apply = ({ text, caret }: { text: string; caret: number }) => {
    if (text.length > MAX_NOTES_LENGTH) {
      toast.error(
        m.notes_full({ max: new Intl.NumberFormat(getLocale()).format(MAX_NOTES_LENGTH) }),
      );
      return;
    }
    const scrolled = textareaRef.current?.scrollTop ?? viewRef.current?.scrollTop ?? null;
    pending.current = { at: caret, scrollTop: caret >= text.length - 1 ? null : scrolled };
    setEditing(true);
    onChange(text);
  };
  const pick = (entry: Entry) => {
    const target = picking ?? { at: null, replace: 0 };
    setPicking(null);
    // Without a caret: a line of its own at the end.
    if (target.at === null) {
      const line = insertLine(notes, notes.length, "");
      apply(insertInline(line.text, line.caret, mentionToken(entry)));
      return;
    }
    const replace = target.replace > 0 && notes[target.at] === "@" ? target.replace : 0;
    apply(insertInline(notes, target.at, mentionToken(entry), replace));
  };
  // Leaving the picker without a pick: back to the typed `@`.
  const cancelPicking = () => {
    const target = picking;
    setPicking(null);
    if (target && target.at !== null && target.replace > 0) {
      pending.current = {
        at: target.at + target.replace,
        scrollTop: viewRef.current?.scrollTop ?? null,
      };
      setEditing(true);
    }
  };

  const onViewClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // A popup of a red link is portalled out, its clicks still bubble here.
    if (!(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return;
    // Links and checkboxes do their own thing; a selection is for copying.
    if (event.target instanceof Element && event.target.closest("a, button, [role=checkbox]"))
      return;
    if (window.getSelection()?.isCollapsed === false) return;
    const at = caretAt(event.clientX, event.clientY) ?? notes.length;
    startEditing(at, event.currentTarget.scrollTop);
  };

  // Reached by Tab: straight into the text area. A mouse focuses the view
  // too, on the press, but its click places the caret (`:focus-visible` is
  // keyboard only).
  const onViewFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && event.currentTarget.matches(":focus-visible"))
      startEditing(notes.length, null);
  };

  // --- pieces ---

  const count = new Intl.NumberFormat(getLocale());
  const limit = notes.length >= SHOW_COUNT_FROM && (
    <span className="text-sm text-muted-foreground">
      {notes.length >= MAX_NOTES_LENGTH
        ? m.notes_full({ max: count.format(MAX_NOTES_LENGTH) })
        : m.notes_count({
            count: count.format(notes.length),
            max: count.format(MAX_NOTES_LENGTH),
          })}
    </span>
  );

  const links: Links = {
    resolver,
    today,
    onJump,
    onReplace: (start, length, text) =>
      onChange(notes.slice(0, start) + text + notes.slice(start + length)),
  };

  // Kept from taking the focus: the text area keeps its caret.
  const keepFocus = (event: React.MouseEvent) => event.preventDefault();
  const barButton = cn(narrow ? "h-11 flex-1" : "px-2");
  const bar = (
    <div
      role="toolbar"
      aria-label={m.notes_insert()}
      className={cn(
        "flex shrink-0 gap-1",
        narrow ? "order-last -mx-4 border-t px-3 pt-2" : "-mx-2 -mt-2",
      )}
    >
      <Button
        variant="ghost"
        size={narrow ? "default" : "sm"}
        className={barButton}
        onMouseDown={keepFocus}
        onClick={() => apply(insertLine(notes, caret() ?? notes.length, "- [ ] "))}
      >
        <SquareCheck />
        {m.notes_insert_task()}
      </Button>
      <Button
        variant="ghost"
        size={narrow ? "default" : "sm"}
        className={barButton}
        onMouseDown={keepFocus}
        onClick={() => apply(insertLine(notes, caret() ?? notes.length, "# "))}
      >
        <Heading />
        {m.notes_insert_heading()}
      </Button>
      <MentionPicker
        trigger={
          <Button
            variant="ghost"
            size={narrow ? "default" : "sm"}
            className={barButton}
            onMouseDown={keepFocus}
          >
            <AtSign />
            {m.notes_insert_mention()}
          </Button>
        }
        open={picking !== null}
        onOpenChange={(open) => {
          if (open) setPicking({ at: caret(), replace: 0 });
          else cancelPicking();
        }}
        timetables={timetables}
        dates={dates}
        today={today}
        mentions={mentions}
        onPick={pick}
      />
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 compact:pb-2">
      {bar}
      <p className="text-xs text-muted-foreground">{m.notes_text()}</p>
      {limit}
      {showTextarea ? (
        <Textarea
          ref={textareaRef}
          aria-label={m.notes_title()}
          aria-keyshortcuts="n"
          placeholder={m.notes_placeholder()}
          maxLength={MAX_NOTES_LENGTH}
          value={notes}
          onChange={(event) => {
            const value = event.target.value;
            const at = event.target.selectionStart - 1;
            onChange(value);
            // An `@` typed at a word's start: the picker, which replaces it.
            if (value.length === notes.length + 1 && opensMention(value, at))
              setPicking({ at, replace: 1 });
          }}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.currentTarget.blur();
            onLeave();
          }}
          className="min-h-0 flex-1 field-sizing-fixed"
        />
      ) : (
        <div
          ref={viewRef}
          role="textbox"
          aria-multiline="true"
          aria-label={m.notes_title()}
          aria-keyshortcuts="n"
          tabIndex={0}
          className={VIEW}
          onFocus={onViewFocus}
          onClick={onViewClick}
        >
          {lines.map(({ start, task, heading, indent, pieces }) => (
            <div
              key={start}
              data-start={start}
              data-line={start}
              className={cn(
                "-mx-1 rounded-sm px-1 transition-colors duration-500",
                task && "flex items-start gap-2",
                heading && "font-semibold",
                lit === start && "bg-accent",
              )}
            >
              {task ? (
                <>
                  {indent && <span data-start={start}>{indent}</span>}
                  {/* Out of the Tab order, like the links: Tab lands on the
                      view, which turns into the text area. */}
                  <Checkbox
                    tabIndex={-1}
                    className="my-px md:my-0.5"
                    checked={task.done}
                    aria-label={m.notes_task({
                      text: pieces.map((piece) => piece.text).join(""),
                    })}
                    onCheckedChange={() => onChange(toggleTask(notes, task.at))}
                  />
                  <span
                    className={cn("min-w-0", task.done && "text-muted-foreground line-through")}
                  >
                    <Pieces pieces={pieces} links={links} />
                  </span>
                </>
              ) : pieces.length > 0 ? (
                <Pieces pieces={pieces} links={links} />
              ) : (
                <br />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The notes panel's header buttons: upload (a `.txt` that replaces the
// notes; when notes are lost, the toast offers "Undo" instead of a question
// first) and download. Kept from taking the focus: they leave the text area
// as it is.
export function NotesActions({
  notes,
  onChange,
}: {
  notes: string;
  onChange: (notes: string) => void;
}) {
  const uploadInput = useRef<HTMLInputElement>(null);
  // The notes as they are now, for an "Undo" clicked later.
  const current = useRef(notes);
  useEffect(() => {
    current.current = notes;
  }, [notes]);
  const count = new Intl.NumberFormat(getLocale());

  const downloadNotes = () =>
    downloadText(
      m.notes_file_name({ date: dayStamp(new Date()) }),
      notes,
      "text/plain;charset=utf-8",
    );

  const onUpload = async (file: File) => {
    const read = notesFromFile(await file.arrayBuffer(), MAX_NOTES_LENGTH);
    if ("error" in read) {
      toast.error(
        `${file.name}: ${
          read.error === "length"
            ? m.notes_upload_error_length({ max: count.format(MAX_NOTES_LENGTH) })
            : m.notes_upload_error_encoding()
        }`,
      );
    } else if (notes === "" || notes === read.text) {
      onChange(read.text);
    } else {
      // Undo brings the old notes back while nothing was typed since.
      const old = notes;
      onChange(read.text);
      toast.success(m.toast_notes_replaced({ file: file.name }), {
        duration: 8000,
        action: {
          label: m.undo(),
          onClick: () => {
            if (current.current === read.text) onChange(old);
          },
        },
      });
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={m.notes_upload()}
        title={m.notes_upload()}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => uploadInput.current?.click()}
      >
        <Upload />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={m.notes_download()}
        title={m.notes_download()}
        disabled={notes === ""}
        onMouseDown={(event) => event.preventDefault()}
        onClick={downloadNotes}
      >
        <Download />
      </Button>
      <input
        ref={uploadInput}
        type="file"
        accept=".txt,text/plain"
        className="hidden"
        onChange={(event) => {
          const [file] = event.target.files ?? [];
          event.target.value = "";
          if (file) void onUpload(file);
        }}
      />
    </>
  );
}

// What a link to a Termin needs: where to look it up, today (past ones are
// struck through), and what a press does.
type Links = {
  resolver: ReturnType<typeof mentionResolver>;
  today: Date;
  onJump: (mention: MentionTarget) => void;
  // A red link linked again or kept as text: `length` characters at `start`
  // become `text`.
  onReplace: (start: number, length: number, text: string) => void;
};

// Each piece in its own element carrying its offset in the text, one text
// node inside: `caretAt` maps a click back by it.
function Pieces({ pieces, links }: { pieces: NotesPiece[]; links: Links }) {
  return pieces.map((piece) =>
    piece.kind === "link" ? (
      <a
        key={piece.start}
        data-start={piece.start}
        href={piece.href}
        tabIndex={-1}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-4"
      >
        {piece.text}
      </a>
    ) : piece.kind === "mention" ? (
      <MentionChip key={piece.start} mention={piece} links={links} />
    ) : (
      <span key={piece.start} data-start={piece.start}>
        {piece.text}
      </span>
    ),
  );
}

const CHIP =
  "mx-px inline-flex h-5 max-w-full items-center gap-1 rounded-sm border px-1.5 align-[-0.25em] text-xs leading-none font-normal whitespace-nowrap no-underline";

// A link to a Termin: a chip in its kind colour, "MA3 Ue Mon, 26.10."; a
// press shows it in the grid. Struck through once past (and still pressable,
// for notes on an earlier class). Red and dashed when no Termin on that date
// has its hash any more: a press offers to link it again or keep its label
// as text, never guessed back by itself.
function MentionChip({
  mention,
  links,
}: {
  mention: Extract<NotesPiece, { kind: "mention" }>;
  links: Links;
}) {
  const entry = links.resolver.entry(mention);
  if (!entry) return <BrokenChip mention={mention} links={links} />;
  const past = isPast(mention.date, links.today);
  return (
    <button
      type="button"
      tabIndex={-1}
      data-start={mention.start}
      title={m.mention_show()}
      onClick={() => links.onJump(mention)}
      className={cn(
        CHIP,
        "cursor-pointer text-foreground hover:brightness-[0.97] dark:hover:brightness-125",
        kindClass(entry.subject.kind),
        past && "line-through decoration-[1.5px] *:line-through *:decoration-[1.5px]",
      )}
    >
      <b className="font-semibold">{entry.subject.name}</b>
      <span>{entry.subject.kind.join(", ")}</span>
      <span className="font-mono">{dayDateLabel(mention.date)}</span>
    </button>
  );
}

function BrokenChip({
  mention,
  links,
}: {
  mention: Extract<NotesPiece, { kind: "mention" }>;
  links: Links;
}) {
  const [open, setOpen] = useState(false);
  // The same class on that day, by the name the label starts with.
  const candidates = open
    ? links.resolver
        .onDate(mention.date)
        .filter((entry) => mention.label.startsWith(`${entry.subject.name}`))
    : [];
  const replace = (text: string) => {
    setOpen(false);
    links.onReplace(mention.start, mention.text.length, text);
  };
  return (
    <Popup
      kind="popover"
      open={open}
      onOpenChange={setOpen}
      title={m.mention_broken_title()}
      titleHidden
      align="start"
      className="gap-3 compact:w-80"
      trigger={
        <button
          type="button"
          tabIndex={-1}
          data-start={mention.start}
          className={cn(CHIP, "cursor-pointer border-dashed border-red bg-red/10 text-red")}
        >
          <Unlink className="size-3" />
          {mention.label && <b className="font-semibold">{mention.label}</b>}
          <span className="font-mono">{dayDateLabel(mention.date)}</span>
        </button>
      }
    >
      <div className="flex gap-2">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-red" />
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{m.mention_broken_title()}</p>
          <p className="text-xs text-muted-foreground">
            {m.mention_broken_text({ date: dayDateLabel(mention.date) })}
          </p>
        </div>
      </div>
      <div className="-mx-2 flex flex-col">
        {candidates.map((entry) => (
          <Button
            key={entry.key}
            variant="ghost"
            className="justify-start gap-2 px-2"
            onClick={() => replace(mentionToken(entry))}
          >
            <Link2 />
            {m.mention_relink()}
            <span className="font-mono text-xs text-muted-foreground">
              {entry.subject.kind.join(", ")} {formatTime(entry.meeting.startTime)}
            </span>
          </Button>
        ))}
        <Button
          variant="ghost"
          className="justify-start gap-2 px-2"
          onClick={() => replace(mention.label || dayDateLabel(mention.date))}
        >
          <Type />
          {m.mention_keep_text()}
        </Button>
      </div>
    </Popup>
  );
}

// The offset in the notes of the character under a click on the view, `null`
// below the last line (the caret then goes to the end).
function caretAt(x: number, y: number): number | null {
  let node: Node | null = null;
  let offset = 0;
  if (typeof document.caretPositionFromPoint === "function") {
    const position = document.caretPositionFromPoint(x, y);
    node = position?.offsetNode ?? null;
    offset = position?.offset ?? 0;
  } else if (typeof document.caretRangeFromPoint === "function") {
    // Safari before 18.4.
    const range = document.caretRangeFromPoint(x, y);
    node = range?.startContainer ?? null;
    offset = range?.startOffset ?? 0;
  }
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) {
    const piece = node.parentElement?.closest<HTMLElement>("[data-start]");
    return piece ? Number(piece.dataset.start) + offset : null;
  }
  // An empty line, or the space beside a checkbox: the line's start.
  const line = node instanceof HTMLElement ? node.closest<HTMLElement>("[data-start]") : null;
  return line ? Number(line.dataset.start) : null;
}
