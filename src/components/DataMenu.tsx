import { useRef, useState, type ReactElement, type ReactNode } from "react";
import {
  BookA,
  BookX,
  Trash2,
  CalendarDays,
  CircleOff,
  Download,
  Globe,
  Languages,
  MapPin,
  RefreshCw,
  Snowflake,
  Sparkles,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { getLocale, locales, m, setLocale } from "@/i18n";
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
import { Brand } from "@/components/Brand";
import { SkillDialog } from "@/components/SkillDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CatalogMode } from "@/lib/primitives/catalog";
import type { Backup, OwnAbbreviationsFile } from "@/lib/primitives/storage";
import { downloadBackup, readBackupFile, restoreBackup } from "@/lib/backup";
import { toast } from "@/lib/toast";

type Props = {
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
  // The own abbreviations files, in upload order (later ones win).
  ownAbbreviations: OwnAbbreviationsFile[];
  onUploadAbbreviations: (files: File[]) => void;
  onRemoveAbbreviations: (names: string[]) => void;
  // How many profiles a restore would replace.
  profileCount: number;
};

type TriggerProps = {
  // The trigger's element (`render`) and its content.
  trigger: ReactElement;
  children: ReactNode;
  // The phone's settings menu: opens upwards out of the tab bar and also
  // carries what the desktop footer shows beside the menu (language, note).
  settings?: boolean;
};

// The footer's "Data" menu, and on phones the tab bar's settings menu:
// everything about the data on this device that is no profile's business.
// Where dates, locations and abbreviations come from (the catalog or the
// user's own files), how the catalog is used and where it is read from, and
// the backup of it all. Lives in the deferred chunk; App shows a disabled look-alike
// trigger until it arrives.
export function DataMenu({
  catalogMode,
  onCatalogMode,
  catalogUrl,
  defaultCatalogUrl,
  onCatalogUrl,
  datesManual,
  onUploadDates,
  onCatalogDates,
  ownLocations,
  onUploadLocations,
  onCatalogLocations,
  ownAbbreviations,
  onUploadAbbreviations,
  onRemoveAbbreviations,
  profileCount,
  trigger,
  children,
  settings = false,
}: Props & TriggerProps) {
  // One file input for every own file; `picking` says which kind it is for
  // (abbreviations take several files at once). It sits outside the menu,
  // which unmounts its content on closing.
  const ownInput = useRef<HTMLInputElement>(null);
  const picking = useRef<(files: File[]) => void>(() => {});
  const pickOwn = (onFiles: (files: File[]) => void, multiple = false) => {
    const input = ownInput.current;
    if (!input) return;
    picking.current = onFiles;
    input.multiple = multiple;
    input.click();
  };
  const pickOne = (onFile: (file: File) => void) => pickOwn(([file]) => onFile(file));
  const [editingUrl, setEditingUrl] = useState(false);
  const [removingAbbreviations, setRemovingAbbreviations] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  const ownCount = ownAbbreviations.length;
  // The last file removed closes the dialog for good, not until the next
  // upload.
  if (removingAbbreviations && ownCount === 0) setRemovingAbbreviations(false);
  const ignored = catalogMode === "ignore";
  const anyOwn = datesManual || ownLocations || ownCount > 0;
  const backupInput = useRef<HTMLInputElement>(null);
  // A backup read and checked, waiting for the user's confirmation.
  const [restoring, setRestoring] = useState<Backup | null>(null);

  const pickBackup = async (file: File) => {
    const backup = await readBackupFile(file);
    if (backup) setRestoring(backup);
    else toast.error(m.backup_error());
  };

  return (
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
      <DropdownMenu>
        <DropdownMenuTrigger render={trigger}>{children}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" side={settings ? "top" : "bottom"} className="w-auto">
          <DropdownMenuGroup>
            {/* The catalog installs these by itself; each item is the way out
                of that with an own file, and back in. Nothing to go back to
                while the catalog is ignored. */}
            <OwnItem
              icon={CalendarDays}
              own={datesManual}
              load={m.dates_manual()}
              back={m.dates_catalog_again()}
              backDisabled={ignored}
              onLoad={() => pickOne(onUploadDates)}
              onBack={onCatalogDates}
            />
            <OwnItem
              icon={MapPin}
              own={ownLocations}
              load={m.locations_manual()}
              back={m.locations_catalog_again()}
              backDisabled={ignored}
              onLoad={() => pickOne(onUploadLocations)}
              onBack={onCatalogLocations}
            />
            {/* Own abbreviations merge over the catalog's, so there is always
                room for one more file. */}
            <DropdownMenuItem onClick={() => pickOwn(onUploadAbbreviations, true)}>
              <BookA data-icon="inline-start" />
              {ownCount > 0 ? m.abbreviations_add() : m.abbreviations_manual()}
              {ownCount > 0 && (
                <Note>
                  {ownCount === 1 ? m.data_own_file() : m.data_own_files({ count: ownCount })}
                </Note>
              )}
            </DropdownMenuItem>
            {ownCount > 0 && (
              <DropdownMenuItem onClick={() => setRemovingAbbreviations(true)}>
                <BookX data-icon="inline-start" />
                {m.abbreviations_manage()}
              </DropdownMenuItem>
            )}
            {/* Always there, even with the catalog ignored: the way to own
                files when there is none yet. */}
            <DropdownMenuItem onClick={() => setSkillOpen(true)}>
              <Sparkles data-icon="inline-start" />
              {m.skill_menu()}
            </DropdownMenuItem>
            {anyOwn && (
              <DropdownMenuLabel className="max-w-64 font-normal">
                {m.data_own_hint()}
              </DropdownMenuLabel>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {/* Cycles ignore → auto-update → freeze and stays open, so the
                line below explains each mode as it comes up. */}
            <DropdownMenuItem
              closeOnClick={false}
              onClick={() => onCatalogMode(NEXT_MODE[catalogMode])}
            >
              <ModeIcon mode={catalogMode} />
              {m.catalog_mode()}
              <Note>{MODE_NAME[catalogMode]()}</Note>
            </DropdownMenuItem>
            <DropdownMenuLabel className="max-w-64 font-normal">
              {MODE_TEXT[catalogMode]()}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setEditingUrl(true)}>
              <Globe data-icon="inline-start" />
              {m.catalog_url()}
              {catalogUrl !== null && <Note>{m.catalog_url_custom()}</Note>}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => downloadBackup()}>
              <Download data-icon="inline-start" />
              {m.backup_save()}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => backupInput.current?.click()}>
              <Upload data-icon="inline-start" />
              {m.backup_load()}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {settings && <SettingsExtras />}
        </DropdownMenuContent>
      </DropdownMenu>

      <OwnAbbreviationsDialog
        open={removingAbbreviations}
        onOpenChange={setRemovingAbbreviations}
        files={ownAbbreviations}
        onRemove={onRemoveAbbreviations}
      />

      <SkillDialog open={skillOpen} onOpenChange={setSkillOpen} />

      <CatalogUrlDialog
        open={editingUrl}
        onOpenChange={setEditingUrl}
        url={catalogUrl}
        defaultUrl={defaultCatalogUrl}
        onSave={onCatalogUrl}
      />

      <AlertDialog
        open={restoring !== null}
        onOpenChange={(open) => {
          if (!open) setRestoring(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.backup_restore_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.backup_restore_text({
                current: profileCount,
                count: restoring?.profiles.length ?? 0,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* The way back, should the backup turn out to be the wrong one. */}
          <Button
            variant="outline"
            className="sm:justify-self-start"
            onClick={() => downloadBackup()}
          >
            <Download data-icon="inline-start" />
            {m.backup_save_first()}
          </Button>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (restoring && !restoreBackup(restoring)) toast.error(m.upload_error_storage());
              }}
            >
              {m.backup_restore_confirm()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// The muted trailing note of a menu item: what is in use right now.
function Note({ children }: { children: ReactNode }) {
  return <span className="ml-auto pl-4 text-xs text-muted-foreground">{children}</span>;
}

// One kind of catalog data: loads an own file while the catalog's is in use,
// hands the kind back to the catalog while an own file is. The trailing note
// marks an own file in use.
function OwnItem({
  icon: Icon,
  own,
  load,
  back,
  backDisabled,
  onLoad,
  onBack,
}: {
  icon: LucideIcon;
  own: boolean;
  load: string;
  back: string;
  backDisabled: boolean;
  onLoad: () => void;
  onBack: () => void;
}) {
  return (
    <DropdownMenuItem disabled={own && backDisabled} onClick={own ? onBack : onLoad}>
      <Icon data-icon="inline-start" />
      {own ? back : load}
      {own && <Note>{m.data_own_file()}</Note>}
    </DropdownMenuItem>
  );
}

const NEXT_MODE: Record<CatalogMode, CatalogMode> = {
  ignore: "auto",
  auto: "freeze",
  freeze: "ignore",
};

const MODE_NAME: Record<CatalogMode, () => string> = {
  ignore: m.catalog_mode_ignore,
  auto: m.catalog_mode_auto,
  freeze: m.catalog_mode_freeze,
};

const MODE_TEXT: Record<CatalogMode, () => string> = {
  ignore: m.catalog_mode_ignore_text,
  auto: m.catalog_mode_auto_text,
  freeze: m.catalog_mode_freeze_text,
};

function ModeIcon({ mode }: { mode: CatalogMode }) {
  if (mode === "ignore") return <CircleOff data-icon="inline-start" />;
  if (mode === "freeze") return <Snowflake data-icon="inline-start" />;
  return <RefreshCw data-icon="inline-start" />;
}

// The own abbreviations files in the order they win (later over earlier),
// each removable on its own; the dialog closes once none is left. Removing is
// at once, no confirmation: the user still has the file.
function OwnAbbreviationsDialog({
  open,
  onOpenChange,
  files,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: OwnAbbreviationsFile[];
  onRemove: (names: string[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.abbreviations_manage_title()}</DialogTitle>
          <DialogDescription>{m.abbreviations_manage_text()}</DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-72 flex-col divide-y overflow-y-auto">
          {files.map((file) => (
            <li key={file.name} className="flex items-center gap-2 py-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {m.abbreviations_file_count({ count: file.data.subjects.length })}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                title={m.abbreviations_remove_file({ file: file.name })}
                aria-label={m.abbreviations_remove_file({ file: file.name })}
                onClick={() => onRemove([file.name])}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button
            variant="outline"
            className="sm:mr-auto"
            onClick={() => onRemove(files.map((file) => file.name))}
          >
            {m.abbreviations_remove_all()}
          </Button>
          <Button onClick={() => onOpenChange(false)}>{m.close()}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// An absolute http(s) URL, the only kind storage keeps.
function validUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Where the catalog is read from. Empty or "Use default" = the built-in one.
function CatalogUrlDialog({
  open,
  onOpenChange,
  url,
  defaultUrl,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  defaultUrl: string;
  onSave: (url: string | null) => void;
}) {
  const [value, setValue] = useState(url ?? "");
  // Every opening starts from the URL in use.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setValue(url ?? "");
  }

  const trimmed = value.trim();
  const invalid = trimmed !== "" && !validUrl(trimmed);

  const save = (next: string | null) => {
    if (next !== url) {
      onSave(next);
      toast.success(m.toast_catalog_url_saved());
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.catalog_url_title()}</DialogTitle>
          <DialogDescription>{m.catalog_url_text()}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="catalog-url">{m.catalog_url_label()}</Label>
          <Input
            id="catalog-url"
            type="url"
            value={value}
            autoFocus
            placeholder={new URL(defaultUrl, location.href).href}
            aria-invalid={invalid || undefined}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !invalid) save(trimmed || null);
            }}
          />
          {invalid && <p className="text-sm text-destructive">{m.catalog_url_invalid()}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="sm:mr-auto"
            disabled={url === null}
            onClick={() => save(null)}
          >
            {m.catalog_url_default()}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {m.cancel()}
          </Button>
          <Button disabled={invalid} onClick={() => save(trimmed || null)}>
            {m.catalog_url_save()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// The footer's language switcher, name and note, for the phone's settings menu.
// Languages are named in themselves, the way a lost reader finds theirs.
function SettingsExtras() {
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel className="flex items-center gap-2">
          <Languages className="size-3.5" />
          {m.language_label()}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={getLocale()}
          onValueChange={(value) => {
            const locale = locales.find((one) => one === value);
            if (locale) void setLocale(locale);
          }}
        >
          {locales.map((locale) => (
            <DropdownMenuRadioItem key={locale} value={locale}>
              {new Intl.DisplayNames([locale], { type: "language" }).of(locale)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel className="flex max-w-64 flex-col items-start gap-1 font-normal">
          <Brand className="text-foreground" />
          {m.footer_note()}
        </DropdownMenuLabel>
      </DropdownMenuGroup>
    </>
  );
}
