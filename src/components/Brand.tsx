import { cn } from "cn";
import { m } from "@/i18n";

// Logo, app name and version. No header (user decision): this sits in the
// desktop footer and on the phone's Settings page. The version tells which
// deploy a user's service worker serves.
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-heading font-semibold", className)}>
      <img src="/favicon.svg" alt="" className="size-5" />
      {m.app_title()}
      <span className="ml-1 text-xs font-normal text-muted-foreground">v{__APP_VERSION__}</span>
    </span>
  );
}
