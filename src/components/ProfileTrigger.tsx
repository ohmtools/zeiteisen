import { ChevronsUpDown } from "lucide-react";
import { cn } from "cn";
import { m } from "@/i18n";
import { Button } from "@/components/ui/button";

// The app's mark (`public/logo.svg`, inline so it is there without a fetch;
// the backdrop's hairline is dropped, invisible at this size) and the one
// place the profile shows.
export function AppTile({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 512 512" className={cn("size-7 shrink-0", className)}>
      <rect width="512" height="512" rx="112" fill="#000000" />
      <rect x="244" y="112" width="24" height="30" rx="7" fill="#FAFAFA" />
      <circle cx="256" cy="100" r="20" fill="none" stroke="#FAFAFA" strokeWidth="18" />
      <circle cx="256" cy="288" r="144" fill="#0A0A0A" stroke="#FAFAFA" strokeWidth="22" />
      <rect x="174" y="202" width="70" height="80" rx="12" fill="#DC2626" />
      <rect x="174" y="294" width="70" height="80" rx="12" fill="#FAFAFA" />
      <rect x="258" y="202" width="80" height="172" rx="12" fill="#F97316" />
    </svg>
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
