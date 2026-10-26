import {
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ArrowRightLeft,
  AtSign,
  CircleAlert,
  CircleSlash,
  Download,
  Heading,
  Layers,
  Link,
  Link2,
  Repeat,
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { dayStamp, downloadText } from "@/lib/download";
import { kindClass } from "@/lib/kinds";
import {
  isPast,
  labelParts,
  mentionResolver,
  mentionsIn,
  mentionLabel,
  classToken,
  mentionToken,
  type MentionTarget,
} from "@/lib/mentions";
import { groupName } from "@/lib/primitives/group";
import type { Profile, ProfileName } from "@/lib/primitives/profile";
import {
  insertInline,
  insertLine,
  insertLink,
  isKind,
  linkHref,
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

// Where the link from the insert bar's "Link" goes: in place of the
// selection `from`–`to` (the caret where equal), whose text becomes the
// link's; `null` without a caret: on a line of its own at the end.
type LinkTarget = { from: number; to: number } | null;

// The user's notes, plain text. Read as a view where links open (a
// `[text](url)` one by its text), `- [ ]` lines are checkboxes, `# ` lines
// headings and links to a Termin chips in the Termin's kind colour (struck
// through once past, red once the Termin is gone); a click on the text (or Tab to it, or N) turns it into the text
// area with the caret there, leaving it turns it back. Every keystroke is
// saved (`useNotes`): there is no edit or save button. Empty notes are the
// text area alone. The insert bar adds a task, a heading, a link with its
// own text (`LinkPopover`) or a link to a Termin (`MentionPicker`, also
// opened by an `@` typed at a word's start): right above the text from
// compact on, at the bottom on phones within thumb reach, there right above
// the keyboard. The
// body of a panel (`Panel`: sidebar, sheet or page; user decision, was a
// strip under the grid), its header buttons are `NotesActions`. Lives in the
// deferred chunk.
export function NotesSection({
  ref,
  notes,
  onChange,
  onLeave,
  timetables,
  profiles,
  activeName,
  dates,
  today,
  onJump,
  onShowGroup,
  onSelectProfile,
  reveal,
}: {
  ref?: React.Ref<NotesHandle>;
  notes: string;
  onChange: (notes: string) => void;
  // Escape in the text area: back to the grid.
  onLeave: () => void;
  // What links to a Termin are looked up in: the active profile's grid.
  timetables: readonly Timetable[];
  // Every profile: a link whose Termin is only in another one says so.
  profiles: readonly Profile[];
  activeName: ProfileName;
  dates: SemesterDates | null;
  today: Date;
  // A press on a link to a Termin: the grid shows it.
  onJump: (mention: MentionTarget) => void;
  onShowGroup: (entry: Entry) => void;
  onSelectProfile: (profile: ProfileName) => void;
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
  const [linking, setLinking] = useState<{ target: LinkTarget; label: string } | null>(null);
  // Fresh fields per opening, filled anew.
  const [linkKey, setLinkKey] = useState(0);
  // The keyboard covers the page on phones: the insert bar goes above it.
  const keyboard = useKeyboardInset(narrow && editing);
  // The revealed line is lit until its moment is over.
  const [faded, setFaded] = useState<number | null>(null);
  const lit = reveal && reveal.nonce !== faded ? reveal.start : null;
  const lines = notesLines(notes);
  const mentions = mentionsIn(lines);
  // One lookup per profiles, dates and minute, each week built once.
  const resolver = useMemo(
    () => mentionResolver(profiles, activeName, dates, today),
    [profiles, activeName, dates, today],
  );

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

  // The text area just got shorter above the keyboard: its caret back into
  // view (setting the selection again scrolls to it).
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!keyboard || !textarea || document.activeElement !== textarea) return;
    const { selectionStart, selectionEnd, selectionDirection } = textarea;
    textarea.setSelectionRange(selectionStart, selectionEnd, selectionDirection ?? undefined);
  }, [keyboard]);

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
  // `token`: a link to one Termin or to every Termin of a class.
  const pick = (token: string) => {
    const target = picking ?? { at: null, replace: 0 };
    setPicking(null);
    // Without a caret: a line of its own at the end.
    if (target.at === null) {
      const line = insertLine(notes, notes.length, "");
      apply(insertInline(line.text, line.caret, token));
      return;
    }
    const replace = target.replace > 0 && notes[target.at] === "@" ? target.replace : 0;
    apply(insertInline(notes, target.at, token, replace));
  };
  // On phones a popup opens without the keyboard: one left up from the text
  // area stood over the drawer, which then filled the screen above its
  // search field (user report). Tapping a field brings it back.
  const dropKeyboard = () => {
    if (narrow) textareaRef.current?.blur();
  };
  const openPicker = (target: Target) => {
    setPicking(target);
    dropKeyboard();
  };
  const openLink = () => {
    const textarea = textareaRef.current;
    const focused = textarea !== null && document.activeElement === textarea;
    const target = focused ? { from: textarea.selectionStart, to: textarea.selectionEnd } : null;
    setLinking({ target, label: target ? notes.slice(target.from, target.to) : "" });
    setLinkKey((key) => key + 1);
    dropKeyboard();
  };
  const insertNamedLink = (label: string, url: string) => {
    const target = linking?.target ?? null;
    // Without a caret: a line of its own at the end.
    const line = target ? null : insertLine(notes, notes.length, "");
    const result = line
      ? insertLink(line.text, line.caret, line.caret, label, url)
      : insertLink(notes, target!.from, target!.to, label, url);
    if (!result) return;
    setLinking(null);
    apply(result);
  };
  // Leaving the link popup: the caret (or selection) where it was.
  const cancelLink = () => {
    const target = linking?.target ?? null;
    setLinking(null);
    if (target) {
      pending.current = { at: target.to, scrollTop: viewRef.current?.scrollTop ?? null };
      setEditing(true);
    }
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
    onShowGroup,
    onSelectProfile,
    onReplace: (start, length, text) =>
      onChange(notes.slice(0, start) + text + notes.slice(start + length)),
  };

  // Kept from taking the focus: the text area keeps its caret.
  const keepFocus = (event: React.MouseEvent) => event.preventDefault();
  // Four labelled buttons side by side overran the sidebar in German: four
  // equal columns, the label under the icon, on every step.
  const barButton = "h-11 min-w-0 flex-1 flex-col gap-0.5 px-1 text-xs";
  const bar = (
    <div
      role="toolbar"
      aria-label={m.notes_insert()}
      className={cn(
        "flex shrink-0 gap-1",
        narrow ? "order-last -mx-4 border-t px-3 pt-2" : "-mx-2",
      )}
      // Right above the keyboard, which hides the page's own space below.
      style={
        keyboard > 0
          ? {
              marginBottom: `calc(${keyboard}px + 0.5rem - max(1rem, env(safe-area-inset-bottom)))`,
            }
          : undefined
      }
    >
      <Button
        variant="ghost"
        className={barButton}
        onMouseDown={keepFocus}
        onClick={() => apply(insertLine(notes, caret() ?? notes.length, "- [ ] "))}
      >
        <SquareCheck />
        {m.notes_insert_task()}
      </Button>
      <Button
        variant="ghost"
        className={barButton}
        onMouseDown={keepFocus}
        onClick={() => apply(insertLine(notes, caret() ?? notes.length, "# "))}
      >
        <Heading />
        {m.notes_insert_heading()}
      </Button>
      <LinkPopover
        trigger={
          <Button variant="ghost" className={barButton} onMouseDown={keepFocus}>
            <Link />
            {m.notes_insert_link()}
          </Button>
        }
        open={linking !== null}
        onOpenChange={(open) => (open ? openLink() : cancelLink())}
        formKey={linkKey}
        label={linking?.label ?? ""}
        onInsert={insertNamedLink}
      />
      <MentionPicker
        trigger={
          <Button variant="ghost" className={barButton} onMouseDown={keepFocus}>
            <AtSign />
            {m.notes_insert_mention()}
          </Button>
        }
        open={picking !== null}
        onOpenChange={(open) => {
          if (open) openPicker({ at: caret(), replace: 0 });
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
      {/* Right under the heading, the insert bar right above the text
          (user request; on phones it stays at the bottom, above the
          keyboard). */}
      <p className="text-xs text-muted-foreground">{m.notes_text()}</p>
      {limit}
      {bar}
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
              openPicker({ at, replace: 1 });
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

// "Link" in the insert bar: a link with its own text, `[text](url)`. The
// text starts as the selection; without one the address stands alone. Like
// the Termin picker (user request): a popover at the insert bar's button, a
// drawer on phones (the design's `Popup`). Only "Insert" puts it in, leaving
// it changes nothing. The drawer stays mounted between openings, so it
// slides in (a dialog keyed per opening mounted open and only slid out);
// `formKey` gives each opening fresh fields.
function LinkPopover({
  trigger,
  open,
  onOpenChange,
  formKey,
  label,
  onInsert,
}: {
  trigger: ReactElement<Record<string, unknown>>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formKey: number;
  label: string;
  onInsert: (label: string, url: string) => void;
}) {
  return (
    <Popup
      kind="popover"
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      title={m.notes_link_title()}
      titleHidden
      align="start"
      className="gap-3 compact:w-80"
    >
      <LinkForm key={formKey} label={label} onInsert={onInsert} />
    </Popup>
  );
}

function LinkForm({
  label,
  onInsert,
}: {
  label: string;
  onInsert: (label: string, url: string) => void;
}) {
  const narrow = useStep() === "narrow";
  const id = useId();
  const [text, setText] = useState(label);
  const [url, setUrl] = useState("");
  // The error once something was typed and left, or on a try to insert.
  const [checked, setChecked] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);
  const valid = linkHref(url) !== null;
  const insert = () => {
    if (valid) onInsert(text, url);
    else setChecked(true);
  };

  // Enter goes from the text on to the address, there it inserts. With its
  // text given, the focus starts on the address. Phones keep the keyboard
  // down until a field is tapped (the drawer's own way on touch).
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${id}-text`}>{m.notes_link_text()}</FieldLabel>
        <Input
          id={`${id}-text`}
          autoFocus={!narrow && label === ""}
          value={text}
          enterKeyHint="next"
          className={cn(narrow && "h-11")}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            urlRef.current?.focus();
          }}
        />
        <FieldDescription>{m.notes_link_text_hint()}</FieldDescription>
      </Field>
      <Field data-invalid={checked && !valid}>
        <FieldLabel htmlFor={`${id}-url`}>{m.notes_link_url()}</FieldLabel>
        <Input
          ref={urlRef}
          id={`${id}-url`}
          autoFocus={!narrow && label !== ""}
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          placeholder="https://…"
          aria-invalid={checked && !valid}
          className={cn("font-mono", narrow && "h-11")}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onBlur={() => setChecked(url.trim() !== "")}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            insert();
          }}
        />
        {checked && !valid && <FieldError>{m.notes_link_invalid()}</FieldError>}
      </Field>
      <Button
        disabled={checked && !valid}
        className={cn("compact:self-end", narrow && "h-11")}
        onClick={insert}
      >
        {m.notes_link_insert()}
      </Button>
    </>
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
  // A switched-off Termin: its group cell; one in another profile: that one.
  onShowGroup: (entry: Entry) => void;
  onSelectProfile: (profile: ProfileName) => void;
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

// A link to a Termin: a chip in its kind colour, "MA3 Ue Mo 26.10."; a
// press shows it in the grid. Struck through once past (and still pressable,
// for notes on an earlier class). Its Termin switched off, or only in another
// profile: a muted dashed chip, its press says so and offers the way there
// (the groups, the profile); nothing is wrong with the link. Found nowhere:
// red and dashed, its press says what no longer fits (another time) and
// offers to link it again or keep its label as text, never guessed back by
// itself.
function MentionChip({
  mention,
  links,
}: {
  mention: Extract<NotesPiece, { kind: "mention" }>;
  links: Links;
}) {
  const status = links.resolver.status(mention);
  // A link to every Termin of a class is never past: it shows the next.
  const past = mention.date !== null && isPast(mention.date, links.today);
  const replace = (text: string) => links.onReplace(mention.start, mention.text.length, text);
  const keepText = {
    label: m.mention_keep_text(),
    icon: <Type />,
    run: () => replace(mention.label),
  };
  if (status.kind === "ok") {
    const { entry } = status;
    // A link to every Termin shows its label as written (it may name only a
    // part: `@[MA3]`), coloured by the kind it names, neutral without one.
    const parts = mention.date === null ? labelParts(mention.label) : null;
    const kinds = parts ? (parts.kinds?.split(",").filter(isKind) ?? []) : entry.subject.kind;
    return (
      <button
        type="button"
        tabIndex={-1}
        data-start={mention.start}
        title={mention.date === null ? m.mention_show_next() : m.mention_show()}
        onClick={() => links.onJump(mention)}
        className={cn(
          CHIP,
          "cursor-pointer text-foreground hover:brightness-[0.97] dark:hover:brightness-125",
          kinds.length > 0 ? kindClass(kinds) : "border-border bg-secondary",
          past && STRUCK,
        )}
      >
        <b className="font-semibold">{parts?.name ?? entry.subject.name}</b>
        {kinds.length > 0 && <span>{kinds.join(", ")}</span>}
        {parts?.group && <span>{parts.group}</span>}
        <ChipDate mention={mention} />
      </button>
    );
  }
  if (status.kind === "off" || status.kind === "elsewhere") {
    const { entry } = status;
    return (
      <NoticeChip
        mention={mention}
        tone="muted"
        past={past}
        icon={<CircleSlash />}
        title={status.kind === "off" ? m.mention_off_title() : m.mention_elsewhere_title()}
        text={
          status.kind === "off"
            ? m.mention_off_text({ label: mention.label })
            : m.mention_elsewhere_text({ label: mention.label, profile: status.profile })
        }
        actions={[
          status.kind === "off"
            ? {
                label: m.details_show_group(),
                icon: <Layers />,
                run: () => links.onShowGroup(entry),
              }
            : {
                label: m.mention_switch_profile({ profile: status.profile }),
                icon: <ArrowRightLeft />,
                run: () => links.onSelectProfile(status.profile),
              },
          keepText,
        ]}
      />
    );
  }
  if (mention.date === null) {
    return (
      <NoticeChip
        mention={mention}
        tone="red"
        past={false}
        icon={<CircleAlert />}
        title={m.mention_class_broken_title()}
        text={m.mention_class_broken_text({ label: mention.label })}
        actions={[
          ...status.candidates.map((entry) => ({
            label: m.mention_relink(),
            detail: mentionLabel(entry.subject),
            icon: <Link2 />,
            run: () => replace(classToken(entry.subject)),
          })),
          keepText,
        ]}
      />
    );
  }
  // The same class that day at another time says what changed.
  const moved = status.candidates.find((entry) => mentionLabel(entry.subject) === mention.label);
  return (
    <NoticeChip
      mention={mention}
      tone="red"
      past={past}
      icon={<CircleAlert />}
      title={m.mention_broken_title()}
      text={
        moved
          ? m.mention_moved_text({
              date: dayDateLabel(mention.date),
              label: mention.label,
              time: formatTime(moved.meeting.startTime),
              old: mention.time,
            })
          : m.mention_broken_text({ date: dayDateLabel(mention.date) })
      }
      actions={[
        ...status.candidates.map((entry) => ({
          label: m.mention_relink(),
          detail: `${entry.subject.kind.join(", ")}${entry.subject.group ? ` ${groupName(entry.subject.group)}` : ""} ${formatTime(entry.meeting.startTime)}`,
          icon: <Link2 />,
          run: () => replace(mentionToken(entry)),
        })),
        keepText,
      ]}
    />
  );
}

// A chip's date; a link to every Termin of a class has none, its mark
// says "every Termin".
function ChipDate({ mention }: { mention: Extract<NotesPiece, { kind: "mention" }> }) {
  return mention.date === null ? (
    <Repeat aria-label={m.mention_every()} className="size-3" />
  ) : (
    <span className="font-mono">{dayDateLabel(mention.date)}</span>
  );
}

// Past dates: struck through, the chip's parts too (they are flex items).
const STRUCK = "line-through decoration-[1.5px] *:line-through *:decoration-[1.5px]";

// A dashed chip whose press explains itself: muted (the Termin is there, just
// not shown) or red (it is gone), with what can be done about it.
function NoticeChip({
  mention,
  tone,
  past,
  icon,
  title,
  text,
  actions,
}: {
  mention: Extract<NotesPiece, { kind: "mention" }>;
  tone: "muted" | "red";
  past: boolean;
  icon: ReactNode;
  title: string;
  text: string;
  actions: { label: string; detail?: string; icon: ReactNode; run: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const red = tone === "red";
  return (
    <Popup
      kind="popover"
      open={open}
      onOpenChange={setOpen}
      title={title}
      titleHidden
      align="start"
      className="gap-3 compact:w-80"
      trigger={
        <button
          type="button"
          tabIndex={-1}
          data-start={mention.start}
          className={cn(
            CHIP,
            "cursor-pointer border-dashed",
            red
              ? "border-red bg-red/10 text-red"
              : "border-muted-foreground/60 text-muted-foreground",
            past && STRUCK,
          )}
        >
          {red ? <Unlink className="size-3" /> : <CircleSlash className="size-3" />}
          <b className="font-semibold">{mention.label}</b>
          <ChipDate mention={mention} />
        </button>
      }
    >
      <div className="flex gap-2">
        <span
          className={cn(
            "mt-0.5 shrink-0 [&_svg]:size-4",
            red ? "text-red" : "text-muted-foreground",
          )}
        >
          {icon}
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{text}</p>
        </div>
      </div>
      <div className="-mx-2 flex flex-col">
        {actions.map((action) => (
          <Button
            key={action.label + (action.detail ?? "")}
            variant="ghost"
            className="justify-start gap-2 px-2"
            onClick={() => {
              setOpen(false);
              action.run();
            }}
          >
            {action.icon}
            {action.label}
            {action.detail && (
              <span className="font-mono text-xs text-muted-foreground">{action.detail}</span>
            )}
          </Button>
        ))}
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
