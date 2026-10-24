import { useSyncExternalStore } from "react";
import { currentStep, SHORT_QUERY, watchStep, type Step } from "@/lib/media";

// The layout step (`@/lib/media`), live: turning a phone or resizing a window
// moves a panel between page, sheet and sidebar.
export function useStep(): Step {
  return useSyncExternalStore(watchStep, currentStep);
}

function watchShort(onChange: () => void): () => void {
  const query = matchMedia(SHORT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// A short landscape screen (`short` variant), live.
export function useShort(): boolean {
  return useSyncExternalStore(watchShort, () => matchMedia(SHORT_QUERY).matches);
}
