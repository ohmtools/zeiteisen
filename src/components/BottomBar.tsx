import { useLayoutEffect, useRef, type ReactNode } from "react";

// Phones: view tabs, week (or the week filter) and day at the bottom, within
// thumb reach (user decision), under a divider. Its height is published as
// `--bottom-bar` on the root, so toasts sit above it (`AppToaster`).
export function BottomBar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() =>
      root.style.setProperty("--bottom-bar", `${bar.offsetHeight}px`),
    );
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--bottom-bar");
    };
  }, []);
  return (
    <div
      ref={ref}
      className="flex shrink-0 flex-col gap-3 border-t pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))]"
    >
      {children}
    </div>
  );
}
