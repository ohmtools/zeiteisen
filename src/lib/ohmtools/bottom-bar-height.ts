// ohmtools/design: shadcn/src/lib/ohmtools/bottom-bar-height.ts (copied by `ohmtools-design add`, do not edit)

// The bars at the bottom of a phone (view tabs, the view's controls) publish
// their joint height as `--bottom-bar` on <html>, so toasts stand above them
// (`AppToaster`). Hidden bars (`display: none`) count 0.

const bars = new Set<HTMLElement>();
let observer: ResizeObserver | undefined;

function publish() {
  let height = 0;
  for (const bar of bars) height += bar.offsetHeight;
  document.documentElement.style.setProperty("--bottom-bar", `${height}px`);
}

// As the `ref` of a bar at the bottom: measures it while it is mounted.
export function bottomBar(element: HTMLElement | null) {
  if (!element) return;
  observer ??= new ResizeObserver(publish);
  bars.add(element);
  observer.observe(element, { box: "border-box" });
  publish();
  return () => {
    bars.delete(element);
    observer?.unobserve(element);
    publish();
  };
}
