import type { ReactNode } from "react";
import { CalendarDays, ListChecks } from "lucide-react";
import { cn } from "cn";
import { m } from "@/i18n";
import { Button } from "@/components/ui/button";

export type Tab = "timetable" | "groups";

// One slot of the bar: icon over label. The settings menu's trigger (deferred
// chunk) uses it too, so all three slots look alike.
export const TAB_ITEM =
  "relative h-14 min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground aria-[current=page]:text-foreground";

// Below the `desktop` variant the app shows one of its two columns at a time:
// the grid with its dock, or profiles + group tree. This bar, fixed to the
// bottom of the screen, switches between them; its last slot opens the
// settings menu, which holds what the desktop footer shows. Desktop shows
// both columns and no bar.
export function TabBar({
  value,
  onChange,
  settings,
}: {
  value: Tab;
  onChange: (tab: Tab) => void;
  settings: ReactNode;
}) {
  const tabs: { tab: Tab; label: string; Icon: typeof CalendarDays }[] = [
    { tab: "timetable", label: m.tab_timetable(), Icon: CalendarDays },
    { tab: "groups", label: m.tab_groups(), Icon: ListChecks },
  ];
  return (
    <nav
      aria-label={m.tab_label()}
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background pb-[env(safe-area-inset-bottom)] desktop:hidden"
    >
      {tabs.map(({ tab, label, Icon }) => (
        <Button
          key={tab}
          variant="ghost"
          aria-current={tab === value ? "page" : undefined}
          className={TAB_ITEM}
          onClick={() => onChange(tab)}
        >
          {/* The active tab's line sits on the bar's divider. */}
          <span
            aria-hidden
            className={cn("absolute inset-x-0 -top-px h-0.5 bg-primary", tab !== value && "hidden")}
          />
          <Icon className="size-5" />
          {label}
        </Button>
      ))}
      {settings}
    </nav>
  );
}
