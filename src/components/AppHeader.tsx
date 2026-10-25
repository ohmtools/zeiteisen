import type { ReactNode } from "react";
import { Layers, Lock, LockOpen, Settings, StickyNote } from "lucide-react";
import { cn } from "cn";
import { m } from "@/i18n";
import { Button } from "@/components/ui/button";
import { AppTile } from "@/components/ProfileTrigger";
import type { Step } from "@/lib/media";

// Groups and notes: a sidebar beside the grid on wide screens, a sheet from
// the right on compact ones, a page of their own on phones. The settings are
// no panel: a dialog, a page on phones (`SettingsPage`).
export type Panel = "groups" | "notes";

// Header icon buttons stand 8px apart; an open panel's button is filled, and
// stays so under the pointer (the ghost hover is darker than the fill in dark
// mode: the button looked switched off).
const ICON =
  "aria-pressed:bg-accent aria-pressed:hover:bg-accent dark:aria-pressed:hover:bg-accent";

// The one header row. Left the profile (menu and lock), then from compact on
// the view tabs and the week (or the week filter); right the panels and the
// settings. Phones keep the profile, the panels and the settings up here and
// move tabs, week and day to the bar at the bottom (`BottomBar`).
export function AppHeader({
  step,
  profile,
  locked,
  onToggleLock,
  views,
  panel,
  onPanel,
  settings,
  onSettings,
  welcome = false,
}: {
  step: Step;
  // The profile menu, its trigger included (deferred, with a look-alike).
  profile: ReactNode;
  locked: boolean;
  onToggleLock: () => void;
  // View tabs plus week nav or filter: shown here from compact on.
  views: ReactNode;
  panel: Panel | null;
  onPanel: (panel: Panel | null) => void;
  // The settings are open.
  settings: boolean;
  onSettings: () => void;
  // A first visit: the app's name instead of the profile, settings only.
  welcome?: boolean;
}) {
  const toggle = (next: Panel) => onPanel(panel === next ? null : next);
  const wide = step === "wide";
  return (
    <header
      className={cn(
        "flex shrink-0 items-center gap-4 border-b pt-[env(safe-area-inset-top)] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] compact:pr-[max(1.5rem,env(safe-area-inset-right))] compact:pl-[max(1.5rem,env(safe-area-inset-left))]",
        "h-[calc(3.5rem+env(safe-area-inset-top))] short:h-[calc(3rem+env(safe-area-inset-top))]",
      )}
    >
      {welcome ? (
        <span className="flex min-w-0 items-center gap-2 text-base font-semibold">
          <AppTile />
          {m.app_title()}
        </span>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          {profile}
          {step !== "narrow" && <LockButton locked={locked} onToggle={onToggleLock} />}
        </div>
      )}
      {!welcome && step !== "narrow" && (
        <>
          <div aria-hidden className="h-6 w-px shrink-0 bg-border" />
          <div className="flex min-w-0 items-center gap-4">{views}</div>
        </>
      )}
      <span className="flex-1" />
      <div className="-mr-2 flex shrink-0 items-center gap-2">
        {!welcome && step === "narrow" && <LockButton locked={locked} onToggle={onToggleLock} />}
        {!welcome && (
          <>
            {wide ? (
              <Button
                variant="ghost"
                className={ICON}
                aria-pressed={panel === "groups"}
                onClick={() => toggle("groups")}
              >
                <Layers data-icon="inline-start" />
                {m.panel_groups()}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className={ICON}
                aria-label={m.panel_groups()}
                aria-pressed={panel === "groups"}
                onClick={() => toggle("groups")}
              >
                <Layers />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={ICON}
              aria-label={m.notes_title()}
              aria-keyshortcuts="n"
              aria-pressed={panel === "notes"}
              onClick={() => toggle("notes")}
            >
              <StickyNote />
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={ICON}
          aria-label={m.tab_settings()}
          aria-pressed={settings}
          onClick={onSettings}
        >
          <Settings />
        </Button>
      </div>
    </header>
  );
}

// Lock applies to the profile, so the button sits on every view of it (grid,
// groups), not on notes and settings. Filled while locked.
export function LockButton({ locked, onToggle }: { locked: boolean; onToggle: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={ICON}
      aria-pressed={locked}
      aria-label={locked ? m.groups_unlock_hint() : m.groups_lock_hint()}
      title={locked ? m.groups_unlock_hint() : m.groups_lock_hint()}
      onClick={onToggle}
    >
      {locked ? <Lock /> : <LockOpen />}
    </Button>
  );
}
