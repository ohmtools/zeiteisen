// Launch timings for the "Debug info" (`src/lib/launch.ts` asks for them on
// every page start): when this worker came to life and when it saw the last
// navigations. Wall-clock `Date.now()`, the clock the page compares with.
// `vite.config.ts` imports this first into the generated service worker; it
// only watches, it never answers a request.
const zeiteisenLaunch = {
  // The worker's global was created (its script was then fetched and run).
  created: self.performance?.timeOrigin ?? null,
  started: Date.now(),
  navigations: [],
};

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  zeiteisenLaunch.navigations.push(Date.now());
  if (zeiteisenLaunch.navigations.length > 5) zeiteisenLaunch.navigations.shift();
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "zeiteisen:launch") return;
  event.ports[0]?.postMessage({ ...zeiteisenLaunch, answered: Date.now() });
});
