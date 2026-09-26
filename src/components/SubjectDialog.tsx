import { useId, useState } from "react";
import { parseISO } from "date-fns";
import { AlertTriangle, CalendarPlus, CalendarRange, Trash2 } from "lucide-react";
import { cn } from "cn";
import { m } from "@/i18n";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LazyCalendar } from "@/components/LazyCalendar";
import { SuggestInput, type Suggestion } from "@/components/SuggestInput";
import {
  isDuplicate,
  Kind,
  sameSubject,
  type Day,
  type RepeatType,
} from "@/lib/primitives/subject";
import type { Timetable, TimetableSubjectExtra } from "@/lib/primitives/timetable";
import type { Subjects } from "@/lib/primitives/subject";
import { DAYS } from "@/lib/primitives/week";
import {
  draftOf,
  nextDate,
  REPEAT_TYPES,
  slotEnd,
  subjectOfDraft,
  suggestionsFor,
  withDates,
  type DraftProblem,
  type SlotDraft,
  type SubjectDraft,
  type Suggestions,
} from "@/lib/edit";
import { dayName, kindName, repeatTypeName, subjectLabel, subjectName } from "@/lib/subjects";

// What the editor works on: a subject of the timetable by index, or a new one.
export type SubjectTarget = { timetable: Timetable; index: number | null };

type Props = {
  target: SubjectTarget | null;
  // Every timetable on the device: the suggestions are learnt from them.
  library: readonly Timetable[];
  onOpenChange: (open: boolean) => void;
  // The timetable's subjects after the edit, addition or deletion.
  onSave: (subjects: Subjects<TimetableSubjectExtra>) => void;
};

const KINDS = Object.values(Kind);

// One dialog to add, edit and delete a subject. It never saves a subject the
// timetable already holds in exactly that form, and warns first that editing
// a catalog timetable ends its catalog updates.
export function SubjectDialog({ target, library, onOpenChange, onSave }: Props) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      {/* Taller than a phone: header and footer stay, the form scrolls. */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto]">
        {target && (
          <SubjectEditor
            key={`${target.timetable.name}/${target.index ?? "new"}`}
            target={target}
            library={library}
            onClose={() => onOpenChange(false)}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SubjectEditor({
  target,
  library,
  onClose,
  onSave,
}: {
  target: SubjectTarget;
  library: readonly Timetable[];
  onClose: () => void;
  onSave: (subjects: Subjects<TimetableSubjectExtra>) => void;
}) {
  const { timetable, index } = target;
  const original = index === null ? null : timetable.subjects.getSubject(index);
  const [draft, setDraft] = useState<SubjectDraft>(() => draftOf(original ?? undefined));
  // Field problems show once the user tried to save, not while they type.
  const [tried, setTried] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const id = useId();

  const result = subjectOfDraft(draft);
  const subject = "subject" in result ? result.subject : null;
  const duplicate =
    subject !== null && isDuplicate(timetable.subjects, subject, index ?? undefined);
  const unchanged = subject !== null && original !== null && sameSubject(subject, original);
  const problems = new Set(tried ? result.problems : []);
  const suggestions = suggestionsFor(library, draft);

  const change = (patch: Partial<SubjectDraft>) =>
    setDraft((previous) => ({ ...previous, ...patch }));

  const save = () => {
    setTried(true);
    if (!subject || duplicate || unchanged) return;
    // An edited subject keeps its place and selection, a new one arrives
    // enabled.
    onSave(
      index === null
        ? timetable.subjects.withAdded(subject, { enabled: true })
        : timetable.subjects.withSubject(index, subject),
    );
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{index === null ? m.subject_add_title() : m.subject_edit_title()}</DialogTitle>
        <DialogDescription>
          {m.subject_dialog_text({ timetable: timetable.name })}
        </DialogDescription>
      </DialogHeader>

      <form
        className="-mr-4 flex min-h-0 flex-col gap-4 overflow-y-auto pr-4"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Field label={m.subject_name()} htmlFor={id + "name"} problem={problemOf(problems, "name")}>
          <SuggestInput
            id={id + "name"}
            autoFocus
            value={draft.name}
            onValueChange={(name) => change({ name })}
            suggestions={suggestions.names.map((code) => {
              const full = subjectName(code);
              return { value: code, hint: full === code ? undefined : full };
            })}
            aria-invalid={problems.has("name") || undefined}
          />
        </Field>

        <Field label={m.subject_kinds()} problem={problemOf(problems, "kinds")}>
          <ToggleGroup
            variant="outline"
            size="sm"
            multiple
            className="flex-wrap"
            value={draft.kinds}
            // The kinds keep their file order ("Ue,SU" stays): it is part of
            // the subject's key, which ties its classes together. A new kind
            // goes last.
            onValueChange={(values) =>
              change({
                kinds: [
                  ...draft.kinds.filter((kind) => values.includes(kind)),
                  ...KINDS.filter((kind) => values.includes(kind) && !draft.kinds.includes(kind)),
                ],
              })
            }
          >
            {KINDS.map((kind) => (
              <ToggleGroupItem key={kind} value={kind} title={kind}>
                {kindName(kind)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>

        <Field
          label={m.subject_group_label()}
          htmlFor={id + "group"}
          problem={problemOf(problems, "group")}
        >
          <SuggestInput
            id={id + "group"}
            placeholder={m.subject_group_placeholder()}
            value={draft.group}
            onValueChange={(group) => change({ group })}
            suggestions={suggestions.groups.map((value) => ({ value }))}
            aria-invalid={problems.has("group") || undefined}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={m.subject_repeat()} htmlFor={id + "repeat"}>
            <Select
              value={draft.type}
              onValueChange={(type) => type && change({ type: type as RepeatType })}
              items={REPEAT_TYPES.map((type) => ({ value: type, label: repeatTypeName(type) }))}
            >
              <SelectTrigger id={id + "repeat"} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPEAT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {repeatTypeName(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {draft.type !== "I" && (
            <Field label={m.subject_day()} htmlFor={id + "day"}>
              <Select
                value={draft.day}
                onValueChange={(day) => day && change({ day: day as Day })}
                items={DAYS.map((day) => ({ value: day, label: dayName(day) }))}
              >
                <SelectTrigger id={id + "day"} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day) => (
                    <SelectItem key={day} value={day}>
                      {dayName(day)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>

        {draft.type === "I" ? (
          <DatesEditor
            draft={draft}
            suggestions={suggestions}
            problems={problems}
            onChange={(dates) => change({ dates })}
          />
        ) : (
          <SlotEditor
            slot={draft.slot}
            suggestions={suggestions}
            timeProblem={problems.has("time")}
            onChange={(slot) => change({ slot })}
          />
        )}

        <Field label={m.subject_note()} htmlFor={id + "note"}>
          <Input
            id={id + "note"}
            value={draft.note}
            onChange={(event) => change({ note: event.target.value })}
          />
        </Field>

        <label className="flex items-start gap-2">
          <Checkbox
            className="mt-0.5"
            checked={draft.onDemand}
            aria-describedby={id + "on-demand"}
            onCheckedChange={(checked) => change({ onDemand: checked === true })}
          />
          <span className="flex flex-col gap-0.5">
            {m.subject_on_demand()}
            <span id={id + "on-demand"} className="text-xs text-muted-foreground">
              {m.subject_on_demand_hint()}
            </span>
          </span>
        </label>

        {/* Enter in any field saves; the footer holds the visible button. */}
        <button type="submit" hidden />
      </form>

      <div className="flex flex-col gap-4">
        {timetable.origin.kind === "catalog" && (
          <Notice>{m.subject_catalog_warning({ timetable: timetable.name })}</Notice>
        )}
        {duplicate && <Notice destructive>{m.subject_error_duplicate()}</Notice>}
        <DialogFooter>
          {original !== null && (
            <Button variant="destructive" className="sm:mr-auto" onClick={() => setDeleting(true)}>
              <Trash2 data-icon="inline-start" />
              {m.subject_delete()}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            {m.cancel()}
          </Button>
          <Button disabled={duplicate || unchanged} onClick={save}>
            {index === null ? m.subject_add_confirm() : m.profile_save()}
          </Button>
        </DialogFooter>
      </div>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.subject_delete_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.subject_delete_text({
                subject: original ? subjectLabel(original) : "",
                timetable: timetable.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (index !== null) onSave(timetable.subjects.withRemoved(index));
                setDeleting(false);
                onClose();
              }}
            >
              {m.subject_delete_confirm()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const PROBLEM_TEXT: Record<DraftProblem, () => string> = {
  name: () => m.subject_error_name(),
  kinds: () => m.subject_error_kinds(),
  group: () => m.subject_error_group(),
  time: () => m.subject_error_time(),
  dates: () => m.subject_error_dates(),
  date: () => m.subject_error_date(),
};

function problemOf(problems: ReadonlySet<DraftProblem>, problem: DraftProblem): string | null {
  return problems.has(problem) ? PROBLEM_TEXT[problem]() : null;
}

function Field({
  label,
  htmlFor,
  problem,
  className,
  children,
}: {
  label: string;
  className?: string;
  htmlFor?: string;
  // What is wrong with the field, worded; nothing while it is fine.
  problem?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Label htmlFor={htmlFor} className="text-muted-foreground">
        {label}
      </Label>
      {children}
      {problem && <p className="text-xs text-destructive">{problem}</p>}
    </div>
  );
}

function Notice({ destructive, children }: { destructive?: boolean; children: React.ReactNode }) {
  return (
    <p
      className={
        destructive
          ? "flex items-start gap-2 text-xs text-destructive"
          : "flex items-start gap-2 text-xs text-muted-foreground"
      }
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// Start and end with the usual slots in their lists; a start that begins a
// usual slot fills in its end, unless the user already set one of their own.
function TimeInputs({
  slot,
  suggestions,
  invalid,
  onChange,
}: {
  slot: SlotDraft;
  suggestions: Suggestions;
  invalid: boolean;
  onChange: (slot: SlotDraft) => void;
}) {
  const id = useId();
  const setStart = (start: string) => {
    const end = slotEnd(suggestions, start);
    const ownEnd = slot.end !== "" && slot.end !== slotEnd(suggestions, slot.start);
    onChange({ ...slot, start, end: end && !ownEnd ? end : slot.end });
  };
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label={m.subject_start()} htmlFor={id + "start"}>
        <Input
          id={id + "start"}
          type="time"
          list={id + "starts"}
          value={slot.start}
          aria-invalid={invalid || undefined}
          onChange={(event) => setStart(event.target.value)}
        />
      </Field>
      <Field label={m.subject_end()} htmlFor={id + "end"}>
        <Input
          id={id + "end"}
          type="time"
          list={id + "ends"}
          value={slot.end}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange({ ...slot, end: event.target.value })}
        />
      </Field>
      <datalist id={id + "starts"}>
        {suggestions.slots.map((one) => (
          <option key={one.start + one.end} value={one.start} />
        ))}
      </datalist>
      <datalist id={id + "ends"}>
        {suggestions.slots.map((one) => (
          <option key={one.start + one.end} value={one.end} />
        ))}
      </datalist>
    </div>
  );
}

function PlaceInputs({
  slot,
  suggestions,
  onChange,
}: {
  slot: SlotDraft;
  suggestions: Suggestions;
  onChange: (slot: SlotDraft) => void;
}) {
  const id = useId();
  const plain = (values: string[]): Suggestion[] => values.map((value) => ({ value }));
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={m.subject_location()} htmlFor={id + "location"}>
        <SuggestInput
          id={id + "location"}
          value={slot.location}
          onValueChange={(location) => onChange({ ...slot, location })}
          suggestions={plain(suggestions.locations)}
        />
      </Field>
      <Field label={m.subject_professor()} htmlFor={id + "professor"}>
        <SuggestInput
          id={id + "professor"}
          value={slot.professor}
          onValueChange={(professor) => onChange({ ...slot, professor })}
          suggestions={plain(suggestions.professors)}
        />
      </Field>
    </div>
  );
}

// A weekly slot: the usual times as one-click chips, then start, end and
// where.
function SlotEditor({
  slot,
  suggestions,
  timeProblem,
  onChange,
}: {
  slot: SlotDraft;
  suggestions: Suggestions;
  timeProblem: boolean;
  onChange: (slot: SlotDraft) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <TimeInputs
          slot={slot}
          suggestions={suggestions}
          invalid={timeProblem}
          onChange={onChange}
        />
        {timeProblem && <p className="text-xs text-destructive">{m.subject_error_time()}</p>}
        <SlotChips slot={slot} suggestions={suggestions} onChange={onChange} />
      </div>
      <PlaceInputs slot={slot} suggestions={suggestions} onChange={onChange} />
    </>
  );
}

function SlotChips({
  slot,
  suggestions,
  onChange,
}: {
  slot: SlotDraft;
  suggestions: Suggestions;
  onChange: (slot: SlotDraft) => void;
}) {
  if (suggestions.slots.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={m.subject_slots()}>
      {suggestions.slots.map((one) => {
        const current = one.start === slot.start && one.end === slot.end;
        return (
          <Button
            key={one.start + one.end}
            type="button"
            variant={current ? "secondary" : "ghost"}
            size="xs"
            className="tabular-nums"
            aria-pressed={current}
            onClick={() => onChange({ ...slot, start: one.start, end: one.end })}
          >
            {one.start}-{one.end}
          </Button>
        );
      })}
    </div>
  );
}

// Listed dates, each with its own time and room, and the usual slots as chips
// like the weekly slot has. "A week later" repeats the last one; the calendar
// picks many at once, each new one taking the time and room of the last.
function DatesEditor({
  draft,
  suggestions,
  problems,
  onChange,
}: {
  draft: SubjectDraft;
  suggestions: Suggestions;
  problems: ReadonlySet<DraftProblem>;
  onChange: (dates: SubjectDraft["dates"]) => void;
}) {
  const { dates } = draft;
  const id = useId();
  const setRow = (i: number, patch: Partial<SubjectDraft["dates"][number]>) =>
    onChange(dates.map((one, j) => (j === i ? { ...one, ...patch } : one)));
  const valid = dates
    .filter((dated) => /^\d{4}-\d{2}-\d{2}$/.test(dated.date))
    .map((dated) => parseISO(dated.date));
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-muted-foreground">{m.subject_dates()}</Label>
      {dates.length > 0 && (
        <ul className="flex flex-col divide-y">
          {dates.map((dated, i) => (
            <li key={i} className="flex flex-col gap-2 py-3 first:pt-0">
              <div className="flex items-end gap-2">
                <Field label={m.subject_date()} htmlFor={`${id}date-${i}`} className="flex-1">
                  <Input
                    id={`${id}date-${i}`}
                    type="date"
                    value={dated.date}
                    aria-invalid={(problems.has("date") && !dated.date) || undefined}
                    onChange={(event) => setRow(i, { date: event.target.value })}
                  />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  title={m.subject_remove_date()}
                  aria-label={m.subject_remove_date()}
                  onClick={() => onChange(dates.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </Button>
              </div>
              <TimeInputs
                slot={dated}
                suggestions={suggestions}
                invalid={problems.has("time")}
                onChange={(slot) => setRow(i, slot)}
              />
              <SlotChips
                slot={dated}
                suggestions={suggestions}
                onChange={(slot) => setRow(i, slot)}
              />
              <PlaceInputs
                slot={dated}
                suggestions={suggestions}
                onChange={(slot) => setRow(i, slot)}
              />
            </li>
          ))}
        </ul>
      )}
      {(["dates", "date", "time"] as const)
        .filter((problem) => problems.has(problem))
        .map((problem) => (
          <p key={problem} className="text-xs text-destructive">
            {PROBLEM_TEXT[problem]()}
          </p>
        ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...dates, nextDate(draft, new Date())])}
        >
          <CalendarPlus data-icon="inline-start" />
          {dates.length === 0 ? m.subject_add_date() : m.subject_next_date()}
        </Button>
        <Popover>
          <PopoverTrigger render={<Button type="button" variant="outline" size="sm" />}>
            <CalendarRange data-icon="inline-start" />
            {m.subject_pick_dates()}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <LazyCalendar
              mode="multiple"
              selected={valid}
              defaultMonth={valid[valid.length - 1]}
              onSelect={(picked) => onChange(withDates(draft, picked ?? []))}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
