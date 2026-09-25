import { Download } from "lucide-react";
import { toast } from "@/lib/toast";
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
import type { Timetable } from "@/lib/primitives/timetable";
import { downloadTimetable } from "@/lib/download";

type Props = {
  open: boolean;
  // The timetables the catalog does not list (`timetablesOutsideCatalog`).
  timetables: Timetable[];
  onOpenChange: (open: boolean) => void;
  onCopy: () => void;
};

// The link carries hashes only, so a timetable the catalog cannot hand out
// reaches the receiver only if they already hold it. Asked before copying,
// with each file to send along; copying anyway stays possible.
export function ShareWarningDialog({ open, timetables, onOpenChange, onCopy }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.share_warning_title()}</AlertDialogTitle>
          <AlertDialogDescription>{m.share_warning_description()}</AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="flex max-h-[18rem] flex-col gap-2 overflow-y-auto pr-2 text-sm">
          {timetables.map((timetable) => (
            <li key={timetable.name} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">{timetable.name}</span>
              <Button
                variant="outline"
                size="xs"
                title={m.share_warning_download({ name: timetable.name })}
                onClick={() => {
                  downloadTimetable(timetable);
                  toast.success(m.toast_timetable_saved());
                }}
              >
                <Download data-icon="inline-start" />
                .timetable
              </Button>
            </li>
          ))}
        </ul>

        <AlertDialogFooter>
          <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onCopy();
              onOpenChange(false);
            }}
          >
            {m.share_warning_copy()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
