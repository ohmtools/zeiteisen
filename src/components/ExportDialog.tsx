import { useState } from "react";
import { addMonths, isBefore, startOfDay } from "date-fns";
import { CalendarDays } from "lucide-react";
import { getLocale, m } from "@/i18n";
import { Button } from "@/components/ui/button";
import { LazyCalendar } from "@/components/LazyCalendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button variant="outline" className="justify-start" />}>
          <CalendarDays data-icon="inline-start" />
          {dateLabel(value)}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <LazyCalendar
            mode="single"
            defaultMonth={value}
            selected={value}
            onDayClick={(day) => {
              onChange(startOfDay(day));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.export_title()}</DialogTitle>
          <DialogDescription>{m.export_text()}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <DatePicker label={m.export_start()} value={start} onChange={setStart} />
          <DatePicker label={m.export_end()} value={end} onChange={setEnd} />
          {invalid && <p className="text-sm text-destructive">{m.export_invalid()}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
