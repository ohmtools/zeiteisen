// What the debug info (`debugReport`) says about this page's life: when it
// started, how long its first render took, every return from the background
// and the errors it ran into. In memory only, so nothing outlives the page;
// `startLaunchLog` runs first thing in `main.tsx` and stays tiny, because it
// sits in the entry chunk.
//
// Wall-clock times are `Date.now()`: iOS may stop `performance.now()` while a
// suspended app sleeps, which would make the background stays look short.

export type Resume = {
  // When the page became visible again, and how long it was hidden.
  at: number;
  hiddenFor: number;
  // Until the first frame after it: a long one means the page was busy.
  frameAfter: number | null;
  // Restored from the back-forward cache (`pageshow`), not a visibility change.
  restored: boolean;
};

export type LoggedError = { at: number; message: string };

// The service worker's side of this launch (`public/sw-launch.js`), wall
// clock: what happened before the page's own clock started.
export type WorkerLaunch = {
  created: number | null;
  started: number;
  navigations: number[];
  answered: number;
};

const MAX_ENTRIES = 10;

export const launch = {
  visibleAtStart: true,
  worker: null as WorkerLaunch | null,
  resumes: [] as Resume[],
  errors: [] as LoggedError[],
};

export const MARK_MAIN = "zeiteisen:main";
export const MARK_COMMIT = "zeiteisen:first-commit";
export const MARK_FRAME = "zeiteisen:first-frame";
export const MARK_DEFERRED = "zeiteisen:deferred";

// A performance mark; never throws (old engines, a full timeline buffer).
export function mark(name: string): void {
  try {
    performance.mark(name);
  } catch {
    // Missing in the debug info, nothing else.
  }
}

function push<T>(list: T[], item: T): void {
  list.push(item);
  if (list.length > MAX_ENTRIES) list.shift();
}

// The frame after now, in ms, or null when none came within a second (a
// page hidden again right away gets no frame).
function untilNextFrame(done: (ms: number | null) => void): void {
  const start = performance.now();
  let settled = false;
  const settle = (ms: number | null) => {
    if (settled) return;
    settled = true;
    done(ms);
  };
  requestAnimationFrame(() => settle(Math.round(performance.now() - start)));
  setTimeout(() => settle(null), 1000);
}

// Asked right away, while the worker that served this page still runs.
function askWorker(): void {
  try {
    const controller = navigator.serviceWorker?.controller;
    if (!controller) return;
    const channel = new MessageChannel();
    channel.port1.onmessage = (event: MessageEvent<WorkerLaunch>) => {
      launch.worker = event.data;
    };
    controller.postMessage({ type: "zeiteisen:launch" }, [channel.port2]);
  } catch {
    // Missing in the debug info, nothing else.
  }
}

export function startLaunchLog(): void {
  mark(MARK_MAIN);
  launch.visibleAtStart = document.visibilityState === "visible";
  askWorker();
  let hiddenAt = document.visibilityState === "hidden" ? Date.now() : null;

  const resumed = (restored: boolean) => {
    const at = Date.now();
    const resume: Resume = {
      at,
      hiddenFor: hiddenAt === null ? 0 : at - hiddenAt,
      frameAfter: null,
      restored,
    };
    hiddenAt = null;
    push(launch.resumes, resume);
    untilNextFrame((ms) => {
      resume.frameAfter = ms;
    });
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") hiddenAt = Date.now();
    else resumed(false);
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) resumed(true);
  });
  window.addEventListener("error", (event) => {
    push(launch.errors, { at: Date.now(), message: String(event.message || event.error) });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    push(launch.errors, {
      at: Date.now(),
      message:
        "unhandled rejection: " + (reason instanceof Error ? reason.message : String(reason)),
    });
  });
}

// Called once the first render is committed (`LaunchMarks`).
export function markFirstRender(): void {
  if (performance.getEntriesByName(MARK_COMMIT).length > 0) return;
  mark(MARK_COMMIT);
  untilNextFrame(() => mark(MARK_FRAME));
}
