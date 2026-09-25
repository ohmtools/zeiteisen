import type { CSSProperties } from "react";
import { compareNames } from "@/lib/primitives/name";
import type { TimetableName } from "@/lib/primitives/timetable";

// The globalTimetable mixes every timetable in one grid, so a block has to say
// which one it belongs to. Every tint keeps the hue of
// `--primary` — the whole app stays red (user decision) — and separates the
// timetables by lightness and chroma instead: each further step is
// darker and a step less saturated.  It is never the only cue either: the group
// tree heading carries the same tint and the subject popup names the timetable.

// One step down in lightness and in chroma per step. The block text
// is `--primary-foreground` (near white), so going darker keeps the contrast
// that the lighter direction would lose.
const L_STEP = 0.055;
const C_STEP = 0.04;

// After this many steps the ramp starts over: a darker step would sink into
// the dark-mode background, and no study plan shows more timetables at once.
const STEPS = 4;

// By rank in the profile's name order — the order the group tree lists them —
// so the timetables shown together never share a tint (up to `STEPS`), the
// top heading always carries `--primary`, and the upload order does not
// matter. Adding or renaming a timetable may move the others a step.
export function tintSteps(names: readonly TimetableName[]): Map<TimetableName, number> {
  const sorted = [...names].sort(compareNames);
  return new Map(sorted.map((name, rank) => [name, rank % STEPS]));
}

// `--tint` for a subtree: blocks paint with `bg-(--tint)`, the tree heading
// with a small swatch of it.
export function tintStyleOf(step: number): CSSProperties {
  const l = (step * L_STEP).toFixed(3);
  const c = (step * C_STEP).toFixed(3);
  return {
    "--tint":
      step === 0
        ? "var(--primary)"
        : `oklch(from var(--primary) calc(l - ${l}) max(calc(c - ${c}), 0.03) h)`,
  } as CSSProperties;
}
