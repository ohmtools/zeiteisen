// ohmtools/design: shadcn/src/components/ohmtools/settings.tsx (copied by `ohmtools-design add`, do not edit)
import { useState, type ReactNode } from "react";
import { ChevronRight, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PanelHeader } from "@/components/ohmtools/panel-header";
import { transition } from "@/lib/ohmtools/motion";

// The settings in sections, the same sections on every step (DESIGN.md,
// "Settings"): "General" first, "About" last. On wide screens a dialog with
// the sections on the left (`SettingsDialog`); on phones and compact screens
// a page listing the sections, each a page of its own (`SettingsPage`),
// shown in place of the view. Groups within a section are split by lines:
// give each its own element, the section draws the lines between them.
export type SettingsSection = {
  key: string;
  icon: LucideIcon;
  label: string;
  // What is set now, muted at the right of the page's row (the language,
  // the version in mono).
  value?: ReactNode;
  content: ReactNode;
};

type Labels = { title: string; closeLabel?: string; backLabel?: string };

// Wide screens: a dialog of up to 1000×720, the sections on the left, the
// open one on the right with the close button, scrolling inside the dialog.
export function SettingsDialog({
  open,
  onClose,
  sections,
  title,
  closeLabel = "Close",
}: Labels & { open: boolean; onClose: () => void; sections: readonly SettingsSection[] }) {
  const [key, setKey] = useState(sections[0]?.key);
  const section = sections.find((one) => one.key === key) ?? sections[0];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(45rem,calc(100dvh-3rem))] gap-0 overflow-hidden p-0 short:h-[calc(100dvh-1.5rem)] compact:max-w-[min(62.5rem,calc(100%-3rem-env(safe-area-inset-left)-env(safe-area-inset-right)))] compact:p-0"
      >
        <nav
          aria-label={title}
          className="relative flex w-60 shrink-0 flex-col gap-0.5 overflow-y-auto border-r px-3 py-5 short:w-46 short:px-2 short:py-3"
        >
          <DialogTitle className="mb-3.5 px-2.5 pt-1.5 text-base leading-6 font-semibold short:mb-2">
            {title}
          </DialogTitle>
          {sections.map(({ key: one, icon: Icon, label }) => (
            <Button
              key={one}
              variant="ghost"
              aria-current={one === section?.key ? "page" : undefined}
              className="w-full justify-start px-2.5 aria-[current=page]:bg-accent aria-[current=page]:font-semibold"
              onClick={() => setKey(one)}
            >
              <Icon data-icon="inline-start" className="text-muted-foreground" />
              <span className="truncate">{label}</span>
            </Button>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 pt-5 pr-4 pl-6 short:pt-3 short:pr-2 short:pl-5">
            <h3 className="truncate pt-1.5 text-base leading-6 font-semibold">{section?.label}</h3>
            <DialogClose render={<Button variant="ghost" size="icon" aria-label={closeLabel} />}>
              <X />
            </DialogClose>
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col divide-y overflow-y-auto px-6 short:px-5">
            {section?.content}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Phones and compact screens: a page listing the sections as 56px rows, each
// with what is set now, and each section a page of its own one level deeper
// (back goes to the list, the list's back closes the settings). The pages
// come in by the view transitions `forward` and `back`.
export function SettingsPage({
  onClose,
  sections,
  title,
  backLabel = "Back",
}: Labels & { onClose: () => void; sections: readonly SettingsSection[] }) {
  const [key, setKey] = useState<string | null>(null);
  const section = sections.find((one) => one.key === key);
  const go = (next: string | null) =>
    transition(next === null ? "back" : "forward", () => setKey(next));

  if (!section) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PanelHeader title={title} onBack={onClose} backLabel={backLabel} />
        <nav aria-label={title} className="relative min-h-0 flex-1 overflow-y-auto pt-2">
          <ul>
            {sections.map(({ key: one, icon: Icon, label, value }) => (
              <li key={one} className="group">
                <button
                  type="button"
                  className="flex h-14 w-full items-center gap-3.5 pl-4 text-left text-[0.9375rem] font-medium outline-none hover:bg-accent focus-visible:bg-accent active:bg-accent compact:pl-6"
                  onClick={() => go(one)}
                >
                  <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                  <span className="flex h-full min-w-0 flex-1 items-center gap-2 border-b pr-4 group-last:border-b-0 compact:pr-6">
                    <span className="flex-1 truncate">{label}</span>
                    {value && (
                      <span className="shrink-0 text-[0.8125rem] font-normal text-muted-foreground">
                        {value}
                      </span>
                    )}
                    <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelHeader title={section.label} onBack={() => go(null)} backLabel={backLabel} />
      <div className="relative flex min-h-0 flex-1 flex-col divide-y overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)] compact:px-6">
        {section.content}
      </div>
    </div>
  );
}

// The language switch under "General": tabs, each language named in itself
// (English, Deutsch). The only place to switch the language.
export function LanguageTabs<Locale extends string>({
  locales,
  value,
  onChange,
  label,
}: {
  locales: readonly Locale[];
  value: Locale;
  onChange: (locale: Locale) => void;
  // The tab list's accessible name ("Language").
  label: string;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const locale = locales.find((one) => one === next);
        if (locale && locale !== value) onChange(locale);
      }}
    >
      <TabsList aria-label={label} className="h-9 w-full">
        {locales.map((locale) => (
          <TabsTrigger key={locale} value={locale} lang={locale}>
            {languageName(locale)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

// A language named in itself: "de" -> "Deutsch".
export function languageName(locale: string): string {
  return new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
}
