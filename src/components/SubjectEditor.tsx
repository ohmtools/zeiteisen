import { useState } from "react";
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
import { SubjectDialog, type SubjectTarget } from "@/components/SubjectDialog";
import { sameSubject, type Subject, type Subjects } from "@/lib/primitives/subject";
import type { Timetable, TimetableName, TimetableSubjectExtra } from "@/lib/primitives/timetable";

// The subject editor asked for, from the tree (pen, "add subject") or a
// block's details: a subject by timetable name and index, `null` adds one.
export type EditRequest = { name: TimetableName; index: number | null };

// Any subject change turns a catalog timetable local (no more updates), so
// for one the user is asked first, before the editor opens (user decision:
// never after the changes are made). Adding suggests a new empty timetable
// instead, "add to it anyway" is the other way. A local timetable is never
// asked about. The editor is read against the current timetables: it closes
// when its timetable goes away, or when another tab changed what sits at that
// index (a removal shifts the indexes, and saving would overwrite another
// subject).
export function SubjectEditor({
  request,
  timetables,
  library,
  profileName,
  locked,
  onClose,
  onSave,
  onAddEmpty,
}: {
  request: EditRequest | null;
  timetables: readonly Timetable[];
  // Every timetable on the device: the editor learns its suggestions from them.
  library: readonly Timetable[];
  profileName: string;
  locked: boolean;
  onClose: () => void;
  onSave: (name: TimetableName, subjects: Subjects<TimetableSubjectExtra>) => void;
  // Creates an empty timetable; its name, or `null` when the profile refused.
  onAddEmpty: () => TimetableName | null;
}) {
  // The request as it was taken: the subject at its index then, and whether
  // the question has been answered.
  const [taken, setTaken] = useState<{
    request: EditRequest;
    subject: Subject | null;
    asking: boolean;
  } | null>(null);
  // A new request from App starts over; the empty timetable suggested for an
  // addition replaces the request here, App's stays as it was.
  const [seen, setSeen] = useState(request);
  if (request !== seen) {
    setSeen(request);
    const timetable = request && timetables.find((one) => one.name === request.name);
    setTaken(
      request && timetable
        ? {
            request,
            subject: request.index === null ? null : timetable.subjects.getSubject(request.index),
            asking: timetable.origin.kind === "catalog",
          }
        : null,
    );
  }
  const timetable = taken && timetables.find((one) => one.name === taken.request.name);
  const index = taken?.request.index ?? null;
  const stillThere =
    taken !== null &&
    timetable !== undefined &&
    timetable !== null &&
    (index === null ||
      (taken.subject !== null &&
        index < timetable.subjects.length &&
        sameSubject(timetable.subjects.getSubject(index), taken.subject)));
  const target: SubjectTarget | null =
    taken && !taken.asking && stillThere && !locked ? { timetable: timetable!, index } : null;
  const name = taken?.request.name ?? "";
  const asking = taken !== null && taken.asking && stillThere && !locked;
  const adding = index === null;

  return (
    <>
      <SubjectDialog
        target={target}
        library={library}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        onSave={(subjects) => {
          if (taken) onSave(taken.request.name, subjects);
        }}
      />

      <AlertDialog
        open={asking}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {adding
                ? m.subject_catalog_add_title({ timetable: name })
                : m.subject_catalog_edit_title({ timetable: name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {adding
                ? m.subject_catalog_add_text({ timetable: name })
                : m.subject_catalog_edit_text({ timetable: name, profile: profileName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {adding ? (
            // Stacked: the suggestion first, the timetable itself second.
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  const fresh = onAddEmpty();
                  if (fresh)
                    setTaken({
                      request: { name: fresh, index: null },
                      subject: null,
                      asking: false,
                    });
                }}
              >
                {m.subject_catalog_add_empty()}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setTaken(taken && { ...taken, asking: false })}
              >
                {m.subject_catalog_add_confirm({ timetable: name })}
              </Button>
              <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
            </div>
          ) : (
            <AlertDialogFooter>
              <AlertDialogCancel>{m.cancel()}</AlertDialogCancel>
              {/* Opened as it was when asked: a subject another tab moved
                  meanwhile closes the editor instead of opening another one. */}
              <AlertDialogAction onClick={() => setTaken(taken && { ...taken, asking: false })}>
                {m.subject_catalog_edit_confirm()}
              </AlertDialogAction>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
