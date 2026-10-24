import type { ReactNode } from "react";
import { ChevronLeft, X } from "lucide-react";
import { m } from "@/i18n";
import { Button } from "@/components/ui/button";

// The title row of a panel: on phones a back arrow before the title (the
// panel is a page), elsewhere a close button after the actions. A sub view
// (a category) has its back arrow everywhere. 56px, like the app header.
export function PanelHeader({
  title,
  subtitle,
  actions,
  onBack,
  onClose,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  onBack?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2 px-4 compact:px-6">
      {onBack && (
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2"
          aria-label={m.panel_back()}
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
          <Button variant="ghost" size="icon" aria-label={m.panel_close()} onClick={onClose}>
            <X />
          </Button>
        )}
      </div>
    </div>
  );
}
