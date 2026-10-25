import { cn } from "cn";
import { m } from "@/i18n";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WEEK_FILTERS, type WeekFilter } from "@/lib/layout";

// "Week | General", the views behind tabs (`Views`, App).
export type View = "week" | "general";

function isFilter(value: unknown): value is WeekFilter {
  return WEEK_FILTERS.some((filter) => filter === value);
}

// Shadcn's tabs as a segmented control, full width on phones.
const LIST = "h-9 w-full compact:w-auto";
const TRIGGER = "px-3";

const FILTER_LABEL: Record<WeekFilter, () => string> = {
  all: m.filter_all,
  even: m.filter_even,
  odd: m.filter_odd,
};

// The general view's "All weeks | Even weeks | Odd weeks", in the week nav's
// place and height. It filters G and U only (`weekFilterMatches`).
export function WeekFilterSwitch({
  value,
  onChange,
  className,
}: {
  value: WeekFilter;
  onChange: (filter: WeekFilter) => void;
  className?: string;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        if (isFilter(next)) onChange(next);
      }}
      className={cn("min-w-0", className)}
    >
      <TabsList aria-label={m.filter_label()} className={LIST}>
        {WEEK_FILTERS.map((filter) => (
          <TabsTrigger key={filter} value={filter} className={TRIGGER}>
            {FILTER_LABEL[filter]()}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
