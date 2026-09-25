import { useState } from "react";
import { ListChecks, Pencil } from "lucide-react";
import { m } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { groupName } from "@/lib/primitives/group";
import type { Subjects } from "@/lib/primitives/subject";
import type { TimetableName, TimetableSubjectExtra } from "@/lib/primitives/timetable";
import type { CategoryNode } from "@/lib/primitives/tree";
import { repeatLabel, subjectLabel } from "@/lib/subjects";

type Props = {
  timetableName: TimetableName;
  category: CategoryNode;
  // The timetable's subjects the category's indexes point into.
  subjects: Subjects<TimetableSubjectExtra>;
  onSetEnabled: (indexes: number[], enabled: boolean) => void;
  // Opens the subject editor for the subject at that index.
  onEdit: (index: number) => void;
};

// The partial selection for a whole category, one checkbox per entry, grouped
// by group. It sits next to the category label instead of inside every cell so
// that the cells keep their width even in a category with twelve groups. Each
// row's pen opens the subject editor, which is why the picker shows for a
// single subject too.
export function ClassPicker({ timetableName, category, subjects, onSetEnabled, onEdit }: Props) {
  const groups = category.groups.filter((group) => group.indexes.length > 0);
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="sm" className="-my-1 h-6 px-1" aria-label={m.tree_pick()} />
        }
      >
        <ListChecks />
      </PopoverTrigger>
      <PopoverContent align="end">
        <PopoverHeader>
          <PopoverTitle>
            {category.category === null
              ? m.tree_pick_title_ungrouped()
              : m.tree_pick_title({ category: category.category })}
          </PopoverTitle>
        </PopoverHeader>
        <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
          {groups.map((group) => (
            <div
              key={group.group ? groupName(group.group) : "none"}
              className="flex flex-col gap-2"
            >
              {group.group && (
                <div className="text-xs text-muted-foreground">{groupName(group.group)}</div>
              )}
              {/* One row per entry, never merged (user decision): a class
                  listed twice with different slots is two rows, each with its
                  own slot, so either one can be dropped on its own. */}
              {group.indexes.map((index) => {
                const subject = subjects.getSubject(index);
                const label = subjectLabel(subject);
                return (
                  <div key={`${timetableName}/${index}`} className="flex items-center gap-2">
                    <label className="flex min-w-0 flex-1 items-center gap-2">
                      <Checkbox
                        checked={subjects.getExtra(index).enabled}
                        onCheckedChange={(checked) => onSetEnabled([index], checked === true)}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span>{label}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {repeatLabel(subject.repeat)}
                        </span>
                      </span>
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      title={m.tree_edit_subject({ subject: label })}
                      aria-label={m.tree_edit_subject({ subject: label })}
                      onClick={() => {
                        setOpen(false);
                        onEdit(index);
                      }}
                    >
                      <Pencil />
                    </Button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
