import { useRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Download,
  Eraser,
  Globe,
  GraduationCap,
  MapPin,
  Sparkles,
  Trash2,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { m } from "@/i18n";
import { Popup } from "@/components/ohmtools/popup";
import {
  CatalogUrlDialog,
  DegreeNamesDialog,
  DeleteDataDialog,
  OwnDegreesDialog,
} from "@/components/DataDialogs";
import { SkillDialog } from "@/components/SkillDialog";
import { Button } from "@/components/ui/button";
import { DEGREE_EXTENSION, type CatalogMode } from "@/lib/primitives/catalog";
import type { Backup, OwnDegreeFile } from "@/lib/primitives/storage";
import { downloadBackup, readBackupFile, restoreBackup } from "@/lib/backup";
import { toast } from "@/lib/ohmtools/toast";

// What App hands the settings panel.
export type DataProps = {
  catalogMode: CatalogMode;
  onCatalogMode: (mode: CatalogMode) => void;
  // The user's catalog URL, `null` = `defaultCatalogUrl`.
  catalogUrl: string | null;
  defaultCatalogUrl: string;
  onCatalogUrl: (url: string | null) => void;
  datesManual: boolean;
  onUploadDates: (file: File) => void;
  onCatalogDates: () => void;
  ownLocations: boolean;
  onUploadLocations: (file: File) => void;
  onCatalogLocations: () => void;
  // The own degree files, in upload order.
  ownDegrees: OwnDegreeFile[];
  // The names of the catalog's degree files: an own file of such a name
  // replaces it.
  catalogDegrees: readonly string[];
  // Reads and checks picked files, each under its file name without
  // `.degree`; `onAddDegrees` stores them under the names the user gave.
  onReadDegrees: (files: File[]) => Promise<OwnDegreeFile[]>;
  onAddDegrees: (files: OwnDegreeFile[]) => void;
  onRemoveDegrees: (names: string[]) => void;
  // How many profiles a restore would replace.
  profileCount: number;
};

// One row of the settings. The note is the muted trailing text: what is in
// use right now.
export type DataAction = {
  key: string;
  icon: LucideIcon;
  label: string;
  note?: string;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: () => void;
};

export const CATALOG_MODES: readonly CatalogMode[] = ["ignore", "auto", "freeze"];

// The mode as a choice of its own.
export const MODE_OPTION: Record<CatalogMode, () => string> = {
  ignore: m.catalog_mode_ignore_option,
  auto: m.catalog_mode_auto_option,
  freeze: m.catalog_mode_freeze_option,
};

export const MODE_TEXT: Record<CatalogMode, () => string> = {
  ignore: m.catalog_mode_ignore_text,
  auto: m.catalog_mode_auto_text,
  freeze: m.catalog_mode_freeze_text,
};

// Everything the settings do besides showing the catalog mode: own files,
// catalog URL and backup as actions, and the hidden file inputs and dialogs
// behind them (`elements`, rendered once beside the rows).
export function useDataControls({
  catalogMode,
  catalogUrl,
  defaultCatalogUrl,
  onCatalogUrl,
  datesManual,
  onUploadDates,
  onCatalogDates,
  ownLocations,
  onUploadLocations,
  onCatalogLocations,
  ownDegrees,
  catalogDegrees,
  onReadDegrees,
  onAddDegrees,
  onRemoveDegrees,
  profileCount,
}: DataProps): {
  own: DataAction[];
  // Shown while any own file is in use.
  ownHint: string | null;
  // The AI skill, below the own files.
  skill: DataAction;
  catalogUrl: DataAction;
  backup: DataAction[];
  // "Delete data…", apart from the backup.
  erase: DataAction;
  // Own files in use: dates, locations, degree programs.
  ownCount: number;
  elements: ReactNode;
} {
  // One file input for every own file; `picking` says which kind it is for
  // (degree files take several at once).
  const ownInput = useRef<HTMLInputElement>(null);
  const picking = useRef<(files: File[]) => void>(() => {});
  const pickOwn = (onFiles: (files: File[]) => void, degrees = false) => {
    const input = ownInput.current;
    if (!input) return;
    picking.current = onFiles;
    input.multiple = degrees;
    input.accept = degrees ? DEGREE_EXTENSION : "application/json,.json";
    input.click();
  };
  const pickOne = (onFile: (file: File) => void) => pickOwn(([file]) => onFile(file));
  const [editingUrl, setEditingUrl] = useState(false);
  const [removingDegrees, setRemovingDegrees] = useState(false);
  // Files read and checked, waiting for their names.
  const [placing, setPlacing] = useState<OwnDegreeFile[]>([]);
  const pickDegrees = async (files: File[]) => {
    const read = await onReadDegrees(files);
    if (read.length > 0) setPlacing(read);
  };
  const [skillOpen, setSkillOpen] = useState(false);
  const ownCount = ownDegrees.length;
  // The last file removed closes the dialog for good, not until the next
  // upload.
  if (removingDegrees && ownCount === 0) setRemovingDegrees(false);
  const ignored = catalogMode === "ignore";
  const anyOwn = datesManual || ownLocations || ownCount > 0;
  const backupInput = useRef<HTMLInputElement>(null);
  // A backup read and checked, waiting for the user's confirmation.
  const [restoring, setRestoring] = useState<Backup | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pickBackup = async (file: File) => {
    const backup = await readBackupFile(file);
    if (backup) setRestoring(backup);
    else toast.error(m.backup_error());
  };

  const own: DataAction[] = [
    // The catalog installs these by itself; each action is the way out of
    // that with an own file, and back in. Nothing to go back to while the
    // catalog is ignored.
    {
      key: "dates",
      icon: CalendarDays,
      ...ownState(datesManual, ignored, m.dates_manual(), m.dates_catalog_again()),
      onSelect: datesManual ? onCatalogDates : () => pickOne(onUploadDates),
    },
    {
      key: "locations",
      icon: MapPin,
      ...ownState(ownLocations, ignored, m.locations_manual(), m.locations_catalog_again()),
      onSelect: ownLocations ? onCatalogLocations : () => pickOne(onUploadLocations),
    },
    // An own degree file replaces only the catalog file of the name the user
    // gives it, so there is always room for one more file.
    {
      key: "degrees",
      icon: GraduationCap,
      label: ownCount > 0 ? m.degrees_add() : m.degrees_manual(),
      note:
        ownCount === 0
          ? undefined
          : ownCount === 1
            ? m.data_own_file()
            : m.data_own_files({ count: ownCount }),
      onSelect: () => pickOwn((files) => void pickDegrees(files), true),
    },
    ...(ownCount > 0
      ? [
          {
            key: "degrees-manage",
            icon: Trash2,
            label: m.degrees_manage(),
            onSelect: () => setRemovingDegrees(true),
          },
        ]
      : []),
  ];
  // Always there, even with the catalog ignored: the way to own files when
  // there is none yet.
  const skill: DataAction = {
    key: "skill",
    icon: Sparkles,
    label: m.skill_menu(),
    onSelect: () => setSkillOpen(true),
  };

  const backup: DataAction[] = [
    { key: "save", icon: Download, label: m.backup_save(), onSelect: () => downloadBackup() },
    {
      key: "load",
      icon: Upload,
      label: m.backup_load(),
      onSelect: () => backupInput.current?.click(),
    },
  ];
  const erase: DataAction = {
    key: "delete",
    icon: Eraser,
    label: m.data_delete(),
    destructive: true,
    onSelect: () => setDeleting(true),
  };

  const elements = (
    <>
      <input
        ref={ownInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (files.length > 0) picking.current(files);
        }}
      />
      <input
        ref={backupInput}
        type="file"
        accept=".backup"
        className="hidden"
        onChange={(event) => {
          const [file] = event.target.files ?? [];
          event.target.value = "";
          if (file) void pickBackup(file);
        }}
      />

      <DegreeNamesDialog
        files={placing}
        held={ownDegrees}
        catalog={catalogDegrees}
        onClose={() => setPlacing([])}
        onAdd={onAddDegrees}
      />

      <OwnDegreesDialog
        open={removingDegrees}
        onOpenChange={setRemovingDegrees}
        files={ownDegrees}
        onRemove={onRemoveDegrees}
      />

      <SkillDialog open={skillOpen} onOpenChange={setSkillOpen} />

      <CatalogUrlDialog
        open={editingUrl}
        onOpenChange={setEditingUrl}
        url={catalogUrl}
        defaultUrl={defaultCatalogUrl}
        onSave={onCatalogUrl}
      />

      <Popup
        kind="question"
        open={restoring !== null}
        onOpenChange={(open) => {
          if (!open) setRestoring(null);
        }}
        title={m.backup_restore_title()}
        description={m.backup_restore_text({
          current: profileCount,
          count: restoring?.profiles.length ?? 0,
        })}
        action={m.backup_restore_confirm()}
        destructive
        onAction={() => {
          if (restoring && !restoreBackup(restoring)) toast.error(m.upload_error_storage());
          setRestoring(null);
        }}
        cancel={m.cancel()}
      >
        {/* The way back, should the backup turn out to be the wrong one. */}
        <Button variant="secondary" onClick={() => downloadBackup()}>
          <Download data-icon="inline-start" />
          {m.backup_save_first()}
        </Button>
      </Popup>

      <DeleteDataDialog open={deleting} onOpenChange={setDeleting} />
    </>
  );

  return {
    own,
    ownHint: anyOwn ? m.data_own_hint() : null,
    catalogUrl: {
      key: "catalog-url",
      icon: Globe,
      label: m.catalog_url(),
      note: catalogUrl !== null ? m.catalog_url_custom() : undefined,
      onSelect: () => setEditingUrl(true),
    },
    skill,
    backup,
    erase,
    ownCount: (datesManual ? 1 : 0) + (ownLocations ? 1 : 0) + ownCount,
    elements,
  };
}

// One kind of catalog data: loads an own file while the catalog's is in use,
// hands the kind back to the catalog while an own file is (not while the
// catalog is ignored: there is nothing to go back to). The trailing note marks
// an own file in use.
function ownState(
  own: boolean,
  ignored: boolean,
  load: string,
  back: string,
): Pick<DataAction, "label" | "note" | "disabled"> {
  return {
    label: own ? back : load,
    note: own ? m.data_own_file() : undefined,
    disabled: own && ignored,
  };
}
