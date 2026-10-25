import { m } from "@/i18n";
import { ImportDialog } from "@/components/ImportDialog";
import { SubjectEditor, type EditRequest } from "@/components/SubjectEditor";
import { TimetablePickerDialog } from "@/components/TimetablePickerDialog";
import { UpdateDialog } from "@/components/UpdateDialog";
import type { useProfiles } from "@/hooks/useProfiles";
import type { Catalog } from "@/lib/primitives/catalog";
import { timetableByName } from "@/lib/primitives/profile";
import type { SharedTimetable, TimetableName } from "@/lib/primitives/timetable";
import { toast } from "@/lib/ohmtools/toast";

// App's dialogs, lazy with the panels (`components/deferred`). Which one is
// open stays in App: a share link opened directly sets `importing` on the
// first render, and the dialog shows once this chunk has arrived. The subject
// editor sits here because both the tree and a block's details open it.
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
  editing,
  onEditingChange,
  onAddEmpty,
  onRefreshCatalog,
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
  editing: EditRequest | null;
  onEditingChange: (editing: EditRequest | null) => void;
  onAddEmpty: () => TimetableName | null;
  onRefreshCatalog: () => void;
}) {
  return (
    <>
      <SubjectEditor
        request={editing}
        timetables={profiles.timetables}
        library={profiles.profiles.flatMap((profile) => profile.timetables)}
        profileName={profiles.activeName}
        locked={profiles.locked}
        onClose={() => onEditingChange(null)}
        onSave={profiles.editSubjects}
        onAddEmpty={onAddEmpty}
      />

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
        onRetry={onRefreshCatalog}
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

      {/* Outside the panels: a fresh device opening a share link has nothing
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
