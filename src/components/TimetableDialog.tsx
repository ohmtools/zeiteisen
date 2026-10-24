import { useState } from "react";
import { Trash2 } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nameProblemText } from "@/lib/names";
import { normalizeName, sameName } from "@/lib/primitives/name";
import type { TimetableName } from "@/lib/primitives/timetable";

// A timetable's pen: its name, and "Remove timetable…" (asked first: removal
// cannot be undone, the profile's copy and its pick go).
export function TimetableDialog({
  name,
  taken,
  locked,
  onClose,
  onRename,
  onRemove,
}: {
  // The timetable it is about; `null` = closed.
  name: TimetableName | null;
  // Whether another timetable of the profile already goes by that name.
  taken: (name: string) => boolean;
  locked: boolean;
  onClose: () => void;
  onRename: (to: string) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(name ?? "");
  const [removing, setRemoving] = useState(false);
  // Every opening starts from the timetable's name.
  const [shown, setShown] = useState(name);
  if (shown !== name) {
    setShown(name);
    if (name !== null) setDraft(name);
  }
  const wanted = normalizeName(draft);
  const problem = !wanted
    ? m.tree_rename_empty()
    : name !== null && !sameName(wanted, name) && taken(wanted)
      ? m.tree_rename_taken()
      : nameProblemText(wanted);
  const save = () => {
    if (problem) return;
    if (name !== null && wanted !== name) onRename(wanted);
    onClose();
  };

  return (
    <>
      <Dialog
        open={name !== null && !locked && !removing}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.timetable_manage_title()}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="timetable-name">{m.profile_name()}</Label>
            <Input
              id="timetable-name"
              value={draft}
              autoFocus
              aria-invalid={problem !== null || undefined}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") save();
              }}
            />
            {problem && <p className="text-sm text-destructive">{problem}</p>}
          </div>
          <Button
            variant="ghost"
            className="-ml-2.5 justify-self-start px-2.5 text-destructive"
            onClick={() => setRemoving(true)}
          >
            <Trash2 data-icon="inline-start" />
            {m.timetable_remove()}
          </Button>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>
              {m.cancel()}
            </Button>
            <Button disabled={problem !== null} onClick={save}>
              {m.profile_save()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={removing && name !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.tree_remove_title({ name: name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.tree_remove_text({ name: name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onRemove();
                setRemoving(false);
                onClose();
              }}
            >
              {m.tree_remove_confirm()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
