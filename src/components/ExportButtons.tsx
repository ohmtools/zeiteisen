import { lazy, Suspense, useState } from "react";
import { Check, Download, Link2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { m } from "@/i18n";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { CardDescription } from "@/components/ui/card";
import { ShareWarningDialog } from "@/components/ShareWarningDialog";
import { useCopied, type ShareLink } from "@/hooks/useShareLink";
import type { Catalog } from "@/lib/primitives/catalog";
import type { SemesterDates } from "@/lib/primitives/meta";
import { lectureRange, type DateRange } from "@/lib/primitives/occurrence";
import { timetablesOutsideCatalog, type Profile } from "@/lib/primitives/profile";
import { downloadText, safeFilename } from "@/lib/download";
import { profileFileText } from "@/lib/share";

// `ics` and the date picker are only needed once the user exports, and the
// dialog only when no dates file fixes the range. Both stay out of the first
// load; the service worker precaches the chunk like every other, so an
// offline export still works.
const ExportDialog = lazy(() =>
  import("@/components/ExportDialog").then((module) => ({ default: module.ExportDialog })),
);

type Props = {
  // The lecture period the ICS export runs over; without it the export dialog
  // asks for a range.
  dates: SemesterDates | null;
  profile: Profile | undefined;
  share: ShareLink | null;
  // Decides which timetables a link cannot bring along.
  catalog: Catalog;
};

function downloadProfile(profile: Profile) {
  downloadText(`${safeFilename(profile.name)}.profile`, profileFileText(profile));
  toast.success(m.toast_json_saved());
}

// One .ics for the whole profile, expanded to single VEVENTs. The enabled
// subjects decide what goes in.
async function downloadIcs(profile: Profile, dates: SemesterDates | null, range: DateRange) {
  const { icsFile } = await import("@/lib/ics");
  const { file, error } = icsFile(profile.timetables, dates, range, profile.name);
  if (error !== null) {
    toast.error(m.toast_ics_failed());
    return;
  }
  if (!file) {
    toast.error(m.toast_ics_empty());
    return;
  }
  downloadText(file.filename, file.text, "text/calendar");
  toast.success(m.toast_ics_saved({ count: file.count }));
}

// Everything that takes the profile off this device: calendar, share link and
// profile file. They export the profile, so they live in `ProfileSection`.
export function ExportButtons({ dates, profile, share, catalog }: Props) {
  const [copied, copy] = useCopied();
  // Past the guard a link is no longer worth copying, so the button turns off
  // and the profile file download takes over.
  const linkBlocked = !share || share.tooLong;
  // Timetables the receiver of a link cannot get from the catalog: copying
  // asks first and offers their files.
  const outside = profile ? timetablesOutsideCatalog(profile, catalog) : [];
  const [warning, setWarning] = useState(false);
  // Only opened when no dates file is loaded: with one, the lecture period is
  // the range and the download starts right away.
  const [exporting, setExporting] = useState(false);
  // Stays true once the dialog has been loaded, so closing it keeps the
  // chunk mounted and the close animation runs.
  const [exportLoaded, setExportLoaded] = useState(false);

  // The generator arrives over the network on the first export of a fresh
  // install; a failed chunk load is reported like a failed export.
  const runExport = (range: DateRange) => {
    if (!profile) return;
    return downloadIcs(profile, dates, range).catch(() => toast.error(m.toast_ics_failed()));
  };

  // With dates the lecture period is the range and the download starts right
  // away; without, the dialog asks.
  const startExport = async () => {
    const range = lectureRange(dates);
    if (range) await runExport(range);
    else {
      setExportLoaded(true);
      setExporting(true);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <ButtonGroup aria-label={m.groups_export()} className="w-full">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 px-2"
          disabled={!profile}
          title={m.groups_export_ics()}
          onClick={() => void startExport().catch(() => toast.error(m.toast_ics_failed()))}
        >
          <Download data-icon="inline-start" />
          ics
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 px-2"
          disabled={linkBlocked}
          title={linkBlocked ? m.groups_export_link_long() : m.groups_export_link_hint()}
          onClick={() => {
            if (!share) return;
            if (outside.length > 0) setWarning(true);
            else copy(share.url);
          }}
        >
          {copied ? <Check data-icon="inline-start" /> : <Link2 data-icon="inline-start" />}
          {copied ? m.groups_export_copied() : m.groups_export_link()}
        </Button>
        <Button
          // The fallback when the link is too long, so it stands out then.
          variant={share?.tooLong ? "default" : "outline"}
          size="sm"
          className="flex-1 px-2"
          disabled={!profile}
          title={m.groups_export_json()}
          onClick={() => profile && downloadProfile(profile)}
        >
          <Download data-icon="inline-start" />
          .profile
        </Button>
      </ButtonGroup>
      {share?.tooLong && <CardDescription>{m.groups_export_link_long()}</CardDescription>}
      <ShareWarningDialog
        open={warning}
        timetables={outside}
        onOpenChange={setWarning}
        onCopy={() => share && copy(share.url)}
      />
      {exportLoaded && (
        <Suspense fallback={null}>
          <ExportDialog open={exporting} onOpenChange={setExporting} onExport={runExport} />
        </Suspense>
      )}
    </div>
  );
}
