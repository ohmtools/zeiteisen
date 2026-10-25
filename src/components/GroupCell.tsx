import { useEffect, useRef } from "react";
import { cn } from "cn";
import { m } from "@/i18n";
import { groupName } from "@/lib/primitives/group";
import {
  stateOf,
  type CategoryNode,
  type GroupNode,
  type SelectionState,
} from "@/lib/primitives/tree";
import type { Subjects } from "@/lib/primitives/subject";
import type { TimetableSubjectExtra } from "@/lib/primitives/timetable";

type CellProps = {
  group: GroupNode;
  state: SelectionState;
  // A locked profile keeps its stored selection: the cell still shows it, it
  // just cannot be changed.
  locked?: boolean;
  // A grid block asked to be shown here: scroll to the cell and flash it.
  flashing?: boolean;
  // Keyboard focus lights up the cell's blocks in the grid (hover is the
  // row's job).
  onHighlight?: (on: boolean) => void;
  // Switches the group off, or back on with the classes it had picked.
  onToggle: () => void;
};

// One slice of the category ruler (the row owns the proportion: it is a grid
// of n equal columns, and this cell is one grid item that stretches to its
// column). The cell must never ask for more width: no `min-width`, no
// `width`, nothing added next to the label. On is filled like a picked tab,
// partly on is dashed (user decision), off is plain.
//
// The label is the only flexible part: the bare group index ("11", not
// "12.11", the row already names the category), scaled by `--cell-font` from
// the row and clipped when even that is too wide. The full name stays
// reachable through `title`/`aria-label`.
export function GroupCell({
  group,
  state,
  locked,
  flashing = false,
  onHighlight,
  onToggle,
}: CellProps) {
  const name = group.group ? groupName(group.group) : m.tree_no_group();
  const ref = useRef<HTMLButtonElement>(null);
  // Smooth on the overview already shown; a jump when the panel or the
  // overview has just opened (the cell mounts flashing).
  const shown = useRef(false);
  useEffect(() => {
    const fresh = !shown.current;
    shown.current = true;
    if (!flashing) return;
    const still = fresh || matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
  }, [flashing]);

  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "flex h-[30px] min-w-0 items-center justify-center overflow-hidden rounded-md border border-transparent font-mono text-(length:--cell-font) transition-[background-color,border-color,color,box-shadow,scale] duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-ring not-disabled:active:scale-95 disabled:cursor-not-allowed",
        state === "all" &&
          "bg-background font-semibold text-foreground shadow-sm dark:border-input dark:bg-input/30",
        state === "partial" && "border-dashed border-muted-foreground/50 text-foreground",
        state === "none" && "text-muted-foreground hover:text-foreground",
        group.indexes.length === 0 && "opacity-40",
        // A ring drawn inside the cell: outside it would be clipped by the
        // neighbours and the scrolling panel.
        flashing && "z-10 ring-2 ring-foreground ring-inset motion-safe:animate-pulse",
      )}
      // Nothing to select in a group no subject of this file uses.
      disabled={locked || group.indexes.length === 0}
      // Some of the group's classes picked, not all: "mixed", as a partial
      // checkbox would say.
      aria-pressed={state === "partial" ? "mixed" : state === "all"}
      aria-label={name}
      title={name}
      onClick={onToggle}
      // Keyboard focus only: a tap focuses the button too (iPad Safari), and
      // would dim the grid until the focus moves on.
      onFocus={(event) => {
        if (event.currentTarget.matches(":focus-visible")) onHighlight?.(true);
      }}
      onBlur={() => onHighlight?.(false)}
    >
      <span className={cn("truncate px-0.5", !group.group && "font-sans text-sm")}>
        {group.group ? group.group.index : m.tree_all_classes()}
      </span>
    </button>
  );
}

// A category's groups as a ruler, never a wrapped list: group `n.i` owns the
// slice [(i-1)/n, i/n] of the full width, exactly the span `isOverlapping`
// (primitives/group.ts) computes. Two groups are compatible iff their slices
// overlap, so reading the category rows against each other IS how the user
// tries out combinations.
//
// That only holds while every row spans the same width and every cell keeps
// exactly its share of it: n equal grid columns and nothing else, no gap, no
// scroll container, no margin on the row. A wide category (12 is real, 20
// works) stays one line and the cells get narrower; what gives way is the
// label (`--cell-font` scales the digits with the slice). Check categories 1,
// 2, 3, 6 and 12 stacked at 1440px and at 360px after touching any of this:
// their edges must line up.
export function GroupRuler({
  category,
  subjects,
  labelledBy,
  locked,
  flashIndex,
  onHighlight,
  onToggle,
}: {
  category: CategoryNode;
  subjects: Subjects<TimetableSubjectExtra>;
  labelledBy: string;
  locked: boolean;
  // A jump to the subject at this index: its cell flashes.
  flashIndex: number | null;
  // The subjects of the cell under the mouse or focus; `null` = none.
  onHighlight: (indexes: readonly number[] | null) => void;
  onToggle: (group: GroupNode) => void;
}) {
  const n = category.groups.length;
  return (
    <div
      className="grid rounded-lg bg-muted p-[3px]"
      role="group"
      aria-labelledby={labelledBy}
      // Hover is read off the ruler itself, by position: it works on disabled
      // cells too (locked profile), which get no pointer events of their own.
      // Mouse only — a tap is a click.
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse") return;
        const box = event.currentTarget.getBoundingClientRect();
        const slice = Math.floor(((event.clientX - box.left) / box.width) * n);
        const group = category.groups[Math.max(0, Math.min(n - 1, slice))];
        onHighlight(group.indexes.length > 0 ? group.indexes : null);
      }}
      onPointerLeave={() => onHighlight(null)}
      style={
        {
          containerType: "inline-size",
          gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
          // Two digits have to fit a cell: roughly 1.2em wide, so a third of
          // the cell width, clamped to a legible range. `cqw` is 1% of the
          // row, which is why the row is a container.
          "--cell-font": `clamp(0.5625rem, ${(100 / n) * 0.3}cqw, 0.875rem)`,
        } as React.CSSProperties
      }
    >
      {category.groups.map((group) => (
        <GroupCell
          key={group.group?.index ?? "none"}
          group={group}
          state={stateOf(subjects, group.indexes)}
          locked={locked}
          flashing={flashIndex !== null && group.indexes.includes(flashIndex)}
          onHighlight={(on) => onHighlight(on ? group.indexes : null)}
          onToggle={() => onToggle(group)}
        />
      ))}
    </div>
  );
}
