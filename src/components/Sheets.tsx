import type { ReactNode } from "react";
import { m } from "@/i18n";
import { PhoneDrawer } from "@/components/ohmtools/phone-drawer";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

// The grid's details, kept out of the first load (deferred chunk). Panels,
// popups and their drawers are the design's (`@/components/ohmtools`).

// A block's details (or an all-day chip's events): a drawer from the bottom
// on phones (the design's `PhoneDrawer`), a sheet from the right on a phone
// turned sideways (no drawers from compact on). Not `Popup`: the grid opens
// one popover for all blocks at the pointer (`TimetableGrid`).
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
    <PhoneDrawer open={open} onOpenChange={change} dismiss="close" title={title} titleHidden>
      {children}
    </PhoneDrawer>
  );
}
