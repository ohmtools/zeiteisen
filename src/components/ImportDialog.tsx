import { useEffect, useRef, useState } from "react";
import { CircleAlert, CloudDownload, FileUp, Upload, User } from "lucide-react";
import { toast } from "@/lib/toast";
import { m } from "@/i18n";
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
import type { Catalog } from "@/lib/primitives/catalog";
import { uniqueName, normalizeName } from "@/lib/primitives/name";
import {
  nameTaken,
  parseProfileFile,
  resolveSharedProfile,
  type Profile,
} from "@/lib/primitives/profile";
import { findSubjects, type SubjectsSource } from "@/lib/primitives/subject";
import type { SharedTimetable, TimetableSource } from "@/lib/primitives/timetable";
import { decodeShareInput } from "@/lib/share";
import { readTimetableFiles } from "@/lib/upload";
import { nameProblemText } from "@/lib/names";
import { cleanName } from "@/lib/primitives/name";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profiles: Profile[];
  // Lists nothing while offline, so a catalog row is never promised when it
  // cannot be fetched.
  catalog: Catalog;
  offline: boolean;
  // A link opened directly skips the paste step: the timetables are already
  // there, the dialog only asks for a name and which ones to take.
  initial?: SharedTimetable[] | null;
  // A new profile, from a link (`unresolved` timetables could not be rebuilt)
  // or from a profile file. `false` when it was refused (its name was taken
  // meanwhile, in another tab): the dialog stays open, the name field says so.
  onImport: (profile: Profile, unresolved: number) => boolean;
};

// Where a shared timetable's content is found: a copy on this device (a
// profile's, or a file uploaded here), the catalog, or nowhere yet.
type Found = { source: SubjectsSource; local: boolean } | null;

// Import takes a pasted link or a `.profile` file and always creates a NEW
// profile with its own timetables; the existing ones are never touched. A
// profile file carries everything and is imported at once. A link only carries
// content hashes and selections, so the second step shows where each one is
// found and lets the user upload what is missing.
export function ImportDialog({
  open,
  onOpenChange,
  profiles,
  catalog,
  offline,
  initial,
  onImport,
}: Props) {
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);
  const [pasted, setPasted] = useState<SharedTimetable[] | null>(null);
  // The link carries no name: `null` = untouched, the suggested default.
  const [name, setName] = useState<string | null>(null);
  // Rows the user unchecked, by position in the link. Everything else is taken
  // when its content can be found, so a file uploaded here checks its row.
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [uploaded, setUploaded] = useState<TimetableSource[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  // Bumped by every reset: an upload or import still awaiting a file or a
  // download when the dialog closes finds it changed and does nothing.
  const session = useRef(0);

  const shared = pasted ?? initial ?? null;
  const nameValue =
    name ??
    uniqueName(
      profiles.map((profile) => profile.name),
      m.profile_default(),
    );
  const nameClash = nameTaken(profiles, normalizeName(nameValue));
  const nameProblem = nameProblemText(normalizeName(nameValue));
  const nameInvalid = !normalizeName(nameValue) || nameClash || nameProblem !== null;

  // Files uploaded here count like a profile of their own, searched last.
  const pool: Profile = {
    name: "",
    locked: false,
    timetables: uploaded.map((source) => ({ ...source, rejected: [] })),
  };
  const holders = [...profiles, pool];
  const found: Found[] = (shared ?? []).map(({ hash }) => {
    const [source] = findSubjects(hash, holders, catalog);
    if (!source) return null;
    const local = holders.some((holder) =>
      holder.timetables.some((timetable) => timetable.subjects.hash() === hash),
    );
    return { source, local };
  });
  const included = (i: number) => found[i] !== null && !excluded.has(i);
  const anyIncluded = found.some((_, i) => included(i));
  const missing = found.some((row) => row === null);

  // Offline AND without the content: the catalog cannot be asked, so the
  // import is not wrong, only incomplete.
  const warned = useRef<SharedTimetable[] | null>(null);
  useEffect(() => {
    if (!open || !shared || !offline || !missing) return;
    if (warned.current === shared) return;
    warned.current = shared;
    toast.warning(m.import_offline_warning());
  }, [open, shared, offline, missing]);

  const reset = () => {
    setText("");
    setFailed(false);
    setPasted(null);
    setName(null);
    setExcluded(new Set());
    setUploaded([]);
    setBusy(false);
    warned.current = null;
    session.current++;
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const detected = text.trim() ? decodeShareInput(text) : null;

  const acceptLink = () => {
    const next = decodeShareInput(text);
    if (next) {
      setPasted(next);
      // Unchecked rows are positions in the link: they mean nothing for
      // another one pasted after going back.
      setExcluded(new Set());
    }
    setFailed(next === null);
  };

  // A profile file is imported as it is, named after the file ("Name 2" when
  // taken): it needs no review, it carries every timetable. The name is
  // trimmed the way every profile name is, and made unique after that, so
  // "Plan A .profile" cannot land on a taken "Plan A".
  const acceptFile = async (file: File) => {
    const run = session.current;
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      json = undefined;
    }
    if (run !== session.current) return;
    const profile = parseProfileFile(json, file.name, profiles);
    // A file saved on Linux may carry a ":" Windows refuses.
    const wanted = profile && cleanName(profile.name.trim(), "");
    if (!profile || !wanted) {
      setFailed(true);
      return;
    }
    const name = uniqueName(
      profiles.map((one) => one.name),
      wanted,
    );
    // Refused only when another tab took the name meanwhile: picking the
    // file again finds the next free one.
    if (onImport({ ...profile, name }, 0)) close();
    else toast.error(m.profile_name_taken());
  };

  const upload = async (files: File[]) => {
    const run = session.current;
    const result = await readTimetableFiles(files);
    if (run !== session.current) return;
    for (const error of result.errors) toast.error(`${error.file}: ${error.message}`);
    if (result.sources.length > 0) setUploaded((previous) => [...previous, ...result.sources]);
  };

  const confirm = async () => {
    if (!shared || nameInvalid || !anyIncluded) return;
    const run = session.current;
    setBusy(true);
    const picked = shared.filter((_, i) => included(i));
    const { profile, unresolved } = await resolveSharedProfile(
      picked,
      normalizeName(nameValue),
      holders,
      catalog,
    );
    // Closed while the catalog was still downloading: the user cancelled.
    if (run !== session.current) return;
    if (onImport(profile, unresolved.length)) close();
    else setBusy(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.import_title()}</DialogTitle>
          <DialogDescription>{shared ? m.import_review_text() : m.import_text()}</DialogDescription>
        </DialogHeader>

        {shared === null ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="import-link">{m.import_link()}</Label>
            <Input
              id="import-link"
              value={text}
              aria-invalid={failed || undefined}
              autoFocus
              placeholder={m.import_link_placeholder()}
              onChange={(event) => {
                setText(event.target.value);
                setFailed(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") acceptLink();
              }}
            />
            <input
              ref={fileInput}
              type="file"
              accept=".profile"
              className="hidden"
              onChange={(event) => {
                const [file] = event.target.files ?? [];
                // Reset so picking the same file again fires `change`.
                event.target.value = "";
                if (file) void acceptFile(file);
              }}
            />
            <Button
              variant="secondary"
              className="self-start"
              onClick={() => fileInput.current?.click()}
            >
              <FileUp data-icon="inline-start" />
              {m.import_file()}
            </Button>
            {/* What the typed link holds, before "Next". */}
            {!failed && detected !== null && (
              <p className="text-xs text-muted-foreground">
                {m.import_detected({ count: detected.length })}
              </p>
            )}
            {failed && <p className="text-sm text-destructive">{m.import_error()}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="import-name">{m.profile_name()}</Label>
              <Input
                id="import-name"
                value={nameValue}
                autoFocus
                aria-invalid={nameClash || nameProblem !== null || undefined}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void confirm();
                }}
              />
              {nameClash && <p className="text-sm text-destructive">{m.profile_name_taken()}</p>}
              {nameProblem && <p className="text-sm text-destructive">{nameProblem}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{m.import_timetables()}</p>
              {shared.length === 0 ? (
                <p className="text-sm text-muted-foreground">{m.import_none()}</p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {found.map((row, i) => (
                    <SharedRow
                      key={i}
                      id={`import-${i}`}
                      found={row}
                      checked={included(i)}
                      onToggle={(checked) =>
                        setExcluded((previous) => {
                          const next = new Set(previous);
                          if (checked) next.delete(i);
                          else next.add(i);
                          return next;
                        })
                      }
                    />
                  ))}
                </ul>
              )}
              <input
                ref={uploadInput}
                type="file"
                accept=".timetable"
                multiple
                className="hidden"
                onChange={(event) => {
                  const selected = [...(event.target.files ?? [])];
                  event.target.value = "";
                  if (selected.length > 0) void upload(selected);
                }}
              />
              {/* A missing timetable is what an upload is for, so then it is
                  a labelled button; otherwise the quiet icon fallback. */}
              {missing ? (
                <>
                  <p className="text-sm text-muted-foreground">{m.import_missing_hint()}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    onClick={() => uploadInput.current?.click()}
                  >
                    <Upload data-icon="inline-start" />
                    {m.import_upload()}
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="self-start"
                  title={m.import_upload()}
                  aria-label={m.import_upload()}
                  onClick={() => uploadInput.current?.click()}
                >
                  <Upload />
                </Button>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              // With a pasted link the first step is still reachable; a
              // link-opened dialog has nothing to go back to.
              if (pasted) {
                // Going back also calls off an import still downloading.
                session.current++;
                setBusy(false);
                setPasted(null);
              } else close();
            }}
          >
            {pasted ? m.import_back() : m.cancel()}
          </Button>
          {shared === null ? (
            <Button disabled={!text.trim()} onClick={acceptLink}>
              {m.import_next()}
            </Button>
          ) : (
            <Button disabled={busy || !anyIncluded || nameInvalid} onClick={() => void confirm()}>
              {m.import_confirm()}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type RowProps = {
  id: string;
  found: Found;
  checked: boolean;
  onToggle: (checked: boolean) => void;
};

// A missing timetable is not an error: the upload below the list resolves it,
// and the moment a matching file lands the row turns checked and importable.
function SharedRow({ id, found, checked, onToggle }: RowProps) {
  const { Icon, text } =
    found === null
      ? { Icon: CircleAlert, text: m.import_missing() }
      : found.local
        ? { Icon: User, text: m.import_found_local({ name: found.source.name }) }
        : { Icon: CloudDownload, text: m.import_found_catalog({ name: found.source.name }) };

  return (
    <li className="flex items-center gap-3 py-2">
      <Checkbox
        id={id}
        checked={checked}
        disabled={found === null}
        onCheckedChange={(next) => onToggle(next === true)}
      />
      <Label htmlFor={id} className="min-w-0 flex-1">
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0">{text}</span>
      </Label>
    </li>
  );
}
