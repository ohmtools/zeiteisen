import { getLocale } from "@/i18n";
import {
  launch,
  MARK_COMMIT,
  MARK_DEFERRED,
  MARK_FRAME,
  MARK_MAIN,
  type Resume,
} from "@/lib/launch";
import {
  loadActive,
  loadCatalogCache,
  loadCatalogMode,
  loadCatalogUrl,
  loadProfiles,
} from "@/lib/primitives/storage";

// The Settings page's (and Data menu's) "Debug info": a plain-text report to
// copy into a bug report. Counts and sizes only: no profile, timetable or
// subject names, no notes. Built on demand, in the deferred chunk.
//
// Launch timings are ms since the navigation started. What happens before
// that (the system starting the browser, iOS waking a suspended app) no page
// can see: a launch that felt slow while these numbers stay small was slow
// outside the app. The service worker's own times (negative: before the
// navigation start) tell whether it was the worker starting up.

const ms = (value: number | undefined): string =>
  value === undefined || value <= 0 ? "-" : `${Math.round(value)} ms`;

// Characters of localStorage, bytes elsewhere: close enough for sizes.
function size(amount: number): string {
  if (amount < 1024) return `${amount} B`;
  if (amount < 1024 * 1024) return `${(amount / 1024).toFixed(1)} KB`;
  if (amount < 1024 ** 3) return `${(amount / 1024 ** 2).toFixed(1)} MB`;
  return `${(amount / 1024 ** 3).toFixed(1)} GB`;
}

function time(at: number): string {
  return new Date(at).toISOString();
}

// "3h 12m", "45s": how long ago, or how long something lasted.
function span(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

// Wall clock against the navigation start: negative is before it.
function offset(at: number): string {
  const diff = Math.round(at - performance.timeOrigin);
  if (Math.abs(diff) < 60_000) return `${diff} ms`;
  return `${span(Math.abs(diff))} ${diff < 0 ? "before" : "after"}`;
}

// The service worker's view of this launch: a worker started (or a request
// seen) long before the navigation start shows time the page's own clock
// leaves out.
function workerLaunch(): string[] {
  if (!navigator.serviceWorker?.controller) return [];
  const worker = launch.worker;
  if (!worker) return ["service worker launch: no answer"];
  const navigation = worker.navigations.at(-1);
  return [
    `service worker created: ${worker.created === null ? "-" : offset(worker.created)}`,
    `service worker script ran: ${offset(worker.started)}`,
    `service worker saw the page request: ${navigation === undefined ? "-" : offset(navigation)}`,
  ];
}

function markAt(name: string): number | undefined {
  return performance.getEntriesByName(name)[0]?.startTime;
}

// Never throws: a part that fails says so and the rest still shows.
async function section(title: string, lines: () => Promise<string[]> | string[]) {
  let body: string[];
  try {
    body = await lines();
  } catch (error) {
    body = [`failed: ${error instanceof Error ? error.message : String(error)}`];
  }
  return [`## ${title}`, ...body.map((line) => "  " + line)].join("\n");
}

function environment(): string[] {
  const nav = navigator as Navigator & {
    standalone?: boolean;
    deviceMemory?: number;
    connection?: { effectiveType?: string; saveData?: boolean };
  };
  const media = (query: string) => window.matchMedia(query).matches;
  return [
    `user agent: ${nav.userAgent}`,
    `installed app: ${media("(display-mode: standalone)") || nav.standalone === true ? "yes" : "no"}`,
    `language: page ${getLocale()}, browser ${nav.languages.join(", ")}`,
    `viewport: ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x, screen ${screen.width}x${screen.height}`,
    `dark mode: ${media("(prefers-color-scheme: dark)") ? "yes" : "no"}, reduced motion: ${media("(prefers-reduced-motion: reduce)") ? "yes" : "no"}`,
    `online: ${nav.onLine ? "yes" : "no"}${nav.connection?.effectiveType ? `, ${nav.connection.effectiveType}` : ""}${nav.connection?.saveData ? ", data saver" : ""}`,
    `cpu cores: ${nav.hardwareConcurrency ?? "-"}${nav.deviceMemory ? `, memory ${nav.deviceMemory} GB` : ""}`,
  ];
}

function pageLoad(): string[] {
  const now = Date.now();
  const entry = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  const paint = (name: string) =>
    performance.getEntriesByType("paint").find((one) => one.name === name)?.startTime;
  const lines = [
    `navigation started: ${time(performance.timeOrigin)} (${span(now - performance.timeOrigin)} ago)`,
    `how: ${entry?.type ?? "-"}`,
    `visible at start: ${launch.visibleAtStart ? "yes" : "no"}`,
    ...workerLaunch(),
  ];
  if (entry) {
    lines.push(
      // 0 bytes over the network: the service worker or the cache answered.
      `page from: ${entry.transferSize > 0 ? "network" : "cache / service worker"}`,
      `service worker started: ${ms(entry.workerStart)}`,
      `page received: ${ms(entry.responseEnd)}`,
      `html parsed: ${ms(entry.domInteractive)}`,
      `dom content loaded: ${ms(entry.domContentLoadedEventEnd)}`,
      `load event: ${ms(entry.loadEventEnd)}`,
    );
  }
  lines.push(
    `first paint: ${ms(paint("first-paint"))}`,
    `first contentful paint: ${ms(paint("first-contentful-paint"))}`,
    `app scripts ran: ${ms(markAt(MARK_MAIN))}`,
    `first render committed: ${ms(markAt(MARK_COMMIT))}`,
    `first frame after it: ${ms(markAt(MARK_FRAME))}`,
    `sidebar chunk arrived: ${ms(markAt(MARK_DEFERRED))}`,
  );
  return lines;
}

function resumeLine(resume: Resume): string {
  return [
    time(resume.at),
    resume.restored ? "restored from back-forward cache" : `hidden ${span(resume.hiddenFor)}`,
    `next frame ${resume.frameAfter === null ? "-" : `${resume.frameAfter} ms`}`,
  ].join(", ");
}

function resumes(): string[] {
  if (launch.resumes.length === 0) return ["none since the page started"];
  return launch.resumes.map(resumeLine);
}

function errors(): string[] {
  if (launch.errors.length === 0) return ["none since the page started"];
  return launch.errors.map((error) => `${time(error.at)} ${error.message}`);
}

async function serviceWorker(): Promise<string[]> {
  if (!("serviceWorker" in navigator)) return ["not supported"];
  const lines: string[] = [];
  const controller = navigator.serviceWorker.controller;
  lines.push(`controls this page: ${controller ? `yes (${controller.state})` : "no"}`);
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) lines.push("registration: none");
  else {
    const state = (worker: ServiceWorker | null) => worker?.state ?? "-";
    lines.push(
      `registration: active ${state(registration.active)}, waiting ${state(registration.waiting)}, installing ${state(registration.installing)}`,
    );
  }
  if ("caches" in window) {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      lines.push(`cache ${name}: ${(await cache.keys()).length} entries`);
    }
  }
  return lines;
}

async function storage(): Promise<string[]> {
  const lines: string[] = [];
  if (navigator.storage?.estimate) {
    const { usage, quota } = await navigator.storage.estimate();
    lines.push(
      `used: ${usage === undefined ? "-" : size(usage)} of ${quota === undefined ? "-" : size(quota)}`,
    );
  }
  if (navigator.storage?.persisted) {
    lines.push(`persistent: ${(await navigator.storage.persisted()) ? "yes" : "no"}`);
  }
  const keys = Object.keys(localStorage).sort();
  for (const key of keys) {
    lines.push(`${key}: ${size((localStorage.getItem(key) ?? "").length)}`);
  }
  return lines;
}

function data(): string[] {
  const profiles = loadProfiles();
  const activeName = loadActive();
  const active = profiles.find((profile) => profile.name === activeName) ?? profiles[0];
  const subjects = (active?.timetables ?? []).flatMap((timetable) =>
    timetable.subjects.map((_, extra) => extra),
  );
  const cache = loadCatalogCache();
  const url = loadCatalogUrl();
  return [
    `profiles: ${profiles.length}`,
    `active profile: ${active?.timetables.length ?? 0} timetables, ${subjects.length} subjects, ${subjects.filter((one) => one.enabled).length} enabled${active?.locked ? ", locked" : ""}`,
    `catalog: ${loadCatalogMode()}, ${url === null ? "built-in URL" : `own URL ${url}`}`,
    `catalog on this device: ${cache.index ? `${cache.index.files.length} files listed${cache.index.generated ? `, generated ${cache.index.generated}` : ""}` : "no index"}, ${Object.keys(cache.files).length} files kept`,
  ];
}

export async function debugReport(): Promise<string> {
  const parts = await Promise.all([
    section("App", () => [
      `version: ${__APP_VERSION__}`,
      `now: ${time(Date.now())} (UTC offset ${-new Date().getTimezoneOffset() / 60}h)`,
    ]),
    section("Device", environment),
    section("This page load (ms since navigation start)", pageLoad),
    section("Back from the background", resumes),
    section("Errors", errors),
    section("Service worker", serviceWorker),
    section("Storage", storage),
    section("Data", data),
  ]);
  return ["Zeiteisen debug info", ...parts].join("\n\n");
}
