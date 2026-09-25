import { useRef, useState, type ReactElement, type ReactNode } from "react";
import { CalendarDays, Download, Languages, RefreshCw, Upload } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Backup } from "@/lib/primitives/storage";
import { downloadBackup, readBackupFile, restoreBackup } from "@/lib/backup";
import { toast } from "@/lib/toast";

type Props = {
  autoUpdate: boolean;
  onAutoUpdate: (on: boolean) => void;
  datesManual: boolean;
  onUploadDates: (file: File) => void;
  onCatalogDates: () => void;
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
// Where the dates come from, whether catalog data is refreshed, and the backup
// of it all. Lives in the deferred chunk; App shows a disabled look-alike
// trigger until it arrives.
export function DataMenu({
  autoUpdate,
  onAutoUpdate,
  datesManual,
  onUploadDates,
  onCatalogDates,
  profileCount,
  trigger,
  children,
  settings = false,
}: Props & TriggerProps) {
  const datesInput = useRef<HTMLInputElement>(null);
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
        ref={datesInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const [file] = event.target.files ?? [];
          event.target.value = "";
          if (file) onUploadDates(file);
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
            {/* The dates are the one thing the catalog installs by itself;
                this is the way out of that, and back in. */}
            <DropdownMenuItem
              onClick={() => (datesManual ? onCatalogDates() : datesInput.current?.click())}
            >
              <CalendarDays data-icon="inline-start" />
              {datesManual ? m.dates_catalog_again() : m.dates_manual()}
            </DropdownMenuItem>
            {/* Dates, locations and abbreviations only: timetables never
                update by themselves. */}
            <DropdownMenuCheckboxItem
              checked={autoUpdate}
              title={autoUpdate ? m.auto_update_on() : m.auto_update_off()}
              onCheckedChange={(checked) => onAutoUpdate(checked)}
            >
              <RefreshCw data-icon="inline-start" />
              {m.auto_update()}
            </DropdownMenuCheckboxItem>
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

// The footer's language switcher and note, for the phone's settings menu.
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
        <DropdownMenuLabel className="max-w-64 font-normal">{m.footer_note()}</DropdownMenuLabel>
      </DropdownMenuGroup>
    </>
  );
}
