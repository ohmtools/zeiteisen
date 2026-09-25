import { cn } from "cn";
import { Card } from "@/components/ui/card";

// A sidebar section: shadcn's Card layout and typography (use the Card* parts
// inside), but without the box. Sections are separated by divider lines from
// the page layout instead (see App.tsx).
export function Section({ className, ...props }: React.ComponentProps<typeof Card>) {
  return (
    <Card
      className={cn("bg-transparent shadow-none ring-0 [--card-spacing:--spacing(6)]", className)}
      {...props}
    />
  );
}
