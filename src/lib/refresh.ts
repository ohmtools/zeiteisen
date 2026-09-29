import type { CatalogMode } from "@/lib/primitives/catalog";

// When `useCatalog` reads the catalog again. One refresh at a time: a second
// one asked for meanwhile would only download the same index again. Not again
// within `freshFor` of the last start, unless forced (the dialogs that offer
// catalog timetables, coming back online). A restart (mode or URL changed)
// drops the running one instead and starts at once: its result belongs to the
// old setting, and `stale()` tells it so. `skip` (the catalog is ignored)
// starts nothing, but a restart still drops the running refresh, whose result
// would bring back the cache and the dates just dropped. `cancel` drops the
// running one without starting another: the setting is about to change, and
// the restart follows once it has.

export type RefreshStart = (options?: { force?: boolean; restart?: boolean }) => void;

export function refreshScheduler({
  run,
  skip,
  freshFor,
  now = Date.now,
}: {
  // One refresh; `stale()` turns true once its result must not be used.
  run: (stale: () => boolean) => Promise<void>;
  skip: () => boolean;
  freshFor: number;
  now?: () => number;
}): { start: RefreshStart; cancel: () => void; stop: () => void } {
  let stopped = false;
  let running = false;
  let generation = 0;
  let last = -Infinity;

  const cancel = () => {
    generation += 1;
    running = false;
  };

  const start: RefreshStart = ({ force = false, restart = false } = {}) => {
    if (stopped) return;
    if (restart) cancel();
    if (skip() || running) return;
    if (!force && !restart && now() - last < freshFor) return;
    running = true;
    last = now();
    const mine = generation;
    void run(() => stopped || mine !== generation).finally(() => {
      if (mine === generation) running = false;
    });
  };

  return {
    start,
    cancel,
    stop: () => {
      stopped = true;
    },
  };
}

export type CatalogSetting = { mode: CatalogMode; url: string | null };

// Whether a change of mode or URL drops what the device holds of the old
// catalog, its cached files and the dates it installed: another URL, or
// switching to `ignore`. `freeze` is the mode that keeps them.
export function dropsCatalog(before: CatalogSetting, after: CatalogSetting): boolean {
  return before.url !== after.url || (after.mode === "ignore" && before.mode !== "ignore");
}
