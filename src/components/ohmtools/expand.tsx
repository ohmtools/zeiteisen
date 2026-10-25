// ohmtools/design: shadcn/src/components/ohmtools/expand.tsx (copied by `ohmtools-design add`, do not edit)
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// The element group "Expanding" (DESIGN.md, "Which group"): extra
// information in its place that blocks nothing, the same on every step. A
// muted ghost button with a chevron that turns; what opens fades and slides
// in a little.
export function Expand({
  title,
  icon,
  defaultOpen = false,
  className,
  children,
}: {
  title: ReactNode;
  // A lucide icon before the title.
  icon?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("flex flex-col", className)}>
      <CollapsibleTrigger
        render={<Button variant="ghost" className="-ml-2.5 self-start text-muted-foreground" />}
      >
        {icon}
        {title}
        <ChevronDown
          data-icon="inline-end"
          className={cn(
            "transition-transform duration-400 ease-[cubic-bezier(0.2,0,0,1)]",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="animate-in pt-2 duration-560 ease-[cubic-bezier(0.2,0,0,1)] fade-in-0 slide-in-from-top-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
