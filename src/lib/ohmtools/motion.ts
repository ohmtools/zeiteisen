// ohmtools/design: shadcn/src/lib/ohmtools/motion.ts (copied by `ohmtools-design add`, do not edit)
import { flushSync } from "react-dom";

// Motion without a library (DESIGN.md, "Motion"): the browser's View
// Transitions for what changes the layout (panels, pages), the Web Animations
// API for what only slides in, CSS for the rest, frame by frame
// (`requestAnimationFrame` with `ease`) for drawings. Every way respects
// `prefers-reduced-motion` and simply does nothing where the browser lacks it.

export function reducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// The design's one easing as CSS: fast out, gentle landing.
export const EASE = "cubic-bezier(0.2, 0, 0, 1)";
export const DURATION_IN = 560;
export const DURATION_OUT = 400;

let running = 0;

const READY_WAIT_MS = 400;

// Runs `update` (a React state change) inside a view transition: the browser
// shoots the page before and after and animates between them. `kind` stands
// on `html[data-transition]` while it runs, so the app's CSS picks the
// animation by it (`panel`, `forward`, `back`, …) and names its parts only
// then. `flushSync` makes React write the DOM inside the callback, where the
// browser expects it. `ready`: the new state is complete (a lazy page's first
// render is still its Suspense fallback); until then, at most
// `READY_WAIT_MS`, the browser keeps showing the old shot.
export function transition(kind: string, update: () => void, ready?: () => boolean): void {
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

// Slides an element in from one side (1: from the right, -1: from the left,
// 0: it just fades), after `delay` ms. Only the incoming state moves: nothing
// waits for an old one to leave, and layout never changes.
export function slideIn(
  element: Element,
  direction: -1 | 0 | 1,
  { distance = 24, delay = 0, duration = DURATION_IN } = {},
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

// A curve like CSS `cubic-bezier(x1, y1, x2, y2)` for animations that compute
// their own frames: the share of the way at a share of the time (0 … 1).
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  // The curve's coordinate at parameter s (Bernstein form, P0 = 0, P3 = 1).
  const at = (s: number, p1: number, p2: number) =>
    3 * (1 - s) ** 2 * s * p1 + 3 * (1 - s) * s ** 2 * p2 + s ** 3;
  const slope = (s: number, p1: number, p2: number) =>
    3 * (1 - s) ** 2 * p1 + 6 * (1 - s) * s * (p2 - p1) + 3 * s ** 2 * (1 - p2);
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // s for x: Newton where the curve is steep enough, else bisection.
    let s = x;
    for (let i = 0; i < 8; i++) {
      const d = slope(s, x1, x2);
      if (Math.abs(d) < 1e-6) break;
      const next = s - (at(s, x1, x2) - x) / d;
      if (next < 0 || next > 1) break;
      s = next;
    }
    if (Math.abs(at(s, x1, x2) - x) > 1e-6) {
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 40; i++) {
        s = (lo + hi) / 2;
        if (at(s, x1, x2) < x) lo = s;
        else hi = s;
      }
    }
    return at(s, y1, y2);
  };
}

// The design's one easing for computed frames.
export const ease = cubicBezier(0.2, 0, 0, 1);

// Slow at both ends, for an animation that explains something (DESIGN.md:
// "easing in and out so the eye can follow").
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
