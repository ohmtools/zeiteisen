import { useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  FolderOpen,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Trash2,
  User,
} from "lucide-react";
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
import {
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExportButtons } from "@/components/ExportButtons";
import { ProfileNameDialog } from "@/components/ProfileNameDialog";
import { Section } from "@/components/Section";
import type { ShareLink } from "@/hooks/useShareLink";
import type { Catalog } from "@/lib/primitives/catalog";
import type { SemesterDates } from "@/lib/primitives/meta";
import { duplicateName, nameTaken, profileByName, type Profile } from "@/lib/primitives/profile";

type Props = {
  className?: string;
  profiles: Profile[];
  activeName: string;
  locked: boolean;
  // The lecture period the calendar export runs over.
  dates: SemesterDates | null;
  share: ShareLink | null;
  catalog: Catalog;
  onSelect: (name: string) => void;
  // Opens the timetable picker, which lives in `App`: a new profile starts by
  // choosing its timetables.
  onOpenAdd: () => void;
  onRename: (from: string, to: string) => void;
  // A copy of the active profile under a new name; it becomes the active one.
  onDuplicate: (name: string) => void;
  onRemove: (name: string) => void;
  onToggleLock: () => void;
  onOpenImport: () => void;
};

// Everything that acts on the profile itself: pick one, import one, lock it
// and export it. Lock applies to the profile, not to the current group
// selection — a locked profile keeps its stored selection until it is
// unlocked, and rename, delete and every edit in the tree are disabled
// meanwhile. Exporting still works. Group selection lives one section below,
// in `GroupTree`.
export function ProfileSection({
  className,
  profiles,
  activeName,
  locked,
  dates,
  share,
  catalog,
  onSelect,
  onOpenAdd,
  onRename,
  onDuplicate,
  onRemove,
  onToggleLock,
  onOpenImport,
}: Props) {
  const [renaming, setRenaming] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [removing, setRemoving] = useState(false);
  const active: Profile | undefined = profileByName(profiles, activeName);

  return (
    <Section className={className}>
      {/* Title and description flow around the lock button instead of
          keeping a column free under it: floated, and first so it floats to
          the top. `flow-root` keeps the float inside the header; `mt-1.5` is
          the grid gap the other sections' headers have. `flex` keeps the float
          as tall as the button (36px) and `mb-2` takes it past the
          description's first line (it starts at 34px: 28px title + 6px), so
          that line wraps beside the button and only the lines under it run
          full width, a line height below the button. */}
      <CardHeader className="flow-root">
        <CardAction className="float-right mb-2 ml-4 flex">
          <Button
            variant={locked ? "default" : "outline"}
            size="sm"
            title={locked ? m.groups_unlock_hint() : m.groups_lock_hint()}
            onClick={onToggleLock}
          >
            {locked ? <LockOpen data-icon="inline-start" /> : <Lock data-icon="inline-start" />}
            {locked ? m.groups_unlock() : m.groups_lock()}
          </Button>
        </CardAction>
        <CardTitle>{m.groups_profile()}</CardTitle>
        <CardDescription className="mt-1.5">{m.profile_description()}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="flex-1" />}>
              <User data-icon="inline-start" />
              <span className="truncate">{active?.name ?? m.profile_none()}</span>
              <ChevronDown data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{m.groups_profile()}</DropdownMenuLabel>
                {profiles.length === 0 && (
                  <DropdownMenuItem disabled>{m.profile_none()}</DropdownMenuItem>
                )}
                {profiles.map((profile) => (
                  <DropdownMenuItem key={profile.name} onClick={() => onSelect(profile.name)}>
                    {profile.name === activeName ? (
                      <Check data-icon="inline-start" />
                    ) : (
                      <span className="size-4" />
                    )}
                    <span className="truncate">{profile.name}</span>
                    {profile.locked && <Lock data-icon="inline-end" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {/* A new profile starts by choosing its own timetables. */}
              <DropdownMenuItem onClick={onOpenAdd}>
                <Plus data-icon="inline-start" />
                {m.profile_add()}
              </DropdownMenuItem>
              {/* Only reads the profile, so it works while locked too. */}
              <DropdownMenuItem disabled={!active} onClick={() => setDuplicating(true)}>
                <Copy data-icon="inline-start" />
                {m.profile_duplicate()}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={locked || !active} onClick={() => setRenaming(true)}>
                <Pencil data-icon="inline-start" />
                {m.profile_rename()}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={locked || !active}
                variant="destructive"
                onClick={() => setRemoving(true)}
              >
                <Trash2 data-icon="inline-start" />
                {m.profile_delete()}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={onOpenImport}>
            <FolderOpen data-icon="inline-start" />
            {m.groups_import()}
          </Button>
        </div>
        <ExportButtons dates={dates} profile={active} share={share} catalog={catalog} />
      </CardContent>

      <ProfileNameDialog
        open={renaming}
        mode="rename"
        initial={active?.name ?? ""}
        taken={(name) => nameTaken(profiles, name, activeName)}
        onOpenChange={setRenaming}
        onSubmit={(name) => onRename(activeName, name)}
      />

      <ProfileNameDialog
        open={duplicating}
        mode="duplicate"
        initial={active ? duplicateName(profiles, active) : ""}
        taken={(name) => nameTaken(profiles, name)}
        onOpenChange={setDuplicating}
        onSubmit={onDuplicate}
      />

      <AlertDialog open={removing} onOpenChange={setRemoving}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.profile_delete_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.profile_delete_text({ name: active?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onRemove(activeName);
                setRemoving(false);
              }}
            >
              {m.profile_delete_confirm()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}
