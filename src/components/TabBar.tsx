import { CalendarDays, ListChecks, NotebookPen, Settings } from "lucide-react";
import { cn } from "cn";
import { m } from "@/i18n";
import { Button } from "@/components/ui/button";

export type Tab = "timetable" | "groups" | "notes" | "settings";

// One slot of the bar: icon over label.
const TAB_ITEM =
  "relative h-14 min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground aria-[current=page]:text-foreground";

// Below the `desktop` variant the app shows one page at a time: the grid with
// its dock, profiles + group tree, the notes, or the settings (what the
// desktop footer shows). This bar, fixed to the bottom of the screen, switches between them.
// Desktop shows both columns, the notes, the footer and no bar.
export function TabBar({ value, onChange }: { value: Tab; onChange: (tab: Tab) => void }) {
  const tabs: { tab: Tab; label: string; Icon: typeof CalendarDays }[] = [
    { tab: "timetable", label: m.tab_timetable(), Icon: CalendarDays },
    { tab: "groups", label: m.tab_groups(), Icon: ListChecks },
    { tab: "notes", label: m.tab_notes(), Icon: NotebookPen },
    { tab: "settings", label: m.tab_settings(), Icon: Settings },
  ];
  return (
    <nav
      aria-label={m.tab_label()}
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] desktop:hidden"
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
    </nav>
  );
}
