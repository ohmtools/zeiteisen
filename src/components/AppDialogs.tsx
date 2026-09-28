import { m } from "@/i18n";
import { ImportDialog } from "@/components/ImportDialog";
import { TimetablePickerDialog } from "@/components/TimetablePickerDialog";
import { UpdateDialog } from "@/components/UpdateDialog";
import type { useProfiles } from "@/hooks/useProfiles";
import type { Catalog } from "@/lib/primitives/catalog";
import { timetableByName } from "@/lib/primitives/profile";
import type { SharedTimetable, TimetableName } from "@/lib/primitives/timetable";
import { toast } from "@/lib/toast";

// App's three dialogs, lazy with the sidebar (`components/deferred`). Which
// one is open stays in App: a share link opened directly sets `importing` on
// the first render, and the dialog shows once this chunk has arrived.
export function AppDialogs({
  profiles,
  catalog,
  online,
  picking,
  onPickingChange,
  updating,
  onUpdatingChange,
  importing,
  onImportingChange,
  linkPayload,
  onLinkPayloadChange,
}: {
  profiles: ReturnType<typeof useProfiles>;
  // Already `Catalog.empty` while offline.
  catalog: Catalog;
  online: boolean;
  picking: "new-profile" | "add" | null;
  onPickingChange: (picking: "new-profile" | "add" | null) => void;
  updating: TimetableName | null;
  onUpdatingChange: (updating: TimetableName | null) => void;
  importing: boolean;
  onImportingChange: (importing: boolean) => void;
  linkPayload: SharedTimetable[] | null;
  onLinkPayloadChange: (payload: SharedTimetable[] | null) => void;
}) {
  return (
    <>
      <TimetablePickerDialog
        open={picking !== null}
        mode={picking ?? "add"}
        onOpenChange={(open) => {
          if (!open) onPickingChange(null);
        }}
        profiles={profiles.profiles}
        catalog={catalog}
        offline={!online}
        target={picking === "add" ? profiles.active : undefined}
        onConfirm={(name, sources) => {
          // A profile and its timetables are created in one state change.
          const added =
            picking === "new-profile"
              ? profiles.addProfile(name, sources)
              : profiles.addTimetables(sources);
          if (added && sources.length > 0) {
            toast.success(m.picker_added({ count: sources.length }));
          }
          return added;
        }}
      />

      <UpdateDialog
        timetable={updating === null ? null : (timetableByName(profiles.active, updating) ?? null)}
        catalog={catalog}
        locked={profiles.locked}
        onOpenChange={(open) => {
          if (!open) onUpdatingChange(null);
        }}
        onReplace={profiles.replaceTimetable}
      />

      {/* Outside the sidebar: a fresh device opening a share link has nothing
          in the tree yet, while this still has to show. */}
      <ImportDialog
        open={importing}
        onOpenChange={(open) => {
          onImportingChange(open);
          if (!open) onLinkPayloadChange(null);
        }}
        profiles={profiles.profiles}
        catalog={catalog}
        offline={!online}
        initial={linkPayload}
        onImport={(profile, unresolved) => {
          if (!profiles.addProfileObject(profile)) return false;
          onLinkPayloadChange(null);
          toast.success(m.toast_imported({ name: profile.name }));
          if (unresolved > 0) toast.warning(m.import_unresolved({ count: unresolved }));
          return true;
        }}
      />
    </>
  );
}
