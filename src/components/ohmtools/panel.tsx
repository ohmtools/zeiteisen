// ohmtools/design: shadcn/src/components/ohmtools/panel.tsx (copied by `ohmtools-design add`, do not edit)
import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PanelHeader } from "@/components/ohmtools/panel-header";
import { PanelSheet } from "@/components/ohmtools/panel-sheet";
import { usePage, useShell } from "@/components/ohmtools/app-shell";
import { transition } from "@/lib/ohmtools/motion";
import { currentStep, useStep } from "@/lib/ohmtools/steps";

// The element group "Panel" (DESIGN.md, "Which group"): used beside the
// content, for longer and again and again. A page of its own on phones (back
// arrow), a sheet from the right over the content on compact screens, a
// closable sidebar beside the content on wide screens. Open one panel at a
// time; `usePanel()` holds the state and moves it the design's way. A sub
// view of the panel (zeiteisen's category) passes `onBack`: its back arrow
// shows on every step and returns to the panel's main view.
export function Panel({
  open,
  onClose,
  onBack,
  title,
  subtitle,
  actions,
  initialFocus = true,
  closeLabel = "Close",
  backLabel = "Back",
  children,
}: {
  open: boolean;
  onClose: () => void;
  // A sub view is shown: back to the panel's main view.
  onBack?: () => void;
  title: string;
  subtitle?: string;
  // Icon buttons beside the title.
  actions?: ReactNode;
  // `false`: the compact sheet leaves the focus to the panel, which takes
  // it on its own (a text area opened by a shortcut).
  initialFocus?: boolean;
  closeLabel?: string;
  backLabel?: string;
  // The panel's content; it scrolls inside the panel.
  children: ReactNode;
}) {
  const step = useStep();
  const { slots } = useShell();
  usePage(open && step === "narrow");

  const body = (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] compact:px-6">
      {children}
    </div>
  );
  if (step === "compact") {
    return (
      <PanelSheet open={open} initialFocus={initialFocus} onClose={onClose}>
        <PanelHeader
          title={title}
          subtitle={subtitle}
          actions={actions}
          onBack={onBack}
          backLabel={backLabel}
          onClose={onClose}
          closeLabel={closeLabel}
        />
        {body}
      </PanelSheet>
    );
  }
  const target = slots[step === "wide" ? "sidebar" : "page"];
  if (!open || !target) return null;
  return createPortal(
    <>
      <PanelHeader
        title={title}
        subtitle={subtitle}
        actions={actions}
        backLabel={backLabel}
        {...(step === "wide" ? { onBack, onClose, closeLabel } : { onBack: onBack ?? onClose })}
      />
      {body}
    </>,
    target,
  );
}

export type OpenState = {
  open: boolean;
  show: () => void;
  hide: () => void;
  toggle: () => void;
};

// Open state for a panel, moved the design's way: on wide screens the
// sidebar slides in from the right, on phones the page comes in from the
// right and goes back to it; a compact sheet moves on its own.
export function usePanel(initial = false): OpenState {
  return useOpenState(initial, (step, next) =>
    step === "wide" ? "panel" : step === "narrow" ? (next ? "forward" : "back") : null,
  );
}

// The same for an area: its pages on phones and compact screens come in from
// the right; on wide screens it is a dialog, which moves on its own.
export function useArea(initial = false): OpenState {
  return useOpenState(initial, (step, next) =>
    step === "wide" ? null : next ? "forward" : "back",
  );
}

function useOpenState(
  initial: boolean,
  kindOf: (step: ReturnType<typeof currentStep>, next: boolean) => string | null,
): OpenState {
  const [open, setOpen] = useState(initial);
  const change = (next: boolean) => {
    if (next === open) return;
    const kind = kindOf(currentStep(), next);
    if (kind) transition(kind, () => setOpen(next));
    else setOpen(next);
  };
  return {
    open,
    show: () => change(true),
    hide: () => change(false),
    toggle: () => change(!open),
  };
}
