// ohmtools/design: shadcn/src/components/ohmtools/responsive-popover.tsx (copied by `ohmtools-design add`, do not edit)
import { cloneElement, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PhoneDrawer, useOpenState } from "@/components/ohmtools/phone-drawer";
import { useStep } from "@/lib/ohmtools/steps";

// Details or small settings that belong to one element on the screen
// (DESIGN.md, "Which popup"), taking effect at once: a drawer from the
// bottom on phones, a popover at the element from compact on, scrolling
// inside itself where the screen is short. Closing loses nothing, so a swipe
// down, a press outside and Esc close it.
//
// `trigger` is the element that opens it, a `Button` with its content.
export function ResponsivePopover({
  trigger,
  open,
  onOpenChange,
  title,
  titleHidden = false,
  align = "center",
  side = "bottom",
  className,
  children,
}: {
  trigger: ReactElement<Record<string, unknown>>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // The drawer's heading on phones; the popover's accessible name.
  title: string;
  // The content shows its own heading; the drawer's title is for screen readers.
  titleHidden?: boolean;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  children: ReactNode;
}) {
  const narrow = useStep() === "narrow";
  const [shown, setShown] = useOpenState(open, onOpenChange);

  if (narrow) {
    return (
      <>
        {cloneElement(trigger, {
          "aria-haspopup": "dialog",
          "aria-expanded": shown,
          onClick: () => setShown(true),
        })}
        <PhoneDrawer
          open={shown}
          onOpenChange={setShown}
          dismiss="close"
          title={title}
          titleHidden={titleHidden}
          className={className}
        >
          {children}
        </PhoneDrawer>
      </>
    );
  }
  return (
    <Popover open={shown} onOpenChange={setShown}>
      <PopoverTrigger render={trigger} />
      <PopoverContent
        align={align}
        side={side}
        aria-label={title}
        className={cn("max-h-(--available-height) overflow-y-auto", className)}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
