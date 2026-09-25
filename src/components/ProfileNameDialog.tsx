import { useState } from "react";
import { m } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  // Rename the active profile, or name its duplicate.
  mode: "rename" | "duplicate";
  initial: string;
  // Whether another profile already goes by that name; names are unique.
  taken: (name: string) => boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
};

// Renaming or duplicating a profile: one field, one name. Creating a profile
// goes through `TimetablePickerDialog` instead, because a new profile picks its
// timetables in the same step.
export function ProfileNameDialog({ open, mode, initial, taken, onOpenChange, onSubmit }: Props) {
  const [name, setName] = useState(initial);
  // Every opening starts from the suggested name: another profile's, or the
  // next free one for a duplicate.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setName(initial);
  }

  const clash = taken(name.trim());
  const invalid = !name.trim() || clash;

  const submit = () => {
    if (invalid) return;
    onSubmit(name.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "rename" ? m.profile_rename() : m.profile_duplicate_title()}
          </DialogTitle>
          <DialogDescription>
            {mode === "rename" ? m.profile_rename_text() : m.profile_duplicate_text()}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-name">{m.profile_name()}</Label>
          <Input
            id="profile-name"
            value={name}
            autoFocus
            aria-invalid={clash || undefined}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
          {clash && <p className="text-sm text-destructive">{m.profile_name_taken()}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {m.cancel()}
          </Button>
          <Button disabled={invalid} onClick={submit}>
            {mode === "rename" ? m.profile_save() : m.profile_duplicate_confirm()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
