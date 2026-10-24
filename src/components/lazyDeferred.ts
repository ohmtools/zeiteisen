import { lazy, type ComponentType, type LazyExoticComponent } from "react";

type Deferred = typeof import("@/components/deferred");

// The deferred chunk once it has arrived (`components/deferred`).
let arrived: Deferred | undefined;

const load = () =>
  import("@/components/deferred").then((module) => {
    arrived = module;
    return module;
  });

// `lazy()` for one export of the deferred chunk. Plain `lazy()` suspends on
// a component's first render even when the chunk came long ago (it asks for
// the module only then, and a promise answers a tick later), and React holds
// the content back ~300 ms after a fallback: every panel, sheet or drawer
// opened for the first time hung that long. Once the chunk is here, this one
// answers at once (a thenable that calls back synchronously, which React's
// `lazy` reads before suspending), so the first open renders right away.
export function lazyDeferred<T extends ComponentType<any>>(
  pick: (module: Deferred) => T,
): LazyExoticComponent<T> {
  return lazy(() => {
    if (arrived) {
      const loaded = { default: pick(arrived) };
      return { then: (resolve: (value: typeof loaded) => void) => resolve(loaded) } as Promise<
        typeof loaded
      >;
    }
    return load().then((module) => ({ default: pick(module) }));
  });
}
