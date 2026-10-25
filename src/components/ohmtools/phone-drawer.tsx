// ohmtools/design: shadcn/src/components/ohmtools/phone-drawer.tsx (copied by `ohmtools-design add`, do not edit)
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";

// The ways a person leaves a popup without choosing anything: a swipe down,
// a press outside, Esc, the back gesture, the close button.
const DISMISS = new Set([
  "swipe",
  "outside-press",
  "escape-key",
  "close-watcher",
  "focus-out",
  "close-press",
]);

// What leaving a popup that way does (DESIGN.md, "Popups"):
// - "close": it closes. For popups where closing loses nothing: a menu, a
//   popover, a selection, an editor whose changes apply at once.
// - a function: the popup's Cancel, run without asking.
// - "block": nothing. The popup has no Cancel and waits for its buttons.
export type Dismiss = "close" | "block" | (() => void);

type ChangeDetails = { reason: string; cancel: () => void };

// An `onOpenChange` for a Base UI popup root that applies `dismiss`.
export function dismissible(
  dismiss: Dismiss,
  onOpenChange: (open: boolean) => void,
): (open: boolean, details: ChangeDetails) => void {
  return (open, details) => {
    if (!open && DISMISS.has(details.reason)) {
      if (dismiss === "block") {
        details.cancel();
        return;
      }
      if (typeof dismiss === "function") dismiss();
    }
    onOpenChange(open);
  };
}

// Open state for a popup that may be controlled (`open` given) or not.
export function useOpenState(
  open: boolean | undefined,
  onOpenChange: ((open: boolean) => void) | undefined,
): [boolean, (open: boolean) => void] {
  const [own, setOwn] = useState(false);
  const shown = open ?? own;
  return [
    shown,
    (next) => {
      if (open === undefined) setOwn(next);
      onOpenChange?.(next);
    },
  ];
}

// A drawer from the bottom: every popup's container on phones (DESIGN.md,
// "Elements by step"). The swipe handle shows only where a swipe closes it.
// The content starts 16px under the handle and scrolls inside the drawer;
// `footer` holds the buttons, stacked full width at 44px, the main one on
// top (put it last, as in a dialog's footer).
export function PhoneDrawer({
  open,
  onOpenChange,
  dismiss,
  title,
  titleHidden = false,
  description,
  initialFocus,
  footer,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dismiss: Dismiss;
  title: ReactNode;
  // The content shows its own heading; the title is for screen readers.
  titleHidden?: boolean;
  description?: ReactNode;
  initialFocus?: React.ComponentProps<typeof DrawerContent>["initialFocus"];
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Drawer
      open={open}
      onOpenChange={dismissible(dismiss, onOpenChange)}
      showSwipeHandle={dismiss !== "block"}
    >
      <DrawerContent initialFocus={initialFocus}>
        <div
          className={cn(
            "relative flex flex-col gap-4 overflow-y-auto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
            className,
          )}
        >
          <div className={cn("flex flex-col gap-1", titleHidden && !description && "sr-only")}>
            <DrawerTitle className={cn("text-base font-semibold", titleHidden && "sr-only")}>
              {title}
            </DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </div>
          {children}
          {footer && (
            <div className="flex flex-col-reverse gap-2 pt-2 *:data-[slot=button]:h-11 *:data-[slot=button]:w-full">
              {footer}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
