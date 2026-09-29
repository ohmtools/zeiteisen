import { useId, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CloudCheck,
  CloudOff,
  CloudSync,
  Download,
  ListPlus,
  Plus,
  Square,
  SquareCheck,
  SquareMinus,
  Trash2,
} from "lucide-react";
import { toast } from "@/lib/toast";
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
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/Section";
import { ClassPicker } from "@/components/ClassPicker";
import { GroupCell } from "@/components/GroupCell";
import { SubjectDialog, type SubjectTarget } from "@/components/SubjectDialog";
import type { Catalog } from "@/lib/primitives/catalog";
import { sameSubject, type Subject, type Subjects } from "@/lib/primitives/subject";
import {
  timetableHasUpdate,
  type Timetable,
  type TimetableName,
  type TimetableSubjectExtra,
} from "@/lib/primitives/timetable";
import { buildTree, stateOf, type CategoryNode, type TimetableNode } from "@/lib/primitives/tree";
import { warningsFor } from "@/lib/primitives/warnings";
import { downloadTimetable } from "@/lib/download";
import {
  categoryState,
  groupKey,
  toggleCategory,
  toggleGroup,
  usedGroups,
  type Kept,
  type Toggle,
} from "@/lib/groupToggle";
import type { Highlight, SubjectRef } from "@/lib/link";
import { tintStyleOf, tintSteps } from "@/lib/tint";
import { warningLines } from "@/lib/warnings";
import { nameProblemText } from "@/lib/names";
import { normalizeName, sameName } from "@/lib/primitives/name";

type Props = {
  className?: string;
  timetables: Timetable[];
  // Every timetable on the device: the subject editor learns its suggestions
  // from them.
  library: readonly Timetable[];
  locked: boolean;
  // What the headings show about the catalog: offline nothing can be checked.
  catalog: Catalog;
  online: boolean;
  onSetEnabled: (name: TimetableName, indexes: number[], enabled: boolean) => void;
  // Opens the update dialog for a timetable the catalog has a new version of.
  onUpdate: (name: TimetableName) => void;
  onRename: (from: TimetableName, to: string) => void;
  onRemove: (name: TimetableName) => void;
  // A timetable's subjects after the user added, edited or deleted one.
  onEditSubjects: (name: TimetableName, subjects: Subjects<TimetableSubjectExtra>) => void;
  // Opens the timetable picker for the active profile.
  onAddTimetables: () => void;
  // The group cell under the mouse or focus, whose blocks the grid keeps lit.
  onHighlight?: (highlight: Highlight | null) => void;
  // A grid block's cell to show: its timetable opens, the cell scrolls into
  // view and flashes. `nonce` tells two jumps to the same cell apart.
  flash?: (SubjectRef & { nonce: number }) | null;
};

export type Flash = NonNullable<Props["flash"]>;

function saveTimetable(timetable: Timetable) {
  downloadTimetable(timetable);
  toast.success(m.toast_timetable_saved());
}

// What the heading of a timetable shows about the catalog: nothing for a local
// one, nor while there is no index to compare with (the catalog is ignored or
// was never read); offline before anything else, because then nothing can be
// checked; otherwise whether an update is waiting. A refused update counts as
// current — the user settled it.
type CatalogStatus = "none" | "offline" | "update" | "current";

function catalogStatus(timetable: Timetable, catalog: Catalog, online: boolean): CatalogStatus {
  if (timetable.origin.kind !== "catalog" || !catalog.index) return "none";
  if (!online) return "offline";
  return timetableHasUpdate(timetable, catalog) ? "update" : "current";
}

// The group selection of the active profile, one tree per timetable. Profile,
// import, lock and the exports sit in `ProfileSection` above.
export function GroupTree({
  className,
  timetables,
  library,
  locked,
  catalog,
  online,
  onSetEnabled,
  onUpdate,
  onRename,
  onRemove,
  onEditSubjects,
  onAddTimetables,
  onHighlight,
  flash = null,
}: Props) {
  const tree = buildTree(timetables);
  const tints = tintSteps(timetables.map((timetable) => timetable.name));
  // The timetable the confirm dialog is asking about; removal is not undoable,
  // so it never happens on the first click.
  const [removing, setRemoving] = useState<TimetableName | null>(null);
  // The subject the editor is open for, by timetable name and index (`null`
  // adds one), plus the subject as it was when opened. Read against the
  // current timetables: the editor closes when its timetable goes away, or
  // when another tab changed what sits at that index (a removal shifts the
  // indexes, and saving would overwrite another subject).
  const [editing, setEditing] = useState<{
    name: TimetableName;
    index: number | null;
    subject: Subject | null;
  } | null>(null);
  const editTimetable = editing ? timetables.find((one) => one.name === editing.name) : undefined;
  const stillThere =
    editing !== null &&
    editTimetable !== undefined &&
    (editing.index === null ||
      (editing.subject !== null &&
        editing.index < editTimetable.subjects.length &&
        sameSubject(editTimetable.subjects.getSubject(editing.index), editing.subject)));
  const editTarget: SubjectTarget | null =
    editing && editTimetable && stillThere && !locked
      ? { timetable: editTimetable, index: editing.index }
      : null;

  return (
    <Section className={cn("min-h-0 desktop:flex-1", className)}>
      <CardHeader>
        <CardTitle>{m.tree_title()}</CardTitle>
        <CardDescription>{m.tree_description()}</CardDescription>
      </CardHeader>
      {/* One spacing unit (24px) between the timetables. On desktop only the
          trees scroll: the add button below stays in view,
          right under the trees while they are short. */}
      <CardContent className="flex flex-col gap-6 desktop:min-h-0 desktop:overflow-y-auto">
        {tree.length === 0 ? (
          <CardDescription>{m.tree_empty()}</CardDescription>
        ) : (
          tree.map((node) => (
            <TimetableTree
              key={node.timetable.name}
              node={node}
              tint={tints.get(node.timetable.name) ?? 0}
              locked={locked}
              status={catalogStatus(node.timetable, catalog, online)}
              taken={(name) =>
                timetables.some(
                  (other) => other.name !== node.timetable.name && sameName(other.name, name),
                )
              }
              onSetEnabled={(indexes, enabled) =>
                onSetEnabled(node.timetable.name, indexes, enabled)
              }
              onUpdate={() => onUpdate(node.timetable.name)}
              onRename={(to) => onRename(node.timetable.name, to)}
              onRemove={() => setRemoving(node.timetable.name)}
              onEdit={(index) =>
                setEditing({
                  name: node.timetable.name,
                  index,
                  subject: index === null ? null : node.timetable.subjects.getSubject(index),
                })
              }
              flash={flash?.timetableName === node.timetable.name ? flash : null}
              onHighlight={(indexes) =>
                onHighlight?.(indexes ? { timetableName: node.timetable.name, indexes } : null)
              }
            />
          ))
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" disabled={locked} onClick={onAddTimetables}>
          <ListPlus data-icon="inline-start" />
          {m.profile_add_timetables()}
        </Button>
      </CardFooter>

      <SubjectDialog
        target={editTarget}
        library={library}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSave={(subjects) => {
          if (editing) onEditSubjects(editing.name, subjects);
        }}
      />

      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.tree_remove_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.tree_remove_text({ name: removing ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing !== null) onRemove(removing);
                setRemoving(null);
              }}
            >
              {m.tree_remove_confirm()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}

type TimetableProps = {
  node: TimetableNode;
  // Step from `tintSteps`, the one this timetable's blocks carry in the grid.
  tint: number;
  locked: boolean;
  status: CatalogStatus;
  // Whether the profile already holds this name under another timetable.
  taken: (name: string) => boolean;
  onSetEnabled: (indexes: number[], enabled: boolean) => void;
  onUpdate: () => void;
  onRename: (to: string) => void;
  onRemove: () => void;
  // Opens the subject editor: a subject by index, or `null` for a new one.
  onEdit: (index: number | null) => void;
  // A jump to one of this timetable's subjects.
  flash: Flash | null;
  // The subjects of the group cell under the mouse or focus; `null` = none.
  onHighlight: (indexes: readonly number[] | null) => void;
};

// Each timetable's warnings render right below its own tree, not in a separate
// panel (user decision).
function TimetableTree({
  node,
  tint,
  locked,
  status,
  taken,
  onSetEnabled,
  onUpdate,
  onRename,
  onRemove,
  onEdit,
  flash,
  onHighlight,
}: TimetableProps) {
  const { timetable } = node;
  const name = timetable.name;
  const warnings = warningLines(warningsFor(timetable));
  // Several timetables make the sidebar long, so each one folds away. Open by
  // default: the tree is what the section is for.
  const [open, setOpen] = useState(true);
  // Labels the category rulers for screen readers.
  const id = useId();
  // A jump into a folded timetable unfolds it first.
  const [seenFlash, setSeenFlash] = useState(flash?.nonce);
  if (flash && flash.nonce !== seenFlash) {
    setSeenFlash(flash.nonce);
    setOpen(true);
  }
  // What each group (by `groupKey`) had picked when a switch turned it off,
  // for this session only.
  const [kept, setKept] = useState<ReadonlyMap<string, Kept>>(new Map());
  const apply = (toggle: Toggle) => {
    if (toggle.indexes.length > 0) onSetEnabled(toggle.indexes, toggle.enabled);
    const next = new Map(kept);
    for (const [key, value] of toggle.kept) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setKept(next);
  };
  // The name being typed while renaming; `null` while not renaming.
  const [draft, setDraft] = useState<string | null>(null);
  const trimmed = draft === null ? "" : normalizeName(draft);
  const problem =
    draft === null
      ? null
      : !trimmed
        ? m.tree_rename_empty()
        : taken(trimmed)
          ? m.tree_rename_taken()
          : nameProblemText(trimmed);

  // Enter and blur commit; an invalid name on blur simply reverts.
  const commit = () => {
    if (draft !== null && !problem && trimmed !== name) onRename(trimmed);
    setDraft(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {/* A plain button: the ghost `Button` shades `aria-expanded` (made
              for popover triggers), which would mark every open tree. */}
          <button
            type="button"
            className="flex size-6 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-expanded={open}
            title={open ? m.tree_collapse({ name }) : m.tree_expand({ name })}
            aria-label={open ? m.tree_collapse({ name }) : m.tree_expand({ name })}
            onClick={() => setOpen(!open)}
          >
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
          {/* The same tint the timetable's blocks carry in the grid, so the
              grid can be read back to the tree. */}
          <span aria-hidden className="h-4 w-1 shrink-0 bg-(--tint)" style={tintStyleOf(tint)} />
          {draft !== null ? (
            <Input
              className="h-7 flex-1"
              value={draft}
              autoFocus
              aria-label={m.tree_rename()}
              aria-invalid={problem !== null || undefined}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === "Enter") commit();
                if (event.key === "Escape") setDraft(null);
              }}
            />
          ) : locked ? (
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
          ) : (
            // A click on the name renames it, in place.
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left text-sm font-medium"
              title={m.tree_rename()}
              onClick={() => setDraft(name)}
            >
              {name}
            </button>
          )}
          {/* Folding a timetable away must not hide that it has warnings. */}
          {!open && warnings.length > 0 && (
            <span
              role="img"
              className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
              title={m.tree_warning_count({ count: warnings.length })}
              aria-label={m.tree_warning_count({ count: warnings.length })}
            >
              <AlertTriangle className="size-3.5" />
              {warnings.length}
            </span>
          )}
          <CatalogIcon name={name} status={status} onUpdate={onUpdate} />
          {/* Works while locked: it changes nothing. */}
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            title={m.tree_download({ name })}
            aria-label={m.tree_download({ name })}
            onClick={() => saveTimetable(timetable)}
          >
            <Download />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={locked}
            title={m.tree_add_subject({ name })}
            aria-label={m.tree_add_subject({ name })}
            onClick={() => onEdit(null)}
          >
            <Plus />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            disabled={locked}
            title={m.tree_remove({ name })}
            aria-label={m.tree_remove({ name })}
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        </div>
        {problem && <p className="text-xs text-destructive">{problem}</p>}
      </div>

      {open &&
        node.categories.map((category) => (
          <div key={category.category ?? "none"} className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span id={`${id}-${category.category ?? "none"}`}>
                {category.category === null
                  ? m.tree_no_group()
                  : m.tree_category({ category: category.category })}
              </span>
              <div className="flex items-center gap-1">
                <CategoryToggle
                  category={category}
                  state={categoryState(timetable.subjects, category)}
                  locked={locked}
                  onToggle={() => apply(toggleCategory(timetable.subjects, category, kept))}
                />
                {/* Also for a single subject: its pen is the way to edit it. */}
                {!locked && (
                  <ClassPicker
                    timetableName={name}
                    category={category}
                    subjects={timetable.subjects}
                    onSetEnabled={onSetEnabled}
                    onEdit={onEdit}
                  />
                )}
              </div>
            </div>
            {/* The row is a ruler, not a list of buttons: group
              `category.index` owns the slice [(index-1)/n, index/n] of the full
              row width, exactly the span `isOverlapping` (primitives/group.ts)
              computes. Two groups are compatible iff their slices overlap, so
              reading the category rows against each other IS how the user
              tries out combinations — 2.1 over the left half, 3.2 over the
              middle third, and so on.

              That only holds while every row spans the same width and every
              cell keeps exactly its share of it. So, in this row and in
              `GroupCell`:
                - n equal grid columns and nothing else: no `min-width`, no
                  `width` on a cell, no `gap` between cells, no scroll
                  container, no margin on the row — any of those shift a slice
                  and make the tree lie. (A flex row with percentage bases plus
                  the `-ml-px` border collapse did exactly that: every cell
                  pulled the rest left and category 10 ended a visible 9px
                  short of the right edge.);
                - a wide category (12 is real, 20 works) stays one line and the
                  cells simply get narrower;
                - what gives way is the label: `--cell-font` below scales the
                  digits with the slice, and the cell clips them rather than
                  claiming width.
              Check category 1, 2, 3, 6 and 12 stacked at 1440px and at 360px
              after touching any of this: their edges must line up. */}
            <div
              className="grid"
              role="group"
              aria-labelledby={`${id}-${category.category ?? "none"}`}
              // Hover is read off the ruler itself, by position: it works on
              // disabled cells too (locked profile), which get no pointer
              // events of their own. Mouse only — a tap is a click.
              onPointerMove={(event) => {
                if (event.pointerType !== "mouse") return;
                const box = event.currentTarget.getBoundingClientRect();
                const n = category.groups.length;
                const slice = Math.floor(((event.clientX - box.left) / box.width) * n);
                const group = category.groups[Math.max(0, Math.min(n - 1, slice))];
                onHighlight(group.indexes.length > 0 ? group.indexes : null);
              }}
              onPointerLeave={() => onHighlight(null)}
              style={
                {
                  containerType: "inline-size",
                  // A grid, not a flex row: n equal columns divide the row width
                  // exactly, and the cells' `-ml-px` border collapse bleeds into
                  // the previous column instead of pulling every following slice
                  // left (which left a growing gap at the right end).
                  gridTemplateColumns: `repeat(${category.groups.length}, minmax(0, 1fr))`,
                  // Two digits have to fit a cell: roughly 1.1em wide, so a third
                  // of the cell width, clamped to a legible range. `cqw` is 1% of
                  // the row, which is why the row is a container.
                  "--cell-font": `clamp(0.5rem, ${(100 / category.groups.length) * 0.3}cqw, 0.75rem)`,
                } as React.CSSProperties
              }
            >
              {category.groups.map((group) => (
                <GroupCell
                  key={group.group?.index ?? "none"}
                  group={group}
                  state={stateOf(timetable.subjects, group.indexes)}
                  locked={locked}
                  flashing={flash !== null && group.indexes.includes(flash.index)}
                  onHighlight={(on) => onHighlight(on ? group.indexes : null)}
                  onToggle={() =>
                    apply(toggleGroup(timetable.subjects, group, kept.get(groupKey(group))))
                  }
                />
              ))}
            </div>
          </div>
        ))}

      {open && warnings.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {warnings.map((warning) => (
            <li key={warning.key} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{warning.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Switches all groups of a category at once, drawn as a tri-state checkbox:
// checked while every group has a pick. Only where there is more than one
// group to switch; a single one is its own cell.
function CategoryToggle({
  category,
  state,
  locked,
  onToggle,
}: {
  category: CategoryNode;
  state: ReturnType<typeof categoryState>;
  locked: boolean;
  onToggle: () => void;
}) {
  if (category.category === null || usedGroups(category).length < 2) return null;
  const label =
    state === "all"
      ? m.tree_deselect_all({ category: category.category })
      : m.tree_select_all({ category: category.category });
  const Icon = state === "all" ? SquareCheck : state === "some" ? SquareMinus : Square;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="-my-1 size-6"
      disabled={locked}
      aria-pressed={state === "some" ? "mixed" : state === "all"}
      title={label}
      aria-label={label}
      onClick={onToggle}
    >
      <Icon />
    </Button>
  );
}

// What the catalog says about a timetable installed from it. Only a waiting
// update is a button — it opens the diff; the other states are just shown.
function CatalogIcon({
  name,
  status,
  onUpdate,
}: {
  // The timetable's name: several headings each carry this button.
  name: TimetableName;
  status: CatalogStatus;
  onUpdate: () => void;
}) {
  if (status === "none") return null;
  if (status === "update") {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="size-6"
        title={m.tree_update({ name })}
        aria-label={m.tree_update({ name })}
        onClick={onUpdate}
      >
        <CloudSync />
      </Button>
    );
  }
  const label = status === "offline" ? m.tree_catalog_offline() : m.tree_catalog_current();
  const Icon = status === "offline" ? CloudOff : CloudCheck;
  return (
    <span
      role="img"
      className="flex size-6 shrink-0 items-center justify-center text-muted-foreground"
      title={label}
      aria-label={label}
    >
      <Icon className="size-4" />
    </span>
  );
}
