// The `compact` and `wide` variants of index.css as media queries, for the
// places that have to know the step in script: which container a panel, a
// menu or the details go into.
export const COMPACT_QUERY = "(width >= 40rem), (height < 600px) and (orientation: landscape)";
export const WIDE_QUERY = "(width >= 64rem) and (height >= 600px)";
// The `short` variant: a phone turned sideways.
export const SHORT_QUERY = "(height < 600px) and (orientation: landscape)";

// Narrow: one day, panels as pages. Compact: the whole week, panels as a
// sheet from the right. Wide: the week beside a sidebar.
export type Step = "narrow" | "compact" | "wide";

export function currentStep(): Step {
  if (matchMedia(WIDE_QUERY).matches) return "wide";
  return matchMedia(COMPACT_QUERY).matches ? "compact" : "narrow";
}

export function isWide(): boolean {
  return matchMedia(WIDE_QUERY).matches;
}

// Calls `onChange` whenever the step may have changed.
export function watchStep(onChange: () => void): () => void {
  const queries = [matchMedia(WIDE_QUERY), matchMedia(COMPACT_QUERY)];
  for (const query of queries) query.addEventListener("change", onChange);
  return () => {
    for (const query of queries) query.removeEventListener("change", onChange);
  };
}
