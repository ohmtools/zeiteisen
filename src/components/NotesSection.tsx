import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { cn } from "cn";
import { getLocale, m } from "@/i18n";
import { PanelHeader } from "@/components/PanelHeader";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { dayStamp, downloadText } from "@/lib/download";
import { notesFromFile, notesLines, toggleTask, type NotesPiece } from "@/lib/notes";
import { toast } from "@/lib/toast";
import { MAX_NOTES_LENGTH } from "@/lib/primitives/storage";
import type { Step } from "@/lib/media";

// From 90% of the limit on, the count shows.
const SHOW_COUNT_FROM = MAX_NOTES_LENGTH * 0.9;

// The read view mirrors the text area's box and type (a 1px border, the
// text area's padding), so switching between them moves no line. Neither has
// the input's underline (user decision).
const VIEW =
  "min-h-0 flex-1 cursor-text overflow-y-auto rounded-lg border border-transparent px-2.5 py-2 text-base whitespace-pre-wrap wrap-break-word outline-none md:text-sm";

export type NotesHandle = {
  // Puts the caret at the end (the N shortcut).
  edit: () => void;
};

// The user's notes, plain text. Read as a view where links open and
// `- [ ]` lines are checkboxes; a click on the text (or Tab to it, or N) turns
// it into the text area with the caret there, leaving it turns it back.
// Every keystroke is saved (`useNotes`): there is no edit or save button. Empty
// notes are the text area alone. A panel: sidebar, sheet or page (user
// decision, was a strip under the grid). Lives in the deferred chunk.
export function NotesSection({
  ref,
  step,
  notes,
  onChange,
  onClose,
  onLeave,
}: {
  ref?: React.Ref<NotesHandle>;
  step: Step;
  notes: string;
  onChange: (notes: string) => void;
  onClose: () => void;
  // Escape in the text area: back to the grid.
  onLeave: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Where the caret goes once the text area is on screen, and how far it is
  // scrolled (`null` = to the end).
  const pending = useRef<{ at: number; scrollTop: number | null } | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  // An uploaded file waiting for "Replace", while there are notes to lose.
  const [replacing, setReplacing] = useState<{ file: string; text: string } | null>(null);
  const showTextarea = editing || notes === "";

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

  const replaceNotes = (text: string) => onChange(text);

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
    </>
  );

  const narrow = step === "narrow";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelHeader
        title={m.notes_title()}
        actions={actions}
        onBack={narrow ? onClose : undefined}
        onClose={narrow ? undefined : onClose}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] compact:px-6 compact:pb-6">
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
            onChange={(event) => onChange(event.target.value)}
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
      </div>

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
          <Button variant="secondary" onClick={downloadNotes}>
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
    </div>
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
