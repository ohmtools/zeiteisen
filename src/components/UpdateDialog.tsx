import { useEffect, useRef, useState } from "react";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { toast } from "@/lib/ohmtools/toast";
import { m } from "@/i18n";
import { Popup } from "@/components/ohmtools/popup";
import { Button } from "@/components/ui/button";
import type { Catalog } from "@/lib/primitives/catalog";
import { diffSubjects, type SubjectChange } from "@/lib/primitives/diff";
import { groupName } from "@/lib/primitives/group";
import type { Subject } from "@/lib/primitives/subject";
import {
  catalogUpdate,
  rejectUpdate,
  update,
  type Timetable,
  type TimetableName,
} from "@/lib/primitives/timetable";
import { classLabel, dayName, repeatTypeName, timeRangeLabel } from "@/lib/subjects";
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
  const entry = timetable ? catalogUpdate(timetable, catalog) : null;
  // The offered file identifies the download, not the `Catalog` object: every
  // background refresh builds a new one, which must not download the same
  // version again and reset the diff shown.
  const offered = entry ? entry.path + "\n" + entry.hash : null;
  // A downloaded version, tagged with the timetable and offer it was fetched
  // for: it only shows for those, so another timetable or a newer offer starts
  // from "loading" again. Offline (or the offer withdrawn) after the diff
  // arrived, it stays on screen: only refusing needs the catalog.
  const [result, setResult] = useState<{
    timetable: Timetable;
    offered: string | null;
    next: Timetable;
  } | null>(null);
  const next =
    result && result.timetable === timetable && (result.offered === offered || offered === null)
      ? result.next
      : null;
  // What the download effect reads without restarting on it: the timetable
  // and the offered file alone identify a download.
  const latest = useRef({ catalog, onOpenChange, next, entry });
  useEffect(() => {
    latest.current = { catalog, onOpenChange, next, entry };
  });

  useEffect(() => {
    if (!timetable || (offered === null && latest.current.next !== null)) return;
    let cancelled = false;
    const file = latest.current.entry?.path ?? timetable.name;
    void update(timetable, latest.current.catalog).then((updated) => {
      if (cancelled) return;
      // No update after all, or the download failed or was not the listed
      // version: nothing left to show.
      if (!updated) {
        toast.error(m.catalog_error_fetch({ file }));
        latest.current.onOpenChange(false);
        return;
      }
      setResult({ timetable, offered, next: updated });
    });
    return () => {
      cancelled = true;
    };
  }, [timetable, offered]);

  // Never empty: `update` only hands out the version the index lists, whose
  // hash differs from the timetable's.
  const diff =
    timetable && next
      ? diffSubjects(timetable.subjects.toSubjects(), next.subjects.toSubjects())
      : null;

  // Leaving it is "Later": nothing changes, the update stays offered.
  const later = () => onOpenChange(false);

  return (
    <Popup
      kind="dialog"
      open={timetable !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
      onCancel={later}
      title={m.update_title({ name: timetable?.name ?? "" })}
      description={entry ? m.update_from_catalog({ file: entry.path }) : ""}
      closeLabel={m.panel_close()}
      // Wider than a dialog's 28rem: its three buttons, which never shrink,
      // did not fit in a row in German and pushed past the border.
      className="compact:max-w-[min(32rem,calc(100%-2rem))]"
      footer={
        <>
          <Button variant="ghost" onClick={later}>
            {m.update_later()}
          </Button>
          <Button
            variant="secondary"
            disabled={locked || diff === null || entry === null}
            onClick={() => {
              if (timetable) onReplace(timetable.name, rejectUpdate(timetable, catalog));
              onOpenChange(false);
            }}
          >
            {m.update_reject()}
          </Button>
          <Button
            disabled={locked || next === null}
            onClick={() => {
              if (!timetable || !next) return;
              onReplace(timetable.name, next);
              toast.success(m.toast_timetable_updated({ name: timetable.name }));
              onOpenChange(false);
            }}
          >
            {m.update_confirm()}
          </Button>
        </>
      }
    >
      {diff === null ? (
        <p className="text-sm text-muted-foreground">{m.update_loading()}</p>
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">{m.update_summary({ count: diff.sameCount })}</p>
          <DiffList
            title={m.update_added()}
            sign="added"
            lines={limit(diff.added.map(classLabel))}
          />
          <ChangeList changes={diff.changed} />
          <DiffList
            title={m.update_removed()}
            sign="removed"
            lines={limit(diff.removed.map(classLabel))}
          />
        </div>
      )}
    </Popup>
  );
}

// "New" and "Dropped", each class with its slot.
function DiffList({
  title,
  sign,
  lines,
}: {
  title: string;
  sign: "added" | "removed";
  lines: string[];
}) {
  if (lines.length === 0) return null;
  const Icon = sign === "added" ? Plus : Minus;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-2">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="font-mono text-xs">{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// "ELK1 · Pr · 10.7": a changed class, the part that stayed the same.
function classHead(subject: Subject): string {
  const group = subject.group ? ` · ${groupName(subject.group)}` : "";
  return `${subject.name} · ${subject.kind.join(", ")}${group}`;
}

const or = (text: string | undefined) => (text ? text : "–");

// What changed, old → new, one line per field ("Room WE.107 → WE.109").
function changeLines({ before, after, fields }: SubjectChange): string[] {
  const a = before.repeat;
  const b = after.repeat;
  return fields.map((field) => {
    switch (field) {
      case "repeat":
        return m.update_change_repeat({ from: repeatTypeName(a.type), to: repeatTypeName(b.type) });
      case "dates":
        return m.update_change_dates();
      case "note":
        return m.update_change_note();
      case "onDemand":
        return m.update_change_on_demand();
      case "degreeProgram":
        return m.update_change_degree({
          from: or(before.degreeProgram),
          to: or(after.degreeProgram),
        });
    }
    // The rest only differ between two weekly rhythms.
    if (a.type === "I" || b.type === "I") return "";
    switch (field) {
      case "day":
        return m.update_change_day({ from: dayName(a.day), to: dayName(b.day) });
      case "time":
        return m.update_change_time({ from: timeRangeLabel(a), to: timeRangeLabel(b) });
      case "location":
        return m.update_change_location({ from: or(a.location), to: or(b.location) });
      case "professor":
        return m.update_change_professor({ from: or(a.professor), to: or(b.professor) });
    }
  });
}

// At most this many changes are listed, the rest counted, like `limit`.
const MAX_CHANGES = 10;

// "Changed": the class, then old → new for what differs.
function ChangeList({ changes }: { changes: SubjectChange[] }) {
  if (changes.length === 0) return null;
  const more = changes.length - MAX_CHANGES;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{m.update_changed()}</p>
      <ul className="flex flex-col gap-1.5">
        {changes.slice(0, MAX_CHANGES).map((change, i) => (
          <li key={i} className="flex items-start gap-2">
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="flex flex-col">
              <span className="text-sm font-medium">{classHead(change.after)}</span>
              {changeLines(change).map((line) => (
                <span key={line} className="font-mono text-xs text-muted-foreground">
                  {line}
                </span>
              ))}
            </span>
          </li>
        ))}
        {more > 0 && (
          <li className="pl-6 text-xs text-muted-foreground">
            {m.upload_error_more({ count: more })}
          </li>
        )}
      </ul>
    </div>
  );
}
