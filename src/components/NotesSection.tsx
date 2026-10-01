import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Download, Upload } from "lucide-react";
import { cn } from "cn";
import { getLocale, m } from "@/i18n";
import { Section } from "@/components/Section";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { dayStamp, downloadText } from "@/lib/download";
import { notesFromFile, notesLines, toggleTask, type NotesPiece } from "@/lib/notes";
import { toast } from "@/lib/toast";
import { MAX_NOTES_LENGTH, type NotesStrip } from "@/lib/primitives/storage";

// The strip's height bounds in CSS px, the same as the `clamp()` on its
// wrapper in App (the default, 144px, is there too).
const MIN_HEIGHT = 112;
const MAX_SHARE = 0.6;
const RESIZE_STEP = 16;

// From 90% of the limit on, the count shows.
const SHOW_COUNT_FROM = MAX_NOTES_LENGTH * 0.9;

// The read view mirrors the text area's box and type, so switching between
// them moves no line. Neither has the input's underline (user decision).
const VIEW =
  "min-h-0 flex-1 cursor-text overflow-y-auto border-0 text-base whitespace-pre-wrap wrap-break-word outline-none md:text-sm";

export type NotesHandle = {
  // Unfolds the strip and puts the caret at the end (the N shortcut).
  edit: () => void;
};

// The user's notes, plain text. Read as a view where links open and
// `- [ ]` lines are checkboxes; a click on the text (or Tab to it, or N) turns
// it into the text area with the caret there, leaving it turns it back.
// Every keystroke is saved (`useNotes`): there is no edit or save button. Empty
// notes are the text area alone. Desktop: a strip between grid and footer —
// a title row that folds it, and a top edge to drag its height by; phones:
// the Notes tab, titled, filling the page. The strip's height comes from App,
// so the deferred chunk loading shifts nothing. Lives in the deferred chunk.
export function NotesSection({
  ref,
  notes,
  onChange,
  strip,
  onStripPreview,
  onStripSave,
  onLeave,
}: {
  ref?: React.Ref<NotesHandle>;
  notes: string;
  onChange: (notes: string) => void;
  strip: NotesStrip;
  onStripPreview: (strip: NotesStrip) => void;
  onStripSave: (strip: NotesStrip) => void;
  // Escape in the text area: back to the grid.
  onLeave: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Where the caret goes once the text area is on screen, and how far it is
  // scrolled (`null` = to the end).
  const pending = useRef<{ at: number; scrollTop: number | null } | null>(null);
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  // An uploaded file waiting for "Replace", while there are notes to lose.
  const [replacing, setReplacing] = useState<{ file: string; text: string } | null>(null);
  const showTextarea = editing || notes === "";
  const collapsed = strip.collapsed;

  useEffect(() => {
    const textarea = textareaRef.current;
    const caret = pending.current;
    if (!textarea || !caret) return;
    pending.current = null;
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(caret.at, caret.at);
    textarea.scrollTop = caret.scrollTop ?? textarea.scrollHeight;
  });

  const startEditing = (at: number, scrollTop: number | null) => {
    pending.current = { at, scrollTop };
    if (collapsed) onStripSave({ ...strip, collapsed: false });
    setEditing(true);
    // Already on screen: no render follows to run the effect.
    const textarea = textareaRef.current;
    if (textarea && !collapsed) {
      pending.current = null;
      textarea.focus();
      textarea.setSelectionRange(at, at);
      if (scrollTop === null) textarea.scrollTop = textarea.scrollHeight;
    }
  };

  useImperativeHandle(ref, () => ({ edit: () => startEditing(notes.length, null) }));

  const onViewClick = (event: React.MouseEvent<HTMLDivElement>) => {
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

  // --- the strip's height (desktop) ---

  const clampHeight = (height: number) =>
    Math.round(Math.min(Math.max(height, MIN_HEIGHT), window.innerHeight * MAX_SHARE));
  const currentHeight = () =>
    sectionRef.current?.parentElement?.getBoundingClientRect().height ?? MIN_HEIGHT;
  const draggedHeight = (event: React.PointerEvent) =>
    drag.current
      ? clampHeight(drag.current.startHeight + drag.current.startY - event.clientY)
      : null;

  const onResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, startHeight: currentHeight() };
  };
  const onResizeMove = (event: React.PointerEvent) => {
    const height = draggedHeight(event);
    if (height !== null) onStripPreview({ ...strip, height });
  };
  const onResizeEnd = (event: React.PointerEvent) => {
    const height = draggedHeight(event);
    drag.current = null;
    if (height !== null) onStripSave({ ...strip, height });
  };
  const onResizeKey = (event: React.KeyboardEvent) => {
    const height = currentHeight();
    const next = {
      ArrowUp: height + RESIZE_STEP,
      ArrowDown: height - RESIZE_STEP,
      Home: MIN_HEIGHT,
      End: Infinity,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onStripSave({ ...strip, height: clampHeight(next) });
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

  const downloadNotes = () =>
    downloadText(
      m.notes_file_name({ date: dayStamp(new Date()) }),
      notes,
      "text/plain;charset=utf-8",
    );

  // Unfolds the strip: the new text is what the user wants to see.
  const replaceNotes = (text: string) => {
    onChange(text);
    if (collapsed) onStripSave({ ...strip, collapsed: false });
  };

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
      replaceNotes(read.text);
    } else {
      setReplacing({ file: file.name, text: read.text });
    }
  };

  // Kept from taking the focus: downloading leaves the text area as it is.
  const actions = (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={m.notes_upload()}
        title={m.notes_upload()}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => uploadInput.current?.click()}
      >
        <Upload />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={m.notes_download()}
        title={m.notes_download()}
        disabled={notes === ""}
        onMouseDown={(event) => event.preventDefault()}
        onClick={downloadNotes}
      >
        <Download />
      </Button>
    </div>
  );

  return (
    <Section
      ref={sectionRef}
      className={cn(
        "relative min-h-0 flex-1 desktop:gap-0 desktop:pt-0",
        collapsed && "desktop:pb-0",
      )}
    >
      {/* Desktop: the strip's top edge, dragged (or arrowed) to its height;
        a double click goes back to the default. */}
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={m.notes_resize()}
          aria-valuemin={MIN_HEIGHT}
          aria-valuenow={strip.height ?? undefined}
          tabIndex={0}
          className="absolute inset-x-0 top-0 z-10 hidden h-2 cursor-row-resize touch-none outline-none hover:bg-border focus-visible:bg-ring/50 desktop:block"
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          onPointerCancel={onResizeEnd}
          onKeyDown={onResizeKey}
          onDoubleClick={() => onStripSave({ ...strip, height: null })}
        />
      )}

      {/* Desktop: one row, the title folds the strip. */}
      <div className="hidden h-12 shrink-0 items-center gap-4 px-6 desktop:flex">
        <Button
          variant="ghost"
          size="xs"
          className="-ml-2"
          aria-expanded={!collapsed}
          title={collapsed ? m.notes_show() : m.notes_hide()}
          onClick={() => onStripSave({ ...strip, collapsed: !collapsed })}
        >
          {collapsed ? (
            <ChevronRight data-icon="inline-start" />
          ) : (
            <ChevronDown data-icon="inline-start" />
          )}
          {m.notes_title()}
        </Button>
        {limit}
        <div className="ml-auto">{actions}</div>
      </div>

      {/* Phones: the tab's title. */}
      <CardHeader className="desktop:hidden">
        <CardTitle>{m.notes_title()}</CardTitle>
        <CardDescription>{m.notes_text()}</CardDescription>
        <CardAction>{actions}</CardAction>
        {limit}
      </CardHeader>

      <CardContent className={cn("flex min-h-0 flex-1 flex-col", collapsed && "desktop:hidden")}>
        {showTextarea ? (
          <Textarea
            ref={textareaRef}
            aria-label={m.notes_title()}
            aria-keyshortcuts="n"
            placeholder={m.notes_placeholder()}
            maxLength={MAX_NOTES_LENGTH}
            value={notes}
            onChange={(event) => onChange(event.target.value)}
            onFocus={() => setEditing(true)}
            onBlur={() => setEditing(false)}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              event.currentTarget.blur();
              onLeave();
            }}
            className="min-h-0 flex-1 field-sizing-fixed border-0 py-0"
          />
        ) : (
          <div
            role="textbox"
            aria-multiline="true"
            aria-label={m.notes_title()}
            aria-keyshortcuts="n"
            tabIndex={0}
            className={VIEW}
            onFocus={onViewFocus}
            onClick={onViewClick}
          >
            {notesLines(notes).map(({ start, task, indent, pieces }) => (
              <div key={start} data-start={start} className={cn(task && "flex items-start gap-2")}>
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
                      <Pieces pieces={pieces} />
                    </span>
                  </>
                ) : pieces.length > 0 ? (
                  <Pieces pieces={pieces} />
                ) : (
                  <br />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

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

      <AlertDialog
        open={replacing !== null}
        onOpenChange={(open) => {
          if (!open) setReplacing(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.notes_upload_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.notes_upload_text({ file: replacing?.file ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* The way back, should the file turn out to be the wrong one. */}
          <Button variant="outline" className="sm:justify-self-start" onClick={downloadNotes}>
            <Download data-icon="inline-start" />
            {m.notes_download_first()}
          </Button>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (replacing) replaceNotes(replacing.text);
              }}
            >
              {m.notes_upload_confirm()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}

// Each piece in its own element carrying its offset in the text, one text
// node inside: `caretAt` maps a click back by it.
function Pieces({ pieces }: { pieces: NotesPiece[] }) {
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
    ) : (
      <span key={piece.start} data-start={piece.start}>
        {piece.text}
      </span>
    ),
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
