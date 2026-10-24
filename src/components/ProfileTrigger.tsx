import { CalendarDays, ChevronsUpDown } from "lucide-react";
import { cn } from "cn";
import { m } from "@/i18n";
import { Button } from "@/components/ui/button";

// The red tile: the app's mark and the one place the profile shows.
export function AppTile({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-sm bg-red text-red-foreground",
        className,
      )}
    >
      <CalendarDays className="size-4" />
    </span>
  );
}

// What the profile menu's trigger shows: the tile, the active profile's name
// and the up-down chevrons. Also the disabled look-alike App shows while the
// menu (deferred chunk) loads, so nothing shifts.
export function ProfileTriggerContent({ name }: { name: string }) {
  return (
    <>
      <AppTile />
      <span className="truncate font-semibold">{name}</span>
      <ChevronsUpDown className="text-muted-foreground" />
    </>
  );
}

export const PROFILE_TRIGGER = "-ml-2 h-9 min-w-0 gap-2 px-2 text-sm";

export function ProfileTriggerFallback({ name }: { name: string }) {
  return (
    <Button variant="ghost" className={PROFILE_TRIGGER} disabled aria-label={m.profile_menu()}>
      <ProfileTriggerContent name={name} />
    </Button>
  );
}
