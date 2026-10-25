// ohmtools/design: shadcn/src/components/ohmtools/responsive-select.tsx (copied by `ohmtools-design add`, do not edit)
import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhoneDrawer } from "@/components/ohmtools/phone-drawer";
import { useStep } from "@/lib/ohmtools/steps";

export type ResponsiveSelectItem<Value extends string> = { value: Value; label: ReactNode };

// A field with a fixed list of options (DESIGN.md, "Which popup"): the same
// trigger everywhere; its list is a drawer from the bottom with 44px rows on
// phones and the select's popup from compact on. Picking closes it; so do a
// swipe down, a press outside and Esc, which change nothing.
export function ResponsiveSelect<Value extends string>({
  id,
  value,
  onValueChange,
  items,
  title,
  placeholder,
  disabled = false,
  className,
}: {
  id?: string;
  value: Value | null;
  onValueChange: (value: Value) => void;
  items: readonly ResponsiveSelectItem<Value>[];
  // The drawer's heading on phones (usually the field's label).
  title: string;
  placeholder?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const narrow = useStep() === "narrow";
  const [drawer, setDrawer] = useState(false);

  return (
    <>
      <Select
        value={value}
        onValueChange={(next) => {
          if (next !== null) onValueChange(next as Value);
        }}
        items={items}
        disabled={disabled}
        // Phones: the trigger opens the drawer instead of the popup.
        {...(narrow && {
          open: false,
          onOpenChange: (open: boolean) => {
            if (open) setDrawer(true);
          },
        })}
      >
        <SelectTrigger id={id} className={cn("w-full", className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        {!narrow && (
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        )}
      </Select>
      {narrow && (
        <PhoneDrawer
          open={drawer}
          onOpenChange={setDrawer}
          dismiss="close"
          title={title}
          className="gap-2"
        >
          <ul className="-mx-2 flex flex-col">
            {items.map((item) => (
              <li key={item.value}>
                <Button
                  variant="ghost"
                  aria-current={item.value === value || undefined}
                  className="h-11 w-full justify-start px-2 font-normal"
                  onClick={() => {
                    onValueChange(item.value);
                    setDrawer(false);
                  }}
                >
                  {item.value === value ? (
                    <Check data-icon="inline-start" />
                  ) : (
                    <span aria-hidden className="size-4 shrink-0" />
                  )}
                  {item.label}
                </Button>
              </li>
            ))}
          </ul>
        </PhoneDrawer>
      )}
    </>
  );
}
