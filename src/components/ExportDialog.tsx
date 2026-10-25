import { useState } from "react";
import { addMonths, isBefore, parseISO, startOfDay } from "date-fns";
import { m } from "@/i18n";
import { Popup } from "@/components/ohmtools/popup";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { DateRange } from "@/lib/primitives/occurrence";
import { isIsoDate } from "@/lib/primitives/subject";
import { isoDay } from "@/lib/primitives/week";

type PickerProps = {
  id: string;
  label: string;
  value: Date;
  onChange: (date: Date) => void;
};

// The device's own date field, like the subject editor's dates: a calendar
// popover would stand over the dialog, and over a popup only a dialog or a
// question may (DESIGN.md, "Popups"). A cleared field keeps the last date.
function DatePicker({ id, label, value, onChange }: PickerProps) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="date"
        className="font-mono"
        value={isoDay(value)}
        onChange={(event) => {
          if (isIsoDate(event.target.value)) onChange(startOfDay(parseISO(event.target.value)));
        }}
      />
    </Field>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (range: DateRange) => void;
};

// The fallback without a global dates file: nothing says when the
// lecture period starts and ends, so the user picks the range before the same
// expansion runs with `Repeat`-only filtering.
export function ExportDialog({ open, onOpenChange, onExport }: Props) {
  const [start, setStart] = useState(() => startOfDay(new Date()));
  const [end, setEnd] = useState(() => startOfDay(addMonths(new Date(), 4)));
  const invalid = isBefore(end, start);

  return (
    <Popup
      kind="dialog"
      open={open}
      onOpenChange={onOpenChange}
      onCancel={() => onOpenChange(false)}
      title={m.export_title()}
      description={m.export_text()}
      closeLabel={m.panel_close()}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {m.cancel()}
          </Button>
          <Button
            disabled={invalid}
            onClick={() => {
              onExport({ start, end });
              onOpenChange(false);
            }}
          >
            {m.export_confirm()}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <DatePicker id="export-start" label={m.export_start()} value={start} onChange={setStart} />
        <DatePicker id="export-end" label={m.export_end()} value={end} onChange={setEnd} />
        {invalid && <p className="text-sm text-destructive">{m.export_invalid()}</p>}
      </div>
    </Popup>
  );
}
