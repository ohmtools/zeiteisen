import { cn } from "cn";
import { m } from "@/i18n";

// Logo and app name. No header (user decision): this sits in the desktop
// footer and in the phone's settings menu.
export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 font-heading font-semibold", className)}>
      <img src="/favicon.svg" alt="" className="size-5" />
      {m.app_title()}
    </span>
  );
}
