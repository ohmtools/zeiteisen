import { Download } from "lucide-react";
import { toast } from "@/lib/ohmtools/toast";
import { m } from "@/i18n";
import { Popup } from "@/components/ohmtools/popup";
import { Button } from "@/components/ui/button";
import type { Catalog } from "@/lib/primitives/catalog";
import { timetablesOutsideCatalog, type Profile } from "@/lib/primitives/profile";
import { downloadTimetable } from "@/lib/download";

type Props = {
  open: boolean;
  // Lists the profile's timetables the catalog does not.
  profile: Profile;
  catalog: Catalog;
  onOpenChange: (open: boolean) => void;
  onCopy: () => void;
};

// The link carries hashes only, so a timetable the catalog cannot hand out
// reaches the receiver only if they already hold it. Asked before copying,
// with each file to send along; copying anyway stays possible.
export function ShareWarningDialog({ open, profile, catalog, onOpenChange, onCopy }: Props) {
  return (
    <Popup
      kind="question"
      open={open}
      onOpenChange={onOpenChange}
      title={m.share_warning_title()}
      description={m.share_warning_description()}
      action={m.share_warning_copy()}
      onAction={() => {
        onCopy();
        onOpenChange(false);
      }}
      cancel={m.cancel()}
    >
      <OutsideList profile={profile} catalog={catalog} />
    </Popup>
  );
}

// Its own component inside the popup, which renders only while the dialog
// shows: the list hashes every timetable of the profile, and follows a
// catalog refresh or an edit while open.
function OutsideList({ profile, catalog }: { profile: Profile; catalog: Catalog }) {
  return (
    <ul className="relative flex max-h-[18rem] flex-col gap-2 overflow-y-auto pr-2 text-sm">
      {timetablesOutsideCatalog(profile, catalog).map((timetable) => (
        <li key={timetable.name} className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate">{timetable.name}</span>
          <Button
            variant="secondary"
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
  );
}
