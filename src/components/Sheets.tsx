import type { ReactNode } from "react";
import { m } from "@/i18n";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

// The containers that are dialogs underneath, kept out of the first load
// (deferred chunk): the compact screens' panel sheet, the phones' drawers.

// Compact screens: groups, notes or settings as a sheet from the right, 380px
// (user decision), over the grid. The panel brings its own header and close
// button.
export function PanelSheet({
  open,
  initialFocus = true,
  onClose,
  children,
}: {
  open: boolean;
  // `false`: the panel focuses on its own (the notes after N).
  initialFocus?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        initialFocus={initialFocus}
        className="w-[380px] max-w-[calc(100%-2rem)] gap-0 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] data-[side=right]:sm:max-w-[380px]"
      >
        {children}
      </SheetContent>
    </Sheet>
  );
}

// A block's details (or an all-day chip's events): a drawer from the bottom
// on phones, a sheet from the right on a phone turned sideways.
export function DetailsSheet({
  open,
  side,
  title = m.details_title(),
  onClose,
  children,
}: {
  open: boolean;
  side: "bottom" | "right";
  // For screen readers; the content shows its own heading.
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const change = (next: boolean) => {
    if (!next) onClose();
  };
  if (side === "right") {
    return (
      <Sheet open={open} onOpenChange={change}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-[380px] max-w-[calc(100%-2rem)] overflow-y-auto p-4 pr-[max(1rem,env(safe-area-inset-right))] data-[side=right]:sm:max-w-[380px]"
        >
          <SheetTitle className="sr-only">{title}</SheetTitle>
          {children}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Drawer open={open} onOpenChange={change} showSwipeHandle>
      <DrawerContent>
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <div className="overflow-y-auto px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// The phones' week picker.
export function WeekDrawer({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent>
        <DrawerTitle className="sr-only">{m.week_pick()}</DrawerTitle>
        <div className="pb-[env(safe-area-inset-bottom)]">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
