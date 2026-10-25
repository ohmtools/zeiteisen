// ohmtools/design: shadcn/src/components/ohmtools/views.tsx (copied by `ohmtools-design add`, do not edit)
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useShell } from "@/components/ohmtools/app-shell";
import { transition } from "@/lib/ohmtools/motion";
import { useStep } from "@/lib/ohmtools/steps";

// The element group "View" (DESIGN.md, "Which group"): main views of equal
// rank behind tabs, in the bar at the bottom on phones, in the header from
// compact on. The view behind another tab comes in from that tab's side.
// Render the picked view's content as the shell's content.
export function Views<Value extends string>({
  value,
  onValueChange,
  items,
  label,
}: {
  value: Value;
  onValueChange: (value: Value) => void;
  items: readonly { value: Value; label: ReactNode }[];
  // The tab list's accessible name ("Views").
  label: string;
}) {
  const narrow = useStep() === "narrow";
  const target = useShell().slots[narrow ? "bar" : "views"];
  if (!target) return null;
  const index = (one: string) => items.findIndex((item) => item.value === one);
  return createPortal(
    <Tabs
      value={value}
      onValueChange={(next) => {
        const item = items.find((one) => one.value === next);
        if (!item || item.value === value) return;
        const kind = index(item.value) > index(value) ? "view-next" : "view-previous";
        transition(kind, () => onValueChange(item.value));
      }}
    >
      <TabsList aria-label={label} className={narrow ? "h-10 w-full" : undefined}>
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>,
    target,
  );
}

// The view's own controls (zeiteisen's week and day), with the views: in the
// bar at the bottom on phones, in the header from compact on. `narrow` adds
// what only phones need (a day picker where compact screens show the week).
export function ViewControls({ children, narrow }: { children?: ReactNode; narrow?: ReactNode }) {
  const isNarrow = useStep() === "narrow";
  const target = useShell().slots[isNarrow ? "bar" : "views"];
  if (!target) return null;
  return createPortal(
    <>
      {children}
      {isNarrow && narrow}
    </>,
    target,
  );
}
