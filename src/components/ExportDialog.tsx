import { useState } from "react";
import { addMonths, isBefore, startOfDay } from "date-fns";
import { CalendarDays } from "lucide-react";
import { getLocale, m } from "@/i18n";
import { Popup } from "@/components/ohmtools/popup";
import { Button } from "@/components/ui/button";
import { LazyCalendar } from "@/components/LazyCalendar";
import { Field, FieldLabel } from "@/components/ui/field";
import type { DateRange } from "@/lib/primitives/occurrence";

function dateLabel(date: Date): string {
  return new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium" }).format(date);
}

type PickerProps = {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
};

function DatePicker({ label, value, onChange }: PickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {/* A popover, on phones a second drawer over the dialog's. */}
      <Popup
        kind="popover"
        trigger={
          <Button variant="secondary" className="justify-start">
            <CalendarDays data-icon="inline-start" />
            {dateLabel(value)}
          </Button>
        }
        open={open}
        onOpenChange={setOpen}
        title={label}
        titleHidden
        align="start"
        className="w-auto gap-0 p-0 pb-[env(safe-area-inset-bottom)]"
      >
        <LazyCalendar
          mode="single"
          defaultMonth={value}
          selected={value}
          className="mx-auto"
          onDayClick={(day) => {
            onChange(startOfDay(day));
            setOpen(false);
          }}
        />
      </Popup>
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
        <DatePicker label={m.export_start()} value={start} onChange={setStart} />
        <DatePicker label={m.export_end()} value={end} onChange={setEnd} />
        {invalid && <p className="text-sm text-destructive">{m.export_invalid()}</p>}
      </div>
    </Popup>
  );
}
