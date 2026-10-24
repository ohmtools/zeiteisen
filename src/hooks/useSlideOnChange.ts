import { useLayoutEffect, useRef } from "react";

// Calls `slide` with the direction `page` moved in (1: on, -1: back) whenever
// it changes, never on the first render. Runs before the browser paints, so
// an animation started in `slide` covers the new state from its first frame.
export function useSlideOnChange(page: number, slide: (direction: -1 | 1) => void): void {
  const previous = useRef(page);
  useLayoutEffect(() => {
    const from = previous.current;
    previous.current = page;
    if (from === page) return;
    slide(page > from ? 1 : -1);
  }, [page, slide]);
}
