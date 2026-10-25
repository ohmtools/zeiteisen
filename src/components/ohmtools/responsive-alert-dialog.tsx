// ohmtools/design: shadcn/src/components/ohmtools/responsive-alert-dialog.tsx (copied by `ohmtools-design add`, do not edit)
import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PhoneDrawer, dismissible } from "@/components/ohmtools/phone-drawer";
import { useStep } from "@/lib/ohmtools/steps";

// A question before something that cannot be undone (DESIGN.md, "Which
// popup"): a drawer from the bottom on phones, centred from compact on. It
// always has Cancel, so a swipe down, a press outside and Esc cancel. The
// action is red when it destroys something and stands next to Cancel.
export function ResponsiveAlertDialog({
  open,
  onOpenChange,
  title,
  description,
  action,
  onAction,
  destructive = false,
  cancel,
  onCancel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  // The action's label ("Delete").
  action: ReactNode;
  onAction: () => void;
  destructive?: boolean;
  // Cancel's label, in the app's language.
  cancel: ReactNode;
  // Runs before the question closes without the action.
  onCancel?: () => void;
  // Optional content between the text and the buttons (a checkbox, a list).
  children?: ReactNode;
}) {
  const narrow = useStep() === "narrow";
  const dismiss = () => onCancel?.();
  const variant = destructive ? "destructive" : "default";

  if (narrow) {
    return (
      <PhoneDrawer
        open={open}
        onOpenChange={onOpenChange}
        dismiss={dismiss}
        title={title}
        description={description}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                onCancel?.();
                onOpenChange(false);
              }}
            >
              {cancel}
            </Button>
            <Button variant={variant} onClick={onAction}>
              {action}
            </Button>
          </>
        }
      >
        {children}
      </PhoneDrawer>
    );
  }
  return (
    <AlertDialog open={open} onOpenChange={dismissible(dismiss, onOpenChange)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>{cancel}</AlertDialogCancel>
          <Button variant={variant} onClick={onAction}>
            {action}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
