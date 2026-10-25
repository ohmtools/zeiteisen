import { lazy, Suspense, useState } from "react";
import { CalendarDays, Check, FileDown, Link2 } from "lucide-react";
import { toast } from "@/lib/ohmtools/toast";
import { m } from "@/i18n";
import { Button } from "@/components/ui/button";
import { ShareWarningDialog } from "@/components/ShareWarningDialog";
import { shareLinkOf, useCopied } from "@/hooks/useShareLink";
import type { Catalog } from "@/lib/primitives/catalog";
import type { SemesterDates } from "@/lib/primitives/meta";
import { lectureRange, type DateRange } from "@/lib/primitives/occurrence";
import { timetablesOutsideCatalog, type Profile } from "@/lib/primitives/profile";
import { downloadText, safeFilename } from "@/lib/download";
import { profileFileText } from "@/lib/share";
import { subjectLabel } from "@/lib/subjects";
import { limit } from "@/lib/upload";

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
  // Decides which timetables a link cannot bring along.
  catalog: Catalog;
};

function downloadProfile(profile: Profile) {
  downloadText(`${safeFilename(profile.name)}.profile`, profileFileText(profile));
  toast.success(m.toast_json_saved());
}

// One .ics for the whole profile, expanded to single VEVENTs. The enabled
// subjects decide what goes in. `lecture`: the range is the lecture period,
// stretched to the listed dates outside it (`lectureExportRange`); a range the
// user picked is taken as it is. Classes no date can be given are named.
async function downloadIcs(
  profile: Profile,
  dates: SemesterDates | null,
  range: DateRange,
  lecture: boolean,
) {
  const { icsFile, lectureExportRange, undatedClasses } = await import("@/lib/ics");
  const span = lecture ? lectureExportRange(profile.timetables, range) : range;
  const { file, error } = icsFile(profile.timetables, dates, span, profile.name);
  if (error !== null) {
    toast.error(m.toast_ics_failed());
    return;
  }
  if (file) {
    downloadText(file.filename, file.text, "text/calendar");
    toast.success(m.toast_ics_saved({ count: file.count }));
  } else {
    toast.error(m.toast_ics_empty());
  }
  const undated = [...new Set(undatedClasses(profile.timetables).map(subjectLabel))];
  if (undated.length > 0) {
    toast.warning(m.toast_ics_undated({ count: undated.length }), {
      description: m.toast_ics_undated_hint({ classes: limit(undated).join(", ") }),
    });
  }
}

// Everything that takes the profile off this device: calendar, share link and
// profile file. They export the profile, so they live in its menu
// (`ProfileMenu`), never in the header (user decision): up there they would
// imply global state like the dates, which never leave the device.
export function ExportButtons({ dates, profile, catalog }: Props) {
  const [copied, copy] = useCopied();
  // Built here, after the first paint, not in App: it hashes every timetable
  // of the profile. The global dates never go in it.
  const share = shareLinkOf(profile);
  // Past the guard a link is no longer worth copying, so the button turns off
  // and the profile file download takes over.
  const linkBlocked = !share || share.tooLong;
  const [warning, setWarning] = useState(false);
  // Only opened when no dates file is loaded: with one, the lecture period is
  // the range and the download starts right away.
  const [exporting, setExporting] = useState(false);
  // Stays true once the dialog has been loaded, so closing it keeps the
  // chunk mounted and the close animation runs.
  const [exportLoaded, setExportLoaded] = useState(false);

  // The generator arrives over the network on the first export of a fresh
  // install; a failed chunk load is reported like a failed export.
  const runExport = (range: DateRange, lecture = false) => {
    if (!profile) return;
    return downloadIcs(profile, dates, range, lecture).catch(() =>
      toast.error(m.toast_ics_failed()),
    );
  };

  // With dates the lecture period is the range and the download starts right
  // away; without, the dialog asks.
  const startExport = async () => {
    const range = lectureRange(dates);
    if (range) await runExport(range, true);
    else {
      setExportLoaded(true);
      setExporting(true);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div aria-label={m.groups_export()} role="group" className="grid grid-cols-3 gap-2">
        <Button
          variant="secondary"
          className="min-w-0 px-2"
          disabled={!profile}
          title={m.groups_export_ics()}
          onClick={() => void startExport().catch(() => toast.error(m.toast_ics_failed()))}
        >
          <CalendarDays data-icon="inline-start" />
          <span className="font-mono text-xs">.ics</span>
        </Button>
        <Button
          variant="secondary"
          className="min-w-0 px-2"
          disabled={linkBlocked}
          title={share?.tooLong ? m.groups_export_link_long() : m.groups_export_link_hint()}
          onClick={() => {
            if (!share || !profile) return;
            // Timetables the receiver cannot get from the catalog: copying
            // asks first and offers their files. Decided on the click, not
            // on every render: it hashes every timetable of the profile.
            if (timetablesOutsideCatalog(profile, catalog).length > 0) setWarning(true);
            else copy(share.url);
          }}
        >
          {copied ? <Check data-icon="inline-start" /> : <Link2 data-icon="inline-start" />}
          {copied ? m.groups_export_copied() : m.groups_export_link()}
        </Button>
        <Button
          // The fallback when the link is too long, so it stands out then.
          variant={share?.tooLong ? "default" : "secondary"}
          className="min-w-0 px-2"
          disabled={!profile}
          title={m.groups_export_json()}
          onClick={() => profile && downloadProfile(profile)}
        >
          <FileDown data-icon="inline-start" />
          <span className="font-mono text-xs">.profile</span>
        </Button>
      </div>
      {share?.tooLong && (
        <p className="text-xs text-muted-foreground">{m.groups_export_link_long()}</p>
      )}
      {profile && (
        <ShareWarningDialog
          open={warning}
          profile={profile}
          catalog={catalog}
          onOpenChange={setWarning}
          onCopy={() => share && copy(share.url)}
        />
      )}
      {exportLoaded && (
        <Suspense fallback={null}>
          <ExportDialog open={exporting} onOpenChange={setExporting} onExport={runExport} />
        </Suspense>
      )}
    </div>
  );
}
