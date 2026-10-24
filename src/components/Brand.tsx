import { cn } from "cn";
import { m } from "@/i18n";

// App name and version, under About in the settings. The version tells which
// deploy a user's service worker serves.
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5 text-sm font-semibold", className)}>
      {m.app_title()}
      <span className="font-mono text-xs font-normal text-muted-foreground">
        v{__APP_VERSION__}
      </span>
    </span>
  );
}
