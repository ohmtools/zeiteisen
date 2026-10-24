import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
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
import type { OwnDegreeFile } from "@/lib/primitives/storage";
import { downloadBackup } from "@/lib/backup";
import { resetAndReload, type DataPart } from "@/lib/reset";
import { DataPartsList } from "@/components/DataParts";
import { appRoot } from "@/lib/catalog";
import { degreeNames, type DegreeName } from "@/lib/degrees";
import { toast } from "@/lib/toast";

// The dialogs behind the settings (`useDataControls`).

// The own degree files in upload order, each removable on its own; the dialog closes once none is left. Removing is
// at once, no confirmation: the user still has the file.
export function OwnDegreesDialog({
  open,
  onOpenChange,
  files,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: OwnDegreeFile[];
  onRemove: (names: string[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.degrees_manage_title()}</DialogTitle>
          <DialogDescription>{m.degrees_manage_text()}</DialogDescription>
        </DialogHeader>
        <ul className="flex max-h-72 flex-col divide-y overflow-y-auto">
          {files.map((file) => (
            <li key={file.name} className="flex items-center gap-2 py-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  {m.degree_subject_count({ count: file.data.subjects.length })}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                title={m.degrees_remove_file({ file: file.name })}
                aria-label={m.degrees_remove_file({ file: file.name })}
                onClick={() => onRemove([file.name])}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button
            variant="secondary"
            className="sm:mr-auto"
            onClick={() => onRemove(files.map((file) => file.name))}
          >
            {m.degrees_remove_all()}
          </Button>
          <Button onClick={() => onOpenChange(false)}>{m.close()}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Picked degree files, each given its name (the `degreeProgram` subjects
// name, `.degree` never shown), filled in with its file name. Open while there
// are files; cancelling loads none of them.
export function DegreeNamesDialog({
  files,
  held,
  catalog,
  onClose,
  onAdd,
}: {
  files: OwnDegreeFile[];
  // The own files already loaded: a name among them is replaced.
  held: OwnDegreeFile[];
  // The catalog's degree files, by name: one of them is replaced too.
  catalog: readonly string[];
  onClose: () => void;
  onAdd: (files: OwnDegreeFile[]) => void;
}) {
  const [names, setNames] = useState(() => files.map((file) => file.name));
  // Every new pick starts from the file names.
  const [shown, setShown] = useState(files);
  if (shown !== files) {
    setShown(files);
    setNames(files.map((file) => file.name));
  }

  // NFC like every typed name (macOS and iOS hand out file names with a
  // decomposed "ä", which would miss the `degreeProgram` spelled composed),
  // unique in any case, a catalog file's own spelling when it replaces one.
  const checked = degreeNames(
    files.map((_, i) => names[i] ?? ""),
    held,
    catalog,
  );
  const invalid = checked.some((one) => !one.name || one.problem !== null);
  const add = () => {
    if (invalid) return;
    onAdd(files.map((file, i) => ({ ...file, name: checked[i].name })));
    onClose();
  };

  return (
    <Dialog
      open={files.length > 0}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.degree_names_title()}</DialogTitle>
          <DialogDescription>{m.degree_names_text()}</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-80 flex-col gap-4 overflow-y-auto">
          {files.map((file, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Label htmlFor={`degree-name-${i}`}>{m.degree_name_label({ file: file.name })}</Label>
              <Input
                id={`degree-name-${i}`}
                value={names[i] ?? ""}
                autoFocus={i === 0}
                placeholder={m.degree_name_placeholder()}
                aria-invalid={checked[i].problem !== null || undefined}
                aria-describedby={`degree-name-${i}-note`}
                onChange={(event) => setNames(names.with(i, event.target.value))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") add();
                }}
              />
              <DegreeNameNote id={`degree-name-${i}-note`} checked={checked[i]} />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {m.cancel()}
          </Button>
          <Button disabled={invalid} onClick={add}>
            {m.degree_names_confirm()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Under a degree name: what is wrong with it, else what it replaces.
function DegreeNameNote({ id, checked }: { id: string; checked: DegreeName }) {
  if (checked.problem) {
    return (
      <p id={id} className="text-sm text-destructive">
        {checked.problem}
      </p>
    );
  }
  if (!checked.replaces) return null;
  return (
    <p id={id} className="text-sm text-muted-foreground">
      {checked.replaces === "own"
        ? m.degree_name_replaces()
        : m.degree_name_replaces_catalog({ name: checked.name })}
    </p>
  );
}

// The reset for when storage breaks the app: the chosen parts are removed,
// then the page starts again, because every hook read its state on the first
// render (like a restore). Nothing is chosen at first; "Save backup first" is
// the way back.
export function DeleteDataDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [chosen, setChosen] = useState<DataPart[]>([]);
  // Every opening starts with nothing chosen.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setChosen([]);
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {/* Five parts outgrow a short phone: the list scrolls, the buttons stay. */}
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)]">
        <AlertDialogHeader>
          <AlertDialogTitle>{m.data_delete_title()}</AlertDialogTitle>
          <AlertDialogDescription>{m.data_delete_text()}</AlertDialogDescription>
        </AlertDialogHeader>
        <DataPartsList id="delete" chosen={chosen} onChange={setChosen} />
        <Button
          variant="secondary"
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
            disabled={chosen.length === 0}
            onClick={async () => {
              if (!(await resetAndReload(chosen))) toast.error(m.data_delete_error());
            }}
          >
            {m.data_delete_confirm()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
export function CatalogUrlDialog({
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
            placeholder={new URL(defaultUrl, appRoot()).href}
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
            variant="secondary"
            className="sm:mr-auto"
            disabled={url === null}
            onClick={() => save(null)}
          >
            {m.catalog_url_default()}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
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
