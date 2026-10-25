// ohmtools/design: shadcn/src/components/ohmtools/app-toaster.tsx (copied by `ohmtools-design add`, do not edit)
import type { ComponentProps } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useStep } from "@/lib/ohmtools/steps";

// Phones: 16px above the bars at the bottom (`--bottom-bar`, 0 without
// bars); from compact on bottom right (DESIGN.md, "App shell"). Mount it
// once, at the root.
const ABOVE_BARS = "calc(var(--bottom-bar, 0px) + 16px)";

export function AppToaster(props: ComponentProps<typeof Toaster>) {
  const narrow = useStep() === "narrow";
  const bottom = narrow ? { bottom: ABOVE_BARS } : undefined;
  return <Toaster position="bottom-right" offset={bottom} mobileOffset={bottom} {...props} />;
}
