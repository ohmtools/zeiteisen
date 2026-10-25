import { useState, type ReactNode } from "react";
import { Check, Copy, Lock, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { m } from "@/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { ExportButtons } from "@/components/ExportButtons";
import { ProfileNameDialog } from "@/components/ProfileNameDialog";
import { PROFILE_TRIGGER, ProfileTriggerContent } from "@/components/ProfileTrigger";
import type { Catalog } from "@/lib/primitives/catalog";
import type { SemesterDates } from "@/lib/primitives/meta";
import { duplicateName, nameTaken, profileByName, type Profile } from "@/lib/primitives/profile";
import type { Step } from "@/lib/media";

type Props = {
  step: Step;
  profiles: Profile[];
  activeName: string;
  // The lecture period the calendar export runs over.
  dates: SemesterDates | null;
  catalog: Catalog;
  onSelect: (name: string) => void;
  // Opens the timetable picker, which lives in `App`: a new profile starts by
  // choosing its timetables.
  onOpenAdd: () => void;
  onRename: (from: string, to: string) => void;
  // A copy of the profile `source` under a new name; it becomes the active one.
  onDuplicate: (source: string, name: string) => void;
  onRemove: (name: string) => void;
  onOpenImport: () => void;
};

// Everything about profiles, behind the header's profile button: a popover,
// a drawer on phones. The profiles with the active one ticked and a lock on
// locked ones, each with rename, duplicate and delete; then a new profile,
// the import, and the active profile's exports (.ics, link, .profile), which
// work while it is locked. Lock itself is the button next to it. Lives in
// the deferred chunk; App shows a disabled look-alike trigger until then.
export function ProfileMenu({
  step,
  profiles,
  activeName,
  dates,
  catalog,
  onSelect,
  onOpenAdd,
  onRename,
  onDuplicate,
  onRemove,
  onOpenImport,
}: Props) {
  const [open, setOpen] = useState(false);
  // The profile a dialog is about, by name.
  const [renaming, setRenaming] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const active = profileByName(profiles, activeName);
  const source = duplicating === null ? undefined : profileByName(profiles, duplicating);
  // A dialog takes over from the menu.
  const then = (run: () => void) => () => {
    setOpen(false);
    run();
  };

  const body = (
    <div className="flex flex-col gap-3 text-sm">
      <div className="-mx-2 flex flex-col">
        {profiles.map((profile) => (
          <div key={profile.name} className="flex items-center">
            <Button
              variant="ghost"
              className="h-9 min-w-0 flex-1 justify-start gap-2 px-2 font-normal"
              aria-current={profile.name === activeName || undefined}
              onClick={then(() => onSelect(profile.name))}
            >
              {profile.name === activeName ? (
                <Check data-icon="inline-start" />
              ) : (
                <span className="size-4 shrink-0" />
              )}
              <span className="truncate">{profile.name}</span>
              {profile.locked && (
                <Lock className="text-muted-foreground" aria-label={m.profile_locked()} />
              )}
            </Button>
            <RowAction
              label={m.profile_rename_named({ name: profile.name })}
              disabled={profile.locked}
              onClick={then(() => setRenaming(profile.name))}
            >
              <Pencil />
            </RowAction>
            {/* Copies this row's profile; only the copy becomes active, so a
                cancel changes nothing. Works while locked: it only reads. */}
            <RowAction
              label={m.profile_duplicate_named({ name: profile.name })}
              onClick={then(() => setDuplicating(profile.name))}
            >
              <Copy />
            </RowAction>
            <RowAction
              label={m.profile_delete_named({ name: profile.name })}
              disabled={profile.locked}
              onClick={then(() => setRemoving(profile.name))}
            >
              <Trash2 />
            </RowAction>
          </div>
        ))}
      </div>
      <div className="-mx-2 flex flex-col border-t pt-3">
        <Button variant="ghost" className="justify-start px-2" onClick={then(onOpenAdd)}>
          <Plus data-icon="inline-start" />
          {m.profile_add()}
        </Button>
        <Button variant="ghost" className="justify-start px-2" onClick={then(onOpenImport)}>
          <Upload data-icon="inline-start" />
          {m.profile_import()}
        </Button>
      </div>
      <div className="flex flex-col gap-2 border-t pt-3">
        <span className="text-xs text-muted-foreground">
          {m.profile_export({ name: activeName })}
        </span>
        <ExportButtons dates={dates} profile={active} catalog={catalog} />
      </div>
    </div>
  );

  const trigger = (
    <Button variant="ghost" className={PROFILE_TRIGGER} aria-label={m.profile_menu()} />
  );
  const content = <ProfileTriggerContent name={activeName} />;

  return (
    <>
      {step === "narrow" ? (
        <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
          <DrawerTrigger render={trigger}>{content}</DrawerTrigger>
          <DrawerContent>
            <div className="relative flex flex-col gap-3 overflow-y-auto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <DrawerTitle className="text-base font-semibold">{m.groups_profile()}</DrawerTitle>
              {body}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={trigger}>{content}</PopoverTrigger>
          <PopoverContent align="start" className="w-80 gap-3">
            <PopoverTitle className="text-base font-semibold">{m.groups_profile()}</PopoverTitle>
            {body}
          </PopoverContent>
        </Popover>
      )}

      <ProfileNameDialog
        open={renaming !== null}
        mode="rename"
        initial={renaming ?? ""}
        taken={(name) => nameTaken(profiles, name, renaming ?? undefined)}
        onOpenChange={(next) => {
          if (!next) setRenaming(null);
        }}
        onSubmit={(name) => {
          if (renaming !== null) onRename(renaming, name);
        }}
      />

      <ProfileNameDialog
        open={duplicating !== null}
        mode="duplicate"
        initial={source ? duplicateName(profiles, source) : ""}
        taken={(name) => nameTaken(profiles, name)}
        onOpenChange={(next) => {
          if (!next) setDuplicating(null);
        }}
        onSubmit={(name) => {
          if (duplicating !== null) onDuplicate(duplicating, name);
        }}
      />

      <AlertDialog
        open={removing !== null}
        onOpenChange={(next) => {
          if (!next) setRemoving(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.profile_delete_title({ name: removing ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{m.profile_delete_text()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (removing !== null) onRemove(removing);
                setRemoving(null);
              }}
            >
              {m.profile_delete_confirm()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// A row's icon buttons stand without gaps (user decision).
function RowAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-foreground"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
