// ohmtools/design: shadcn/src/components/ohmtools/responsive-dialog.tsx (copied by `ohmtools-design add`, do not edit)
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePageSlot } from "@/components/ohmtools/app-shell";
import { PanelHeader } from "@/components/ohmtools/panel-header";
import { PhoneDrawer, dismissible } from "@/components/ohmtools/phone-drawer";
import { slideIn } from "@/lib/ohmtools/motion";
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
//
// `page`: a dialog longer than one screen or with several steps is a page of
// its own on phones instead of a drawer (DESIGN.md, "Popups"), coming in from
// the right; its back arrow and Esc run `onCancel`.
export function ResponsiveDialog({
  open,
  onOpenChange,
  onCancel,
  title,
  description,
  footer,
  page = false,
  closeLabel = "Close",
  backLabel = "Back",
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
  page?: boolean;
  closeLabel?: string;
  backLabel?: string;
  initialFocus?: React.ComponentProps<typeof DialogContent>["initialFocus"];
  className?: string;
  children?: ReactNode;
}) {
  const narrow = useStep() === "narrow";
  const dismiss = onCancel ?? "block";
  const slot = usePageSlot(narrow && page && open);

  if (narrow && page && slot) {
    if (!open) return null;
    return createPortal(
      <DialogPage
        title={title}
        description={description}
        footer={footer}
        onCancel={onCancel}
        backLabel={backLabel}
        className={className}
      >
        {children}
      </DialogPage>,
      slot,
    );
  }
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

// A phone's dialog as a page of its own, over everything (the shell's page
// slot, above a panel's page too): the title with a back arrow, the content
// scrolling, the buttons at the bottom like a drawer's (full width, 44px,
// the main one on top).
function DialogPage({
  title,
  description,
  footer,
  onCancel,
  backLabel,
  className,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  onCancel?: () => void;
  backLabel: string;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    slideIn(element, 1, { distance: 48 });
    element.focus({ preventScroll: true });
  }, []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      tabIndex={-1}
      className="absolute inset-0 z-10 flex flex-col bg-background pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] outline-none"
      onKeyDown={(event) => {
        if (event.key === "Escape" && onCancel) {
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <PanelHeader
        title={<span id={titleId}>{title}</span>}
        onBack={onCancel}
        backLabel={backLabel}
      />
      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4",
          className,
        )}
      >
        {description && (
          <p id={descriptionId} className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {children}
      </div>
      {footer && (
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] *:data-[slot=button]:h-11 *:data-[slot=button]:w-full">
          {footer}
        </div>
      )}
    </div>
  );
}
