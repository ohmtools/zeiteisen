// ohmtools/design: shadcn/src/components/ohmtools/area.tsx (copied by `ohmtools-design add`, do not edit)
import { createPortal } from "react-dom";
import { usePage, useShell } from "@/components/ohmtools/app-shell";
import { SettingsDialog, SettingsPage, type SettingsSection } from "@/components/ohmtools/settings";
import { useStep } from "@/lib/ohmtools/steps";

export type AreaSection = SettingsSection;

// The element group "Area" (DESIGN.md, "Which group"): an area of its own
// with sections, visited rarely (the settings). A page listing the sections,
// each a page of its own, on phones and compact screens; a large dialog with
// the sections on the left on wide screens. `useArea()` holds the state.
export function Area({
  open,
  onClose,
  title,
  sections,
  closeLabel = "Close",
  backLabel = "Back",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sections: readonly AreaSection[];
  closeLabel?: string;
  backLabel?: string;
}) {
  const wide = useStep() === "wide";
  const target = useShell().slots.page;
  usePage(open && !wide);

  if (wide) {
    return (
      <SettingsDialog
        open={open}
        onClose={onClose}
        title={title}
        sections={sections}
        closeLabel={closeLabel}
      />
    );
  }
  if (!open || !target) return null;
  return createPortal(
    <SettingsPage onClose={onClose} title={title} sections={sections} backLabel={backLabel} />,
    target,
  );
}
