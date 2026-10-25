import { flushSync } from "react-dom";

// Motion without a library (`src/lib/NOTES.md`): the browser's View
// Transitions for what changes the layout (panels, pages), the Web Animations
// API for what only slides in (week, day, category view), CSS for the rest.
// Every way respects `prefers-reduced-motion` and simply does nothing where
// the browser lacks it.

export function reducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Which view transition runs: `src/motion.css` picks the animation by
// `html[data-transition]`. `panel`: the wide sidebar opens, closes or changes;
// `forward` / `back`: a phone page comes in from the right, or goes back.
export type TransitionKind = "panel" | "forward" | "back";

let running = 0;

const READY_WAIT_MS = 400;

// Runs `update` (a React state change) inside a view transition: the browser
// shoots the page before and after and animates between them. `flushSync`
// makes React write the DOM inside the callback, where the browser expects it.
// `ready`: the new state is complete. A lazy panel's first render is still
// its Suspense fallback; until then (at most `READY_WAIT_MS`) the browser
// keeps showing the old shot instead of animating an empty page.
export function transition(kind: TransitionKind, update: () => void, ready?: () => boolean): void {
  if (
    typeof document.startViewTransition !== "function" ||
    document.visibilityState !== "visible" ||
    reducedMotion()
  ) {
    update();
    return;
  }
  const root = document.documentElement;
  const mine = ++running;
  root.dataset.transition = kind;
  const shown = document.startViewTransition(async () => {
    flushSync(update);
    const start = Date.now();
    while (ready && !ready() && Date.now() - start < READY_WAIT_MS) {
      await new Promise((done) => setTimeout(done, 16));
    }
  });
  // A newer transition skips this one: only the last one clears the mark.
  void shown.finished.finally(() => {
    if (running === mine) delete root.dataset.transition;
  });
}

// The app's one easing: fast out, gentle landing.
export const EASE = "cubic-bezier(0.2, 0, 0, 1)";

// Slides an element in from one side (1: from the right, -1: from the left,
// 0: it just fades), after `delay` ms. Only the incoming state moves: nothing
// waits for an old one to leave, and layout never changes.
export function slideIn(
  element: Element,
  direction: -1 | 0 | 1,
  { distance = 24, delay = 0, duration = 560 } = {},
): void {
  if (reducedMotion()) return;
  element.animate(
    [
      { opacity: 0, transform: `translateX(${direction * distance}px)` },
      { opacity: 1, transform: "none" },
    ],
    { duration, delay, easing: EASE, fill: "backwards" },
  );
}
