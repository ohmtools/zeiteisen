import { useEffect, useRef } from "react";
import { cn } from "cn";
import { m } from "@/i18n";
import { Button } from "@/components/ui/button";
import { groupName } from "@/lib/primitives/group";
import type { GroupNode, SelectionState } from "@/lib/primitives/tree";

type Props = {
  group: GroupNode;
  state: SelectionState;
  className?: string;
  // A locked profile keeps its stored selection: the cell still shows it, it
  // just cannot be changed.
  locked?: boolean;
  // A grid block asked to be shown here: scroll to the cell and flash it.
  flashing?: boolean;
  // Keyboard focus lights up the cell's blocks in the grid (hover is the
  // row's job).
  onHighlight?: (on: boolean) => void;
  onSetAll: (selected: boolean) => void;
};

// One slice of the category ruler (the row in `GroupTree` owns the proportion:
// it is a grid of n equal columns, and this cell is one grid item that
// stretches to its column). The cell must never ask for more width: no
// `min-width`, no `width`, no `gap`, and nothing added next to the label — a
// second button in here is what broke category 12 before, which is why single
// classes are picked in the row's `ClassPicker` instead.
//
// The label is therefore the only flexible part: the bare group index ("11",
// not "12.11", the row already names the category), scaled by `--cell-font`
// from the row and clipped by `overflow-hidden` when even that is too wide.
// The full name stays reachable through `title`/`aria-label`.
export function GroupCell({
  group,
  state,
  className,
  locked,
  flashing = false,
  onHighlight,
  onSetAll,
}: Props) {
  const name = group.group ? groupName(group.group) : m.tree_no_group();
  const variant = state === "all" ? "default" : state === "partial" ? "secondary" : "outline";
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!flashing) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
  }, [flashing]);

  return (
    <Button
      ref={ref}
      variant={variant}
      size="sm"
      // `-ml-px` collapses the border between neighbouring slices so the row
      // reads as one continuous bar. It bleeds left into the previous grid
      // column, so the cell's right edge still sits exactly on the slice
      // boundary; `px-0` keeps padding from widening a narrow slice.
      className={cn(
        "h-8 min-w-0 overflow-hidden px-0 text-(length:--cell-font) tabular-nums -ml-px first:ml-0",
        // A ring drawn inside the cell: outside it would claim no width but
        // be clipped by the neighbours and the scrolling section.
        flashing && "z-10 ring-3 ring-foreground ring-inset motion-safe:animate-pulse",
        className,
      )}
      // Nothing to select in a group no subject of this file uses.
      disabled={locked || group.indexes.length === 0}
      // Some of the group's classes picked, not all: "mixed", as a partial
      // checkbox would say.
      aria-pressed={state === "partial" ? "mixed" : state === "all"}
      aria-label={name}
      title={name}
      onClick={() => onSetAll(state !== "all")}
      // Keyboard focus only: a tap focuses the button too (iPad Safari), and
      // would dim the grid until the focus moves on.
      onFocus={(event) => {
        if (event.currentTarget.matches(":focus-visible")) onHighlight?.(true);
      }}
      onBlur={() => onHighlight?.(false)}
    >
      <span className="truncate">{group.group ? group.group.index : name}</span>
    </Button>
  );
}
