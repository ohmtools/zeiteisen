// ohmtools/design: shadcn/src/components/ohmtools/panel-sheet.tsx (copied by `ohmtools-design add`, do not edit)
import type { ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";

// A panel on a compact screen: a sheet from the right, 380px, over the
// content (DESIGN.md, "App shell"); on wide screens the same panel is a
// sidebar beside the content, on phones a page. Also the compact container
// of an editor that does not fit into the page. The panel brings its own
// header (`PanelHeader` with `onClose`).
export function PanelSheet({
  open,
  initialFocus = true,
  onClose,
  children,
}: {
  open: boolean;
  // `false`: the panel focuses on its own.
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
