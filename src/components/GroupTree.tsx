import { useId, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  Link,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Square,
  SquareCheck,
  SquareMinus,
  Unlink,
  WifiOff,
} from "lucide-react";
import { cn } from "cn";
import { getLocale, m } from "@/i18n";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { GroupRuler } from "@/components/GroupCell";
import { LockButton } from "@/components/AppHeader";
import { PanelHeader } from "@/components/PanelHeader";
import { TimetableDialog } from "@/components/TimetableDialog";
import type { EditRequest } from "@/components/SubjectEditor";
import type { Catalog } from "@/lib/primitives/catalog";
import { groupName, type GroupCategory } from "@/lib/primitives/group";
import type { Subjects } from "@/lib/primitives/subject";
import {
  timetableHasUpdate,
  type Timetable,
  type TimetableName,
  type TimetableSubjectExtra,
} from "@/lib/primitives/timetable";
import {
  buildTree,
  stateOf,
  type CategoryNode,
  type GroupNode,
  type TimetableNode,
} from "@/lib/primitives/tree";
import { Warn, warningsFor } from "@/lib/primitives/warnings";
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
import type { Step } from "@/lib/media";
import { dateLabel, dayName, slotShort } from "@/lib/subjects";
import { warningLines } from "@/lib/warnings";

// The category view open in the panel: a timetable's category (`null`: the
// subjects without a group).
export type CategoryRef = { timetableName: TimetableName; category: GroupCategory | null };

type Props = {
  step: Step;
  timetables: Timetable[];
  locked: boolean;
  // What the headings show about the catalog: offline nothing can be checked.
  catalog: Catalog;
  online: boolean;
  catalogIgnored: boolean;
  category: CategoryRef | null;
  onCategory: (category: CategoryRef | null) => void;
  onSetEnabled: (name: TimetableName, indexes: number[], enabled: boolean) => void;
  // Opens the update dialog for a timetable the catalog has a new version of.
  onUpdate: (name: TimetableName) => void;
  onRename: (from: TimetableName, to: string) => void;
  onRemove: (name: TimetableName) => void;
  // Opens the subject editor (App asks first for a catalog timetable).
  onEdit: (request: EditRequest) => void;
  // Opens the timetable picker for the active profile.
  onAddTimetables: () => void;
  onToggleLock: () => void;
  // The group cell under the mouse or focus, whose blocks the grid keeps lit.
  onHighlight?: (highlight: Highlight | null) => void;
  onClose: () => void;
  // A grid block's cell to show: the overview, the cell scrolled into view
  // and flashing. `nonce` tells two jumps to the same cell apart.
  flash?: (SubjectRef & { nonce: number }) | null;
};

export type Flash = NonNullable<Props["flash"]>;

function saveTimetable(timetable: Timetable) {
  downloadTimetable(timetable);
  toast.success(m.toast_timetable_saved());
}

// What a timetable's status line says about the catalog (user decision: one
// line under its name, always): its own timetable gets no updates; one from
// the catalog is current, outdated (an update waits, the red dot), the
// catalog unreachable (offline or broken: nothing changes) or ignored. A
// refused update counts as current — the user settled it.
type CatalogStatus = "own" | "current" | "update" | "unreachable" | "ignored";

function catalogStatus(
  timetable: Timetable,
  catalog: Catalog,
  online: boolean,
  ignored: boolean,
): CatalogStatus {
  if (timetable.origin.kind !== "catalog") return "own";
  if (ignored) return "ignored";
  if (!online || !catalog.index) return "unreachable";
  return timetableHasUpdate(timetable, catalog) ? "update" : "current";
}

const STATUS_TEXT: Record<CatalogStatus, () => string> = {
  own: m.tree_status_own,
  current: m.tree_status_current,
  update: m.tree_status_update,
  unreachable: m.tree_status_unreachable,
  ignored: m.tree_status_ignored,
};

const STATUS_ICON = {
  own: Unlink,
  current: Link,
  update: Link,
  unreachable: WifiOff,
  ignored: Link,
};

// The group selection of the active profile: one section per timetable, or
// one category of one timetable (`CategoryView`). A panel: sidebar, sheet or
// page. Lives in the deferred chunk.
export function GroupTree({
  step,
  timetables,
  locked,
  catalog,
  online,
  catalogIgnored,
  category,
  onCategory,
  onSetEnabled,
  onUpdate,
  onRename,
  onRemove,
  onEdit,
  onAddTimetables,
  onToggleLock,
  onHighlight,
  onClose,
  flash = null,
}: Props) {
  const tree = buildTree(timetables);
  const narrow = step === "narrow";
  // What each group (by timetable and `groupKey`) had picked when a switch
  // turned it off, for this session only: switching it on brings it back
  // (user decision).
  const [kept, setKept] = useState<ReadonlyMap<string, Kept>>(new Map());
  const keptOf = (name: TimetableName) =>
    new Map(
      [...kept]
        .filter(([key]) => key.startsWith(`${name}\n`))
        .map(([key, value]) => [key.slice(name.length + 1), value]),
    );
  const apply = (name: TimetableName, toggle: Toggle) => {
    if (toggle.indexes.length > 0) onSetEnabled(name, toggle.indexes, toggle.enabled);
    const next = new Map(kept);
    for (const [key, value] of toggle.kept) {
      if (value) next.set(`${name}\n${key}`, value);
      else next.delete(`${name}\n${key}`);
    }
    setKept(next);
  };
  const highlight = (name: TimetableName) => (indexes: readonly number[] | null) =>
    onHighlight?.(indexes ? { timetableName: name, indexes } : null);
  // The timetable whose name and removal the dialog is about.
  const [managing, setManaging] = useState<TimetableName | null>(null);

  const openNode = category && tree.find((node) => node.timetable.name === category.timetableName);
  const openCategory = openNode?.categories.find((one) => one.category === category?.category);

  const toggleGroupOf = (node: TimetableNode) => (group: GroupNode) =>
    apply(
      node.timetable.name,
      toggleGroup(node.timetable.subjects, group, keptOf(node.timetable.name).get(groupKey(group))),
    );
  const lock = narrow && <LockButton locked={locked} onToggle={onToggleLock} />;

  if (openNode && openCategory) {
    return (
      <CategoryView
        node={openNode}
        category={openCategory}
        locked={locked}
        narrow={narrow}
        lock={lock}
        onBack={() => onCategory(null)}
        onClose={onClose}
        onToggle={toggleGroupOf(openNode)}
        onSetEnabled={(indexes, enabled) => onSetEnabled(openNode.timetable.name, indexes, enabled)}
        onEdit={(index) => onEdit({ name: openNode.timetable.name, index })}
        onHighlight={highlight(openNode.timetable.name)}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelHeader
        title={m.panel_groups()}
        actions={
          <>
            <Button
              variant="ghost"
              size="icon"
              disabled={locked}
              aria-label={m.profile_add_timetables()}
              title={m.profile_add_timetables()}
              onClick={onAddTimetables}
            >
              <Plus />
            </Button>
            {lock}
          </>
        }
        onBack={narrow ? onClose : undefined}
        onClose={narrow ? undefined : onClose}
      />
      <div className="flex min-h-0 flex-1 flex-col divide-y overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)] compact:px-6">
        {locked && (
          <div className="flex flex-col gap-3 pt-2 pb-6">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 shrink-0" />
              {m.tree_locked_text()}
            </p>
            <Button variant="secondary" className="self-start" onClick={onToggleLock}>
              {m.groups_unlock()}
            </Button>
          </div>
        )}
        {tree.length === 0 ? (
          <div className="flex flex-col gap-4 py-6">
            <p className="text-sm text-muted-foreground">{m.tree_empty()}</p>
            <Button className="self-start" disabled={locked} onClick={onAddTimetables}>
              <Plus data-icon="inline-start" />
              {m.profile_add_timetables()}
            </Button>
          </div>
        ) : (
          tree.map((node) => (
            <TimetableSection
              key={node.timetable.name}
              node={node}
              locked={locked}
              status={catalogStatus(node.timetable, catalog, online, catalogIgnored)}
              kept={keptOf(node.timetable.name)}
              onApply={(toggle) => apply(node.timetable.name, toggle)}
              onToggle={toggleGroupOf(node)}
              onUpdate={() => onUpdate(node.timetable.name)}
              onManage={() => setManaging(node.timetable.name)}
              onAdd={() => onEdit({ name: node.timetable.name, index: null })}
              onOpenCategory={(one) =>
                onCategory({ timetableName: node.timetable.name, category: one })
              }
              flash={flash?.timetableName === node.timetable.name ? flash : null}
              onHighlight={highlight(node.timetable.name)}
            />
          ))
        )}
      </div>

      <TimetableDialog
        name={managing}
        taken={(name) => timetables.some((one) => one.name !== managing && one.name === name)}
        locked={locked}
        onClose={() => setManaging(null)}
        onRename={(to) => managing && onRename(managing, to)}
        onRemove={() => managing && onRemove(managing)}
      />
    </div>
  );
}

type SectionProps = {
  node: TimetableNode;
  locked: boolean;
  status: CatalogStatus;
  kept: ReadonlyMap<string, Kept>;
  onApply: (toggle: Toggle) => void;
  onToggle: (group: GroupNode) => void;
  onUpdate: () => void;
  // Name and removal (`TimetableDialog`).
  onManage: () => void;
  // "Add subject": the subject editor, asked first for a catalog timetable.
  onAdd: () => void;
  onOpenCategory: (category: GroupCategory | null) => void;
  flash: Flash | null;
  onHighlight: (indexes: readonly number[] | null) => void;
};

// One timetable: its name with update, rename and download, its catalog
// status, "classes without a group" first, then a ruler per category
// (ascending), the warnings (one line per kind, user decision) and "add
// subject".
function TimetableSection({
  node,
  locked,
  status,
  kept,
  onApply,
  onToggle,
  onUpdate,
  onManage,
  onAdd,
  onOpenCategory,
  flash,
  onHighlight,
}: SectionProps) {
  const { timetable } = node;
  const name = timetable.name;
  const warnings = warningsFor(timetable);
  // "No group picked yet" sits right under its category; every other kind is
  // one line at the end.
  const lines = warningLines(warnings.filter((w) => w.code !== Warn.EmptyCategory));
  const empty = new Set(
    warnings.flatMap((w) => (w.code === Warn.EmptyCategory ? [w.category] : [])),
  );
  const StatusIcon = STATUS_ICON[status];
  // Labels the category rulers for screen readers.
  const id = useId();

  return (
    <section className="flex flex-col gap-4 py-6 first:pt-2">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="truncate text-sm font-semibold">{name}</h3>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <StatusIcon className="size-3 shrink-0" />
            <span className="truncate">{STATUS_TEXT[status]()}</span>
          </span>
        </div>
        <div className="-mr-2 flex shrink-0">
          {status === "update" && !locked && (
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              title={m.tree_update({ name })}
              aria-label={m.tree_update({ name })}
              onClick={onUpdate}
            >
              <RefreshCw />
              <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-full bg-red" />
            </Button>
          )}
          {!locked && (
            <Button
              variant="ghost"
              size="icon"
              title={m.tree_manage({ name })}
              aria-label={m.tree_manage({ name })}
              onClick={onManage}
            >
              <Pencil />
            </Button>
          )}
          {/* Works while locked: it changes nothing. */}
          <Button
            variant="ghost"
            size="icon"
            title={m.tree_download({ name })}
            aria-label={m.tree_download({ name })}
            onClick={() => saveTimetable(timetable)}
          >
            <Download />
          </Button>
        </div>
      </div>

      {node.categories.map((category) => {
        const labelId = `${id}-${category.category ?? "none"}`;
        return (
          <div key={category.category ?? "none"} className="flex flex-col gap-2">
            <div className="-mr-2 flex items-center gap-1">
              <span id={labelId} className="min-w-0 flex-1 truncate text-sm font-medium">
                {category.category === null
                  ? m.tree_no_group_title()
                  : m.tree_category({ category: category.category })}
              </span>
              <CategoryToggle
                category={category}
                state={categoryState(timetable.subjects, category)}
                locked={locked}
                onToggle={() => onApply(toggleCategory(timetable.subjects, category, kept))}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={
                  category.category === null
                    ? m.tree_pick_ungrouped()
                    : m.tree_pick({ category: category.category })
                }
                title={
                  category.category === null
                    ? m.tree_pick_ungrouped()
                    : m.tree_pick({ category: category.category })
                }
                onClick={() => onOpenCategory(category.category)}
              >
                <ChevronRight />
              </Button>
            </div>
            <GroupRuler
              category={category}
              subjects={timetable.subjects}
              labelledBy={labelId}
              locked={locked}
              flashIndex={flash?.index ?? null}
              onHighlight={onHighlight}
              onToggle={onToggle}
            />
            <PartialHint category={category} subjects={timetable.subjects} />
            {empty.has(category.category) && <WarningLine>{m.tree_category_empty()}</WarningLine>}
          </div>
        );
      })}

      {lines.length > 0 && (
        <ul className="flex flex-col gap-2">
          {lines.map((line) => (
            <li key={line.key}>
              <WarningLine>{line.text}</WarningLine>
            </li>
          ))}
        </ul>
      )}

      {!locked && (
        <Button
          variant="ghost"
          className="-ml-2.5 self-start px-2.5 text-muted-foreground"
          onClick={onAdd}
        >
          <Plus data-icon="inline-start" />
          {m.tree_add_subject_short()}
        </Button>
      )}
    </section>
  );
}

// "2.1 and 2.2 partly picked": the groups whose cell is dashed.
function PartialHint({
  category,
  subjects,
}: {
  category: CategoryNode;
  subjects: Subjects<TimetableSubjectExtra>;
}) {
  const partial = category.groups
    .filter((group) => group.group && stateOf(subjects, group.indexes) === "partial")
    .map((group) => groupName(group.group!));
  if (partial.length === 0) return null;
  const list = new Intl.ListFormat(getLocale(), { type: "conjunction" }).format(partial);
  return <p className="text-xs text-muted-foreground">{m.tree_partial({ groups: list })}</p>;
}

function WarningLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-xs text-warning">
      <AlertTriangle className="size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// Switches all groups of a category at once, drawn as a tri-state checkbox:
// checked while every group has a pick. Only where there are two or more used
// groups to switch; a single one is its own cell.
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
      size="icon-sm"
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

// One subject of a category (same name and kinds) and its classes, by group.
type SubjectRow = {
  key: string;
  name: string;
  kinds: string;
  groups: { group: GroupNode; indexes: number[] }[];
};

function subjectRows(
  category: CategoryNode,
  subjects: Subjects<TimetableSubjectExtra>,
): SubjectRow[] {
  const rows = new Map<string, SubjectRow>();
  for (const group of category.groups) {
    for (const index of group.indexes) {
      const subject = subjects.getSubject(index);
      const kinds = subject.kind.join(", ");
      const key = `${subject.name}\n${kinds}`;
      const row = rows.get(key) ?? { key, name: subject.name, kinds, groups: [] };
      const at = row.groups.find((one) => one.group === group);
      if (at) at.indexes.push(index);
      else row.groups.push({ group, indexes: [index] });
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort(
    (a, b) => a.name.localeCompare(b.name, getLocale()) || a.kinds.localeCompare(b.kinds),
  );
}

// One category, closer up: the same ruler, a search, and every subject as a
// fold: its used groups as badges (amber when it breaks a rule), open its
// classes per group with a checkbox and a pen each, "only this one" per
// group, the other groups on request. On wide screens the grid dims the
// other categories meanwhile (App).
function CategoryView({
  node,
  category,
  locked,
  narrow,
  lock,
  onBack,
  onClose,
  onToggle,
  onSetEnabled,
  onEdit,
  onHighlight,
}: {
  node: TimetableNode;
  category: CategoryNode;
  locked: boolean;
  narrow: boolean;
  lock: React.ReactNode;
  onBack: () => void;
  onClose: () => void;
  onToggle: (group: GroupNode) => void;
  onSetEnabled: (indexes: number[], enabled: boolean) => void;
  onEdit: (index: number) => void;
  onHighlight: (indexes: readonly number[] | null) => void;
}) {
  const { timetable } = node;
  const { subjects } = timetable;
  const id = useId();
  const [query, setQuery] = useState("");
  const rows = subjectRows(category, subjects).filter((row) =>
    `${row.name} ${row.kinds}`
      .toLocaleLowerCase(getLocale())
      .includes(query.trim().toLocaleLowerCase(getLocale())),
  );
  const grouped = category.category !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelHeader
        title={
          grouped ? m.tree_category({ category: category.category! }) : m.tree_no_group_title()
        }
        subtitle={timetable.name}
        actions={lock}
        onBack={onBack}
        onClose={narrow ? undefined : onClose}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] compact:px-6">
        <div className="flex flex-col gap-2">
          <span id={id} className="text-sm font-medium">
            {m.tree_groups()}
          </span>
          <GroupRuler
            category={category}
            subjects={subjects}
            labelledBy={id}
            locked={locked}
            flashIndex={null}
            onHighlight={onHighlight}
            onToggle={onToggle}
          />
          <PartialHint category={category} subjects={subjects} />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            className="pl-9"
            value={query}
            placeholder={m.tree_search({ example: rows[0]?.name ?? "SDS" })}
            aria-label={m.tree_search_label()}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="-mx-2 flex flex-col">
          {rows.map((row) => (
            <SubjectFold
              key={row.key}
              row={row}
              subjects={subjects}
              grouped={grouped}
              locked={locked}
              onSetEnabled={onSetEnabled}
              onEdit={onEdit}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SubjectFold({
  row,
  subjects,
  grouped,
  locked,
  onSetEnabled,
  onEdit,
}: {
  row: SubjectRow;
  subjects: Subjects<TimetableSubjectExtra>;
  grouped: boolean;
  locked: boolean;
  onSetEnabled: (indexes: number[], enabled: boolean) => void;
  onEdit: (index: number) => void;
}) {
  const [others, setOthers] = useState(false);
  const enabled = (index: number) => subjects.getExtra(index).enabled;
  const used = row.groups.filter((one) => one.indexes.some(enabled));
  const rest = row.groups.filter((one) => !one.indexes.some(enabled));
  // One group per subject, at least one class (the domain's rules): broken,
  // its badges turn amber and the fold says why.
  const problem = !grouped
    ? null
    : used.length > 1
      ? m.tree_subject_multi()
      : used.length === 0
        ? m.tree_subject_none()
        : null;
  // "Only this one": the subject's classes in the other groups go off; this
  // group keeps its pick, or picks all when it had none.
  const only = (group: { indexes: number[] }) => {
    const off = row.groups.filter((one) => one !== group).flatMap((one) => one.indexes);
    if (off.length > 0) onSetEnabled(off, false);
    if (!group.indexes.some(enabled)) onSetEnabled(group.indexes, true);
  };
  const shown = others ? [...used, ...rest] : used.length > 0 ? used : rest;
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open:rotate-90" />
        <span className="font-semibold">{row.name}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.kinds}</span>
        {grouped &&
          used.map(({ group }) => (
            <span
              key={groupKey(group)}
              className={cn(
                "rounded-sm px-1.5 font-mono text-xs leading-5",
                problem ? "border border-warning text-warning" : "bg-secondary",
              )}
            >
              {groupKey(group)}
            </span>
          ))}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mb-2 ml-4 flex flex-col gap-1 border-l pl-4">
          {problem && <WarningLine>{problem}</WarningLine>}
          {shown.map((one, i) => (
            <div
              key={groupKey(one.group)}
              className={cn(
                "flex flex-col",
                others && i === used.length && i > 0 && "mt-2 border-t pt-2",
              )}
            >
              {grouped && (
                <div className="flex h-9 items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {m.subject_group({ group: groupKey(one.group) })}
                  </span>
                  {!locked && row.groups.length > 1 && (
                    <Button variant="secondary" size="sm" onClick={() => only(one)}>
                      {m.tree_only_this()}
                    </Button>
                  )}
                </div>
              )}
              {one.indexes.map((index) => {
                const subject = subjects.getSubject(index);
                return (
                  <div key={index} className="flex h-9 items-center gap-3">
                    <label className="flex min-w-0 flex-1 items-center gap-3">
                      <Checkbox
                        checked={enabled(index)}
                        disabled={locked}
                        onCheckedChange={(checked) => onSetEnabled([index], checked === true)}
                      />
                      <span
                        className={cn(
                          "truncate font-mono text-xs",
                          !enabled(index) && "text-muted-foreground",
                        )}
                      >
                        {classLine(subject)}
                      </span>
                    </label>
                    {!locked && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="-mr-2"
                        title={m.tree_edit_subject({
                          subject: `${row.name} ${classLine(subject)}`,
                        })}
                        aria-label={m.tree_edit_subject({
                          subject: `${row.name} ${classLine(subject)}`,
                        })}
                        onClick={() => onEdit(index)}
                      >
                        <Pencil />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {grouped && used.length > 0 && rest.length > 0 && (
            <Button
              variant="ghost"
              className="-ml-2.5 self-start px-2.5 text-muted-foreground"
              onClick={() => setOthers(!others)}
            >
              {others ? (
                <ChevronUp data-icon="inline-start" />
              ) : (
                <ChevronDown data-icon="inline-start" />
              )}
              {others ? m.tree_others_hide() : m.tree_others_show({ count: rest.length })}
            </Button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// "Fr 09:45 · WE.012": one class of a subject, as the category view lists it.
function classLine(subject: ReturnType<Subjects<TimetableSubjectExtra>["getSubject"]>): string {
  const { repeat } = subject;
  if (repeat.type === "I") {
    const [first] = repeat.dates;
    const when =
      repeat.dates.length === 1
        ? dateLabel(first.date)
        : m.slot_dates({ count: repeat.dates.length });
    return [when, first?.location].filter(Boolean).join(" · ");
  }
  return [`${dayName(repeat.day)} ${slotShort(repeat)}`, repeat.location]
    .filter(Boolean)
    .join(" · ");
}
