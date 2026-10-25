import type { ReactNode } from "react";
import { Layers, Lock, LockOpen, Settings, StickyNote } from "lucide-react";
import { m } from "@/i18n";
import { Button } from "@/components/ui/button";
import { AppTile } from "@/components/ProfileTrigger";
import type { Step } from "@/lib/ohmtools/steps";

// Groups and notes, the panels (`Panel`): a sidebar beside the grid on wide
// screens, a sheet from the right on compact ones, a page of their own on
// phones. The settings are no panel: an area (`Settings`).
export type Panel = "groups" | "notes";

// Header icon buttons stand 8px apart; an open panel's button is filled, and
// stays so under the pointer (the ghost hover is darker than the fill in dark
// mode: the button looked switched off).
const ICON =
  "aria-pressed:bg-accent aria-pressed:hover:bg-accent dark:aria-pressed:hover:bg-accent";

// The header's right side, inside `AppShell` (brand left, the views between
// them from compact on): the panels and the settings, 8px apart. Phones keep
// the lock up here too; from compact on it stands beside the profile. A
// first visit shows the settings alone.
export function HeaderActions({
  step,
  locked,
  onToggleLock,
  panel,
  onPanel,
  settings,
  onSettings,
  welcome = false,
}: {
  step: Step;
  locked: boolean;
  onToggleLock: () => void;
  panel: Panel | null;
  onPanel: (panel: Panel | null) => void;
  // The settings are open.
  settings: boolean;
  onSettings: () => void;
  // A first visit: settings only.
  welcome?: boolean;
}) {
  const toggle = (next: Panel) => onPanel(panel === next ? null : next);
  return (
    <>
      {!welcome && step === "narrow" && <LockButton locked={locked} onToggle={onToggleLock} />}
      {!welcome && (
        <>
          {step === "wide" ? (
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
            aria-keyshortcuts={step === "narrow" ? undefined : "n"}
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
    </>
  );
}

// The header's left side: the profile menu (its trigger), from compact on
// with the lock beside it; a first visit shows the app's tile and name.
export function HeaderBrand({
  step,
  profile,
  locked,
  onToggleLock,
  welcome = false,
}: {
  step: Step;
  // The profile menu, its trigger included (deferred, with a look-alike).
  profile: ReactNode;
  locked: boolean;
  onToggleLock: () => void;
  welcome?: boolean;
}) {
  if (welcome) {
    return (
      <span className="flex min-w-0 items-center gap-2 text-base font-semibold">
        <AppTile />
        {m.app_title()}
      </span>
    );
  }
  return (
    <>
      {profile}
      {step !== "narrow" && <LockButton locked={locked} onToggle={onToggleLock} />}
    </>
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
