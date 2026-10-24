import type { Kind } from "@/lib/primitives/subject";
import { colourKind } from "@/lib/layout";

// Blocks are coloured by kind only, never by timetable (user decision): the
// most specific kind of the subject (`colourKind`). Static class names, so
// Tailwind sees them.
export const KIND_CLASS: Record<Kind, string> = {
  SU: "bg-kind-su border-kind-su-border",
  Ue: "bg-kind-ue border-kind-ue-border",
  Pr: "bg-kind-pr border-kind-pr-border",
  Tu: "bg-kind-tu border-kind-tu-border",
  S: "bg-kind-s border-kind-s-border",
  WF: "bg-kind-wf border-kind-wf-border",
};

export function kindClass(kinds: readonly Kind[]): string {
  return KIND_CLASS[colourKind(kinds)];
}
