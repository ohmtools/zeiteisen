import { useEffect, useState } from "react";

// Below this, a smaller visual viewport is the browser's bars, not a keyboard.
const KEYBOARD_THRESHOLD = 60;

// How far the on-screen keyboard covers the page from below, in px, while
// `active`; 0 without one. The keyboard covers the page instead of resizing it
// (`interactive-widget=resizes-visual`, the design's rule), so what sits at
// the bottom (the notes' insert bar on phones) is lifted by this much. The
// page never scrolls (one viewport tall), so a scroll the browser made to
// reveal the caret is taken back: it pushed the page's top out of view and
// every drawer opened over it.
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!active || !viewport) return;
    const update = () => {
      if (window.scrollY !== 0) window.scrollTo({ top: 0, behavior: "instant" });
      // Pinch zoom moves the visual viewport too: no keyboard to tell from it.
      const covered =
        viewport.scale === 1 ? window.innerHeight - viewport.offsetTop - viewport.height : 0;
      setInset(covered > KEYBOARD_THRESHOLD ? Math.ceil(covered) : 0);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    // Chrome may resize the layout viewport after the visual one settled.
    window.addEventListener("resize", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [active]);

  return active ? inset : 0;
}
