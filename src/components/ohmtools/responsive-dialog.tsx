// ohmtools/design: shadcn/src/components/ohmtools/responsive-dialog.tsx (copied by `ohmtools-design add`, do not edit)
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PhoneDrawer, dismissible } from "@/components/ohmtools/phone-drawer";
import { useStep } from "@/lib/ohmtools/steps";

// A task with an end (DESIGN.md, "Which popup"): a name to give, a file to
// import, a form whose inputs count only with the main button. A drawer from
// the bottom on phones, a centred dialog of at most 28rem from compact on,
// scrolling inside itself.
//
// `onCancel` is the dialog's Cancel: a swipe down, a press outside, Esc and
// the close button run it, without asking. Without `onCancel` they do
// nothing and the dialog waits for its buttons. `footer` holds the buttons,
// the main one last (on the right in a dialog, on top in a drawer).
export function ResponsiveDialog({
  open,
  onOpenChange,
  onCancel,
  title,
  description,
  footer,
  closeLabel = "Close",
  initialFocus,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel?: () => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  initialFocus?: React.ComponentProps<typeof DialogContent>["initialFocus"];
  className?: string;
  children?: ReactNode;
}) {
  const narrow = useStep() === "narrow";
  const dismiss = onCancel ?? "block";

  if (narrow) {
    return (
      <PhoneDrawer
        open={open}
        onOpenChange={onOpenChange}
        dismiss={dismiss}
        title={title}
        description={description}
        initialFocus={initialFocus}
        footer={footer}
        className={className}
      >
        {children}
      </PhoneDrawer>
    );
  }
  return (
    <Dialog open={open} onOpenChange={dismissible(dismiss, onOpenChange)}>
      <DialogContent
        showCloseButton={onCancel !== undefined}
        closeLabel={closeLabel}
        initialFocus={initialFocus}
        className={cn("max-h-[calc(100dvh-1.5rem)] overflow-y-auto", className)}
      >
        <DialogHeader className={cn(onCancel === undefined && "pr-0")}>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
