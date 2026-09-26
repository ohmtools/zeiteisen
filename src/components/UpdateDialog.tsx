import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
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
import type { Catalog } from "@/lib/primitives/catalog";
import { diffSubjects } from "@/lib/primitives/diff";
import {
  catalogUpdate,
  rejectUpdate,
  update,
  type Timetable,
  type TimetableName,
} from "@/lib/primitives/timetable";
import { classLabel } from "@/lib/subjects";
import { limit } from "@/lib/upload";

type Props = {
  // The timetable the catalog has a new version of; `null` keeps the dialog
  // closed.
  timetable: Timetable | null;
  catalog: Catalog;
  // A locked profile shows the diff but takes no decision.
  locked: boolean;
  onOpenChange: (open: boolean) => void;
  // The timetable under that name becomes `next`: the update accepted, or the
  // same timetable with the refused hash remembered.
  onReplace: (name: TimetableName, next: Timetable) => void;
};

// An update is never applied without showing what it changes. Updates come
// from the catalog alone; the new version is downloaded when the dialog opens:
// only then is the diff known at all.
export function UpdateDialog({ timetable, catalog, locked, onOpenChange, onReplace }: Props) {
  const [next, setNext] = useState<Timetable | null>(null);
  const entry = timetable ? catalogUpdate(timetable, catalog) : null;
  // The offered file identifies the download, not the `Catalog` object: every
  // background refresh builds a new one, which must not download the same
  // version again and reset the diff shown.
  const offered = entry ? entry.path + "\n" + entry.hash : null;
  const latest = useRef({ catalog, onOpenChange });
  useEffect(() => {
    latest.current = { catalog, onOpenChange };
  });

  useEffect(() => {
    if (!timetable) {
      setNext(null);
      return;
    }
    // Offline (or the offer withdrawn) after the diff arrived: it stays on
    // screen, only refusing needs the catalog.
    if (offered === null && next !== null) return;
    setNext(null);
    let cancelled = false;
    void update(timetable, latest.current.catalog).then((updated) => {
      if (cancelled) return;
      // No update after all, or the download failed: nothing left to show.
      if (!updated) {
        toast.error(m.catalog_error_fetch({ file: entry?.path ?? timetable.name }));
        latest.current.onOpenChange(false);
        return;
      }
      setNext(updated);
    });
    return () => {
      cancelled = true;
    };
    // The timetable and the offered file identify the download.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetable, offered]);

  const diff =
    timetable && next
      ? diffSubjects(timetable.subjects.toSubjects(), next.subjects.toSubjects())
      : null;
  // A stale index may serve the very content the timetable already has.
  const identical = diff !== null && diff.added.length === 0 && diff.removed.length === 0;

  return (
    <AlertDialog
      open={timetable !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{m.update_title({ name: timetable?.name ?? "" })}</AlertDialogTitle>
          <AlertDialogDescription>
            {entry ? m.update_from_catalog({ file: entry.path }) : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {diff === null ? (
          <p className="text-sm text-muted-foreground">{m.update_loading()}</p>
        ) : identical ? (
          <p className="text-sm text-muted-foreground">{m.update_none()}</p>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">{m.update_summary({ count: diff.sameCount })}</p>
            <DiffList title={m.update_added()} lines={limit(diff.added.map(classLabel))} />
            <DiffList title={m.update_removed()} lines={limit(diff.removed.map(classLabel))} />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
          <Button
            variant="outline"
            disabled={locked || diff === null || entry === null}
            onClick={() => {
              if (timetable) onReplace(timetable.name, rejectUpdate(timetable, catalog));
              onOpenChange(false);
            }}
          >
            {m.update_reject()}
          </Button>
          <AlertDialogAction
            disabled={locked || next === null}
            onClick={() => {
              if (!timetable || !next) return;
              onReplace(timetable.name, next);
              toast.success(m.toast_timetable_updated({ name: timetable.name }));
              onOpenChange(false);
            }}
          >
            {m.update_confirm()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DiffList({ title, lines }: { title: string; lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="font-medium">{title}</p>
      <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
