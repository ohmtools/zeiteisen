// ohmtools/design: shadcn/src/lib/ohmtools/steps.ts (copied by `ohmtools-design add`, do not edit)
import { useSyncExternalStore } from "react";

// The three steps of the app shell (DESIGN.md, "App shell") as media queries,
// the same as the `compact`, `wide` and `short` variants of `index.css`, for
// the places that pick a container in script: a drawer on phones, a popup
// from compact on, a page or a sidebar.
export const COMPACT_QUERY = "(width >= 40rem), (height < 600px) and (orientation: landscape)";
export const WIDE_QUERY = "(width >= 64rem) and (height >= 700px)";
// A phone turned sideways (or any short landscape window).
export const SHORT_QUERY = "(height < 600px) and (orientation: landscape)";
// Input, not layout: a compact screen may be a phone turned sideways (touch)
// or a small laptop (mouse). Tooltips and hover need `HOVER_QUERY`.
export const HOVER_QUERY = "(hover: hover)";
export const COARSE_QUERY = "(pointer: coarse)";

// Narrow: phones upright. Compact: phones turned sideways, iPads upright,
// small laptops. Wide: large iPads, iPads in landscape, desktops.
export type Step = "narrow" | "compact" | "wide";

export function currentStep(): Step {
  if (matchMedia(WIDE_QUERY).matches) return "wide";
  return matchMedia(COMPACT_QUERY).matches ? "compact" : "narrow";
}

// Calls `onChange` whenever the step may have changed.
export function watchStep(onChange: () => void): () => void {
  const queries = [matchMedia(WIDE_QUERY), matchMedia(COMPACT_QUERY)];
  for (const query of queries) query.addEventListener("change", onChange);
  return () => {
    for (const query of queries) query.removeEventListener("change", onChange);
  };
}

// The current step, re-rendering when it changes.
export function useStep(): Step {
  return useSyncExternalStore(watchStep, currentStep, () => "narrow");
}

// Whether a media query matches, re-rendering when it changes.
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}
