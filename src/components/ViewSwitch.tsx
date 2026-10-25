import { cn } from "cn";
import { m } from "@/i18n";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WEEK_FILTERS, type WeekFilter } from "@/lib/layout";
import { SHORT_QUERY, useMedia } from "@/lib/ohmtools/steps";

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

// A phone turned sideways: one header row holds profile, views, filter and
// buttons only with less in each part (the design's `short:` rule), "All |
// Even | Odd"; the tab list still says "Weeks".
const FILTER_SHORT: Record<WeekFilter, () => string> = {
  all: m.filter_all_short,
  even: m.filter_even_short,
  odd: m.filter_odd_short,
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
  const labels = useMedia(SHORT_QUERY) ? FILTER_SHORT : FILTER_LABEL;
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
            {labels[filter]()}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
