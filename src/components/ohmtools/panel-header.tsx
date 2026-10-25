// ohmtools/design: shadcn/src/components/ohmtools/panel-header.tsx (copied by `ohmtools-design add`, do not edit)
import type { ReactNode } from "react";
import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// The title row of a panel or a page: on phones a back arrow before the
// title (the panel is a page there), elsewhere a close button after the
// actions. A sub view has its back arrow everywhere. 56px, like the header.
export function PanelHeader({
  title,
  subtitle,
  actions,
  onBack,
  backLabel = "Back",
  onClose,
  closeLabel = "Close",
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  onClose?: () => void;
  closeLabel?: string;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 px-4 compact:px-6">
      {onBack && (
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2"
          aria-label={backLabel}
          onClick={onBack}
        >
          <ChevronLeft />
        </Button>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="truncate text-base leading-6 font-semibold">{title}</h2>
        {subtitle && <span className="truncate text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      <div className="-mr-2 flex shrink-0 items-center gap-2">
        {actions}
        {onClose && (
          <Button variant="ghost" size="icon" aria-label={closeLabel} onClick={onClose}>
            <X />
          </Button>
        )}
      </div>
    </div>
  );
}
