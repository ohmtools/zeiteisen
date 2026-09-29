import { describe, expect, it } from "vitest";
import { dropsCatalog, refreshScheduler } from "@/lib/refresh";

// A scheduler whose refreshes finish only when the test says so, on a clock
// the test moves.
function setup({ ignored = false } = {}) {
  const runs: { stale: () => boolean; finish: () => void }[] = [];
  const clock = { now: 0, ignored };
  const scheduler = refreshScheduler({
    run: (stale) =>
      new Promise<void>((resolve) => {
        runs.push({ stale, finish: resolve });
      }),
    skip: () => clock.ignored,
    freshFor: 60_000,
    now: () => clock.now,
  });
  return { ...scheduler, runs, clock };
}

// Lets a finished refresh's `finally` run.
const settle = () => new Promise((resolve) => setTimeout(resolve));

describe("refreshScheduler", () => {
  it("runs one refresh at a time, forced or not", async () => {
    const { start, runs } = setup();
    start();
    start();
    start({ force: true });
    expect(runs).toHaveLength(1);
    runs[0].finish();
    await settle();
    start({ force: true });
    expect(runs).toHaveLength(2);
  });

  it("skips a refresh within freshFor of the last one, unless forced", async () => {
    const { start, runs, clock } = setup();
    start();
    runs[0].finish();
    await settle();
    clock.now = 59_999;
    start();
    expect(runs).toHaveLength(1);
    start({ force: true });
    expect(runs).toHaveLength(2);
    runs[1].finish();
    await settle();
    clock.now = 59_999 + 60_000;
    start();
    expect(runs).toHaveLength(3);
  });

  it("a restart drops the running refresh and starts at once", async () => {
    const { start, runs } = setup();
    start();
    start({ restart: true });
    expect(runs).toHaveLength(2);
    expect(runs[0].stale()).toBe(true);
    expect(runs[1].stale()).toBe(false);
    // The dropped one finishing late does not free the slot of the new one.
    runs[0].finish();
    await settle();
    start({ force: true });
    expect(runs).toHaveLength(2);
  });

  it("reads nothing while ignored, but a restart still drops the running refresh", () => {
    const { start, runs, clock } = setup();
    start();
    clock.ignored = true;
    start({ restart: true });
    expect(runs).toHaveLength(1);
    expect(runs[0].stale()).toBe(true);
    start({ force: true });
    expect(runs).toHaveLength(1);
  });

  it("cancel drops the running refresh and starts none", async () => {
    const { start, cancel, runs } = setup();
    start();
    cancel();
    expect(runs).toHaveLength(1);
    expect(runs[0].stale()).toBe(true);
    // The slot is free again: the restart after the change runs at once.
    start({ restart: true });
    expect(runs).toHaveLength(2);
    runs[0].finish();
    await settle();
    expect(runs[1].stale()).toBe(false);
  });

  it("stop makes the running refresh stale and starts nothing more", () => {
    const { start, stop, runs } = setup();
    start();
    stop();
    expect(runs[0].stale()).toBe(true);
    start({ restart: true });
    expect(runs).toHaveLength(1);
  });
});

describe("dropsCatalog", () => {
  const at = (mode: "auto" | "freeze" | "ignore", url: string | null = null) => ({ mode, url });

  it("drops the old catalog for another URL or on switching to ignore", () => {
    expect(dropsCatalog(at("auto"), at("auto", "https://example.org/c/"))).toBe(true);
    expect(dropsCatalog(at("freeze"), at("ignore"))).toBe(true);
    expect(dropsCatalog(at("auto"), at("ignore"))).toBe(true);
  });

  it("keeps it for the same setting, freezing, and leaving ignore", () => {
    expect(dropsCatalog(at("auto"), at("auto"))).toBe(false);
    expect(dropsCatalog(at("auto"), at("freeze"))).toBe(false);
    expect(dropsCatalog(at("ignore"), at("auto"))).toBe(false);
    expect(dropsCatalog(at("ignore"), at("ignore"))).toBe(false);
  });
});
