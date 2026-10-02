import { useEffect } from "react";
import { markFirstRender } from "@/lib/launch";

// Rendered after App in `main.tsx`: a sibling's effects run once the whole
// first render is committed, which the debug info times.
export function LaunchMarks(): null {
  useEffect(markFirstRender, []);
  return null;
}
