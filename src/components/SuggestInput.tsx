import type { ComponentProps } from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { Input } from "@/components/ui/input";

export type Suggestion = {
  value: string;
  // Shown next to the value and matched too: a subject's full name.
  hint?: string;
};

type Props = Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  suggestions: readonly Suggestion[];
};

// The shadcn `Input` with a free-text suggestion list (Base UI Autocomplete):
// anything may be typed, the list only offers what is likely right. The popup
// carries the shadcn combobox classes.
export function SuggestInput({ value, onValueChange, suggestions, ...props }: Props) {
  return (
    <Autocomplete.Root
      items={suggestions}
      value={value}
      onValueChange={onValueChange}
      itemToStringValue={(item: Suggestion) => item.value}
      filter={(item: Suggestion, query: string) => {
        const wanted = query.trim().toLowerCase();
        if (!wanted) return true;
        return (
          item.value.toLowerCase().includes(wanted) ||
          (item.hint?.toLowerCase().includes(wanted) ?? false)
        );
      }}
      limit={50}
      openOnInputClick
    >
      <Autocomplete.Input render={<Input autoComplete="off" {...props} />} />
      <Autocomplete.Portal>
        <Autocomplete.Positioner sideOffset={6} align="start" className="isolate z-50">
          <Autocomplete.Popup className="max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) overflow-hidden rounded-none popup-glass text-popover-foreground ring-1 ring-foreground/30 duration-200 data-empty:hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <Autocomplete.List className="max-h-[min(--spacing(72),var(--available-height))] scroll-py-1.5 overflow-y-auto overscroll-contain p-1.5 data-empty:p-0">
              {(item: Suggestion) => (
                <Autocomplete.Item
                  key={item.value}
                  value={item}
                  className="flex w-full cursor-default items-baseline gap-2 rounded-none px-3 py-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  <span className="shrink-0">{item.value}</span>
                  {item.hint && (
                    <span className="min-w-0 truncate text-xs text-muted-foreground">
                      {item.hint}
                    </span>
                  )}
                </Autocomplete.Item>
              )}
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}
