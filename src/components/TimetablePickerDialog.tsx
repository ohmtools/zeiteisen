import { useEffect, useRef, useState } from "react";
import { FilePlus, RefreshCw, Search, Sparkles, Upload, WifiOff } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "cn";
import { getLocale, m } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SkillDialog } from "@/components/SkillDialog";
import type { Catalog } from "@/lib/primitives/catalog";
import { uniqueName, normalizeName } from "@/lib/primitives/name";
import { nameTaken, type Profile } from "@/lib/primitives/profile";
import { Subjects } from "@/lib/primitives/subject";
import type { TimetableSource } from "@/lib/primitives/timetable";
import { blockedRows, finalNames, libraryRows, loadRow, type LibraryRow } from "@/lib/library";
import { readTimetableFiles, type UploadError } from "@/lib/upload";
import { nameProblemText } from "@/lib/names";

type Props = {
  open: boolean;
  // `new-profile` names the profile first; `add` copies into the active one.
  mode: "new-profile" | "add";
  onOpenChange: (open: boolean) => void;
  profiles: Profile[];
  // Lists nothing while offline.
  catalog: Catalog;
  // Offline the catalog lists nothing, which the dialog says once per opening.
  offline: boolean;
  // The profile the picks go to; undefined while a new one is being named.
  target?: Profile;
  // Asks the catalog again ("Try again" while it cannot be reached).
  onRetry?: () => void;
  // The profile name (new-profile mode) and the timetables, under their final
  // names. `false` when they were refused (the name was taken or the profile
  // locked meanwhile, in another tab): the dialog stays open and says why.
  onConfirm: (name: string, sources: TimetableSource[]) => boolean;
};

// One dialog for both roads into a profile: creating one, and extending one.
// One row per source — each catalog entry, each copy in any profile, each
// upload here. Picking a row copies its content into the profile; nothing is
// shared afterwards. Rows identical to a picked or held one are blocked, and
// picked rows that would share a name in the profile become "Name 2".
export function TimetablePickerDialog({
  open,
  mode,
  onOpenChange,
  profiles,
  catalog,
  offline,
  target,
  onRetry,
  onConfirm,
}: Props) {
  const [name, setName] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<TimetableSource[]>([]);
  // Empty timetables asked for here; one is created only if it is still
  // checked on confirm.
  const [empties, setEmpties] = useState<TimetableSource[]>([]);
  // Checked rows, by row key. Held rows are never in here: they are checked
  // and disabled on their own.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<UploadError[]>([]);
  const [busy, setBusy] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  // Bumped by every reset: an upload or confirm still awaiting a file or a
  // download when the dialog closes finds it changed and does nothing.
  const session = useRef(0);

  // One warning per opening, the same way the import dialog does it.
  const warned = useRef(false);
  useEffect(() => {
    if (!open) {
      warned.current = false;
      return;
    }
    if (!offline || warned.current) return;
    warned.current = true;
    toast.warning(m.picker_offline_warning());
  }, [open, offline]);

  // Shown: open, or still running its closing animation. The rows hash every
  // timetable of every profile, so a closed dialog (mounted from the first
  // render on) builds none; an opening one builds them fresh from the props.
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  const rows = shown ? libraryRows({ profiles, catalog, uploaded, empties, target }) : [];
  const blocked = blockedRows(rows, picked);
  const chosen = new Set([...picked].filter((key) => !blocked.has(key)));
  const held = (target?.timetables ?? []).map((timetable) => timetable.name);
  const names = finalNames(rows, chosen, held);
  // What the profile holds already: identical rows say so.
  const heldHashes = new Set(rows.filter((row) => row.held).map((row) => row.hash));

  const nameValue =
    name ??
    uniqueName(
      profiles.map((profile) => profile.name),
      m.profile_default(),
    );
  const nameClash = mode === "new-profile" && nameTaken(profiles, normalizeName(nameValue));
  const nameProblem = mode === "new-profile" ? nameProblemText(normalizeName(nameValue)) : null;
  const nameInvalid =
    mode === "new-profile" && (!normalizeName(nameValue) || nameClash || nameProblem !== null);

  const reset = () => {
    setName(null);
    setUploaded([]);
    setEmpties([]);
    setPicked(new Set());
    setErrors([]);
    setBusy(false);
    setQuery("");
    session.current++;
  };

  const upload = async (files: File[]) => {
    const run = session.current;
    const result = await readTimetableFiles(files);
    if (run !== session.current) return;
    setErrors(result.errors);
    if (result.sources.length === 0) return;
    const all = [...uploaded, ...result.sources];
    setUploaded(all);
    // An uploaded file is the user's answer, so it arrives checked — unless
    // its content is already picked or held.
    const fresh = libraryRows({ profiles, catalog, uploaded: all, empties, target });
    const next = new Set(chosen);
    for (let i = uploaded.length; i < all.length; i++) {
      const key = "u:" + i;
      if (!blockedRows(fresh, next).has(key)) next.add(key);
    }
    setPicked(next);
  };

  // Always local and checked right away; `finalNames` gives it a free name
  // ("New timetable 2") like any other pick.
  const addEmpty = () => {
    const empty: TimetableSource = {
      name: m.timetable_default_name(),
      origin: { kind: "local" },
      subjects: Subjects.empty(),
    };
    setPicked(new Set([...chosen, "e:" + empties.length]));
    setEmpties([...empties, empty]);
  };

  const confirm = async () => {
    if (nameInvalid) return;
    const run = session.current;
    setBusy(true);
    const sources: TimetableSource[] = [];
    for (const row of rows) {
      const finalName = names.get(row.key);
      if (finalName === undefined) continue;
      // A catalog row is downloaded now; a failed download (or content that
      // no longer matches the index) is reported and does not join the picks.
      // A profile's copy comes with its selection.
      const loaded = await loadRow(row);
      // Closed while a download was running: the user cancelled, nothing is
      // added and nothing more is reported.
      if (run !== session.current) return;
      if (loaded) sources.push({ ...loaded, name: finalName });
      else toast.error(m.catalog_error_fetch({ file: fileOf(row) }));
    }
    setBusy(false);
    if (sources.length === 0 && mode === "add") return;
    if (onConfirm(normalizeName(nameValue), sources)) close();
  };

  // Every way out forgets the dialog's state, so the next opening starts
  // fresh.
  const close = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      onOpenChangeComplete={(next) => {
        // Reopened before the closing animation ended: keep the rows.
        if (!next && !open) setShown(false);
      }}
    >
      <DialogContent className="compact:max-w-[min(36rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? m.picker_add_title() : m.picker_new_title()}</DialogTitle>
          <DialogDescription>
            {mode === "add" ? m.picker_add_text() : m.picker_new_text()}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {mode === "new-profile" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="picker-name">{m.profile_name()}</Label>
              <Input
                id="picker-name"
                value={nameValue}
                autoFocus
                aria-invalid={nameClash || nameProblem !== null || undefined}
                onChange={(event) => setName(event.target.value)}
              />
              {nameClash && <p className="text-sm text-destructive">{m.profile_name_taken()}</p>}
              {nameProblem && <p className="text-sm text-destructive">{nameProblem}</p>}
            </div>
          )}

          {offline && (
            <div className="flex flex-col items-start gap-2 rounded-lg bg-muted p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <WifiOff className="size-4" />
                {m.picker_unreachable_title()}
              </p>
              <p className="text-xs text-muted-foreground">{m.picker_unreachable_text()}</p>
              {onRetry && (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                  <RefreshCw data-icon="inline-start" />
                  {m.picker_retry()}
                </Button>
              )}
            </div>
          )}

          {rows.length > 0 && (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                className="pl-9"
                value={query}
                placeholder={m.picker_search()}
                aria-label={m.picker_search_label()}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          )}

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{m.picker_none()}</p>
          ) : (
            // The list scrolls inside itself: the dialog keeps its height
            // however many versions exist. Grouped: new rows first, then the
            // catalog by folder, then the other profiles' copies. Rows the
            // profile holds itself only block, they are not listed.
            <div className="-mx-2 flex max-h-[20rem] flex-col gap-3 overflow-y-auto px-2">
              {sectionsOf(rows, query).map((section) => (
                <section key={section.key} className="flex flex-col">
                  {section.title && (
                    <h3 className="pb-1 text-xs text-muted-foreground">{section.title}</h3>
                  )}
                  <ul className="flex flex-col">
                    {section.rows.map((row) => (
                      <PickerRow
                        key={row.key}
                        row={row}
                        checked={chosen.has(row.key)}
                        blocked={blocked.has(row.key)}
                        inProfile={heldHashes.has(row.hash)}
                        addedAs={names.get(row.key)}
                        onToggle={(checked) =>
                          setPicked((previous) => {
                            const next = new Set(previous);
                            if (checked) next.add(row.key);
                            else next.delete(row.key);
                            return next;
                          })
                        }
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <input
              ref={input}
              type="file"
              accept=".timetable"
              multiple
              className="hidden"
              onChange={(event) => {
                const selected = [...(event.target.files ?? [])];
                // Reset so picking the same file again fires `change`.
                event.target.value = "";
                if (selected.length > 0) void upload(selected);
              }}
            />
            <div className="-mx-2.5 flex flex-col">
              <Button variant="ghost" className="justify-start px-2.5" onClick={addEmpty}>
                <FilePlus data-icon="inline-start" />
                {m.picker_empty()}
              </Button>
              <Button
                variant="ghost"
                className="justify-start px-2.5"
                onClick={() => input.current?.click()}
              >
                <Upload data-icon="inline-start" />
                {m.picker_upload()}
              </Button>
              <Button
                variant="ghost"
                className="justify-start px-2.5"
                onClick={() => setSkillOpen(true)}
              >
                <Sparkles data-icon="inline-start" />
                {m.picker_skill()}
              </Button>
            </div>
            {errors.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm text-destructive">
                {errors.map((error) => (
                  <li key={error.file + error.message}>
                    {error.file ? `${error.file}: ${error.message}` : error.message}
                    {error.details && (
                      <ul className="list-disc pl-4 break-words">
                        {error.details.map((detail, i) => (
                          <li key={i}>{detail}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            {m.cancel()}
          </Button>
          <Button
            // A new profile may start empty; adding nothing to an existing one
            // would be a no-op.
            disabled={busy || nameInvalid || (mode === "add" && chosen.size === 0)}
            onClick={() => void confirm()}
          >
            {mode === "add" ? m.picker_confirm() : m.profile_create()}
          </Button>
        </DialogFooter>
      </DialogContent>
      <SkillDialog open={skillOpen} onOpenChange={setSkillOpen} />
    </Dialog>
  );
}

type Section = { key: string; title: string | null; rows: LibraryRow[] };

// The list's sections: rows made in this dialog (uploads, empties) first and
// untitled, then the catalog by folder ("Catalog · B-EI"), then the copies in
// other profiles. The profile's own copies are left out: they only block.
function sectionsOf(rows: readonly LibraryRow[], query: string): Section[] {
  const wanted = query.trim().toLocaleLowerCase(getLocale());
  const sections = new Map<string, Section>();
  const add = (key: string, title: string | null, row: LibraryRow) => {
    const section = sections.get(key) ?? { key, title, rows: [] };
    section.rows.push(row);
    sections.set(key, section);
  };
  for (const row of rows) {
    if (row.held) continue;
    if (wanted && !row.name.toLocaleLowerCase(getLocale()).includes(wanted)) continue;
    if (row.kind === "catalog") {
      const folder = folderOf(row);
      add(
        `c:${folder}`,
        folder ? m.picker_catalog_folder({ folder }) : m.picker_source_catalog(),
        row,
      );
    } else if (row.kind === "profile") add("p", m.picker_other_profiles(), row);
    else add("new", null, row);
  }
  const order = (key: string) => (key === "new" ? 0 : key === "p" ? 2 : 1);
  return [...sections.values()].sort((a, b) => order(a.key) - order(b.key));
}

// "B-EI" of "timetables/B-EI/BEI3.timetable"; "" for a file at the top.
function folderOf(row: LibraryRow): string {
  const { origin } = row.source;
  if (origin.kind !== "catalog") return "";
  return origin.path.split("/").slice(1, -1).join("/");
}

// Status under the name, never beside it: the dialog is too narrow for name,
// source and the final name on one line at 360px in German.
function PickerRow({
  row,
  checked,
  blocked,
  inProfile,
  addedAs,
  onToggle,
}: {
  row: LibraryRow;
  checked: boolean;
  // Identical to a picked or held row: greyed out, unchecked, disabled.
  blocked: boolean;
  // Identical to a timetable the profile holds already.
  inProfile: boolean;
  // The name the row lands under, when it is picked.
  addedAs: string | undefined;
  onToggle: (checked: boolean) => void;
}) {
  const id = "pick-" + row.key;
  return (
    <li className={cn("flex items-center gap-3 py-1.5", blocked && "opacity-50")}>
      <Checkbox
        id={id}
        checked={checked && !blocked}
        disabled={blocked}
        onCheckedChange={(next) => onToggle(next === true)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Label htmlFor={id} className="text-sm font-medium">
          {row.name}
        </Label>
        <span className="text-xs text-muted-foreground">
          {inProfile
            ? m.picker_in_profile()
            : [
                sourceLabel(row),
                row.selection ? m.picker_selection(row.selection) : null,
                row.modified ? m.picker_modified({ date: dateLabel(row.modified) }) : null,
                addedAs !== undefined && addedAs !== row.name
                  ? m.picker_added_as({ name: addedAs })
                  : null,
              ]
                .filter((part) => part !== null)
                .join(" · ")}
        </span>
      </div>
    </li>
  );
}

function sourceLabel(row: LibraryRow): string {
  if (row.kind === "catalog") return m.picker_source_catalog();
  if (row.kind === "upload") return m.picker_source_upload();
  if (row.kind === "empty") return m.picker_source_empty();
  return m.picker_source_profile({ name: row.profileName ?? "" });
}

// When a catalog file last changed, in the UI language.
function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium" }).format(new Date(iso));
}

// The catalog file a failed row came from, for the error toast.
function fileOf(row: LibraryRow): string {
  const { origin } = row.source;
  return origin.kind === "catalog" ? origin.path : row.name;
}
