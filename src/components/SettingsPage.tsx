import { useState, type ReactNode } from "react";
import {
  Archive,
  ChevronRight,
  FolderOpen,
  Info,
  Library,
  Settings2,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { getLocale, locales, m, setLocale } from "@/i18n";
import { Brand } from "@/components/Brand";
import { DebugButton } from "@/components/DebugDialog";
import { GitHubLink } from "@/components/GitHubLink";
import { PanelHeader } from "@/components/PanelHeader";
import {
  CATALOG_MODES,
  MODE_OPTION,
  MODE_TEXT,
  useDataControls,
  type DataAction,
  type DataProps,
} from "@/components/DataControls";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CatalogMode } from "@/lib/primitives/catalog";
import { transition } from "@/lib/motion";

function isCatalogMode(value: unknown): value is CatalogMode {
  return CATALOG_MODES.some((mode) => mode === value);
}

// The settings, for this whole device, in sections (user decision: room for
// more settings later). Every step shows the same sections: a dialog with the
// sections on the left from compact on (`SettingsDialog`), on phones a page
// listing them, each a page of its own (`SettingsPage`). Never a sidebar:
// groups and notes are the panels. Lives in the deferred chunk.
type Section = "general" | "files" | "catalog" | "backup" | "about";

const SECTIONS: readonly { key: Section; icon: LucideIcon; label: () => string }[] = [
  { key: "general", icon: Settings2, label: m.settings_general },
  { key: "files", icon: FolderOpen, label: m.data_section_own },
  { key: "catalog", icon: Library, label: m.data_section_catalog },
  { key: "backup", icon: Archive, label: m.data_section_backup },
  { key: "about", icon: Info, label: m.settings_about },
];

function labelOf(section: Section): string {
  return SECTIONS.find(({ key }) => key === section)?.label() ?? "";
}

function languageName(locale: string): string {
  return new Intl.DisplayNames([locale], { type: "language" }).of(locale) ?? locale;
}

type Controls = ReturnType<typeof useDataControls>;

// Compact and wide: a dialog, the sections on the left, the picked one on
// the right with the close button. As large as a short landscape screen
// allows; the section scrolls inside it.
export function SettingsDialog({
  open,
  onClose,
  ...props
}: DataProps & { open: boolean; onClose: () => void }) {
  const [section, setSection] = useState<Section>("general");
  const controls = useDataControls(props);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(35rem,calc(100dvh-1.5rem))] gap-0 overflow-hidden p-0 compact:max-w-[min(47.5rem,calc(100%-2rem-env(safe-area-inset-left)-env(safe-area-inset-right)))] compact:p-0"
      >
        <nav
          aria-label={m.tab_settings()}
          className="flex w-54 shrink-0 flex-col gap-0.5 overflow-y-auto border-r px-3 py-5 short:w-46 short:px-2 short:py-3"
        >
          <DialogTitle className="mb-3.5 px-2.5 pt-1.5 text-base leading-6 font-semibold short:mb-2">
            {m.tab_settings()}
          </DialogTitle>
          {SECTIONS.map(({ key, icon: Icon, label }) => (
            <Button
              key={key}
              variant="ghost"
              aria-current={key === section ? "page" : undefined}
              className="w-full justify-start px-2.5 aria-[current=page]:bg-accent aria-[current=page]:font-semibold"
              onClick={() => setSection(key)}
            >
              <Icon data-icon="inline-start" className="text-muted-foreground" />
              <span className="truncate">{label()}</span>
            </Button>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 pt-5 pr-4 pl-6 short:pt-3 short:pr-2 short:pl-5">
            <h3 className="truncate pt-1.5 text-base leading-6 font-semibold">
              {labelOf(section)}
            </h3>
            <DialogClose
              render={<Button variant="ghost" size="icon" aria-label={m.panel_close()} />}
            >
              <X />
            </DialogClose>
          </div>
          <div className="flex min-h-0 flex-1 flex-col divide-y overflow-y-auto px-6 short:px-5">
            <SectionBody section={section} controls={controls} props={props} />
          </div>
        </div>
        {controls.elements}
      </DialogContent>
    </Dialog>
  );
}

// Phones: a page listing the sections, each with what is set now, and each
// section a page of its own one level deeper (back goes to the list, the
// list's back to the grid).
export function SettingsPage({ onClose, ...props }: DataProps & { onClose: () => void }) {
  const [section, setSection] = useState<Section | null>(null);
  const controls = useDataControls(props);
  const go = (next: Section | null) =>
    transition(next === null ? "back" : "forward", () => setSection(next));

  const own = controls.ownCount;
  const value: Record<Section, ReactNode> = {
    general: languageName(getLocale()),
    files: own === 0 ? null : own === 1 ? m.data_own_file() : m.data_own_files({ count: own }),
    catalog: MODE_OPTION[props.catalogMode](),
    backup: null,
    about: <span className="font-mono text-xs">v{__APP_VERSION__}</span>,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {section === null ? (
        <>
          <PanelHeader title={m.tab_settings()} onBack={onClose} />
          <nav aria-label={m.tab_settings()} className="min-h-0 flex-1 overflow-y-auto pt-2">
            <ul>
              {SECTIONS.map(({ key, icon: Icon, label }) => (
                <li key={key} className="group">
                  <button
                    type="button"
                    className="flex h-14 w-full items-center gap-3.5 pl-4 text-left text-[0.9375rem] font-medium outline-none hover:bg-accent focus-visible:bg-accent active:bg-accent"
                    onClick={() => go(key)}
                  >
                    <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                    <span className="flex h-full min-w-0 flex-1 items-center gap-2 border-b pr-4 group-last:border-b-0">
                      <span className="flex-1 truncate">{label()}</span>
                      {value[key] && (
                        <span className="shrink-0 text-[0.8125rem] font-normal text-muted-foreground">
                          {value[key]}
                        </span>
                      )}
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </>
      ) : (
        <>
          <PanelHeader title={labelOf(section)} onBack={() => go(null)} />
          <div className="flex min-h-0 flex-1 flex-col divide-y overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)]">
            <SectionBody section={section} controls={controls} props={props} />
          </div>
        </>
      )}
      {controls.elements}
    </div>
  );
}

// One section's content, the same in dialog and page.
function SectionBody({
  section,
  controls,
  props,
}: {
  section: Section;
  controls: Controls;
  props: DataProps;
}) {
  const mode = props.catalogMode;
  switch (section) {
    case "general":
      return (
        <Group title={m.language_label()}>
          {/* Languages are named in themselves, the way a lost reader finds
              theirs. */}
          <Tabs
            value={getLocale()}
            onValueChange={(value) => {
              const locale = locales.find((one) => one === value);
              if (locale && locale !== getLocale()) void setLocale(locale);
            }}
          >
            <TabsList aria-label={m.language_label()} className="h-9 w-full">
              {locales.map((locale) => (
                <TabsTrigger key={locale} value={locale} lang={locale}>
                  {languageName(locale)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Hint>{m.settings_theme_hint()}</Hint>
        </Group>
      );
    case "files":
      return (
        <>
          <Group>
            <Actions actions={controls.own} />
            {controls.ownHint && <Hint>{controls.ownHint}</Hint>}
          </Group>
          <Group>
            <Actions actions={[controls.skill]} />
            <Hint>{m.settings_skill_hint()}</Hint>
          </Group>
        </>
      );
    case "catalog":
      return (
        <>
          <Group title={m.catalog_mode()}>
            <Tabs
              value={mode}
              onValueChange={(next) => {
                if (isCatalogMode(next) && next !== mode) props.onCatalogMode(next);
              }}
            >
              <TabsList aria-label={m.catalog_mode()} className="h-9 w-full">
                {CATALOG_MODES.map((one) => (
                  <TabsTrigger key={one} value={one}>
                    {MODE_OPTION[one]()}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Hint>{MODE_TEXT[mode]()}</Hint>
          </Group>
          <Group title={m.catalog_source()}>
            <Actions actions={[controls.catalogUrl]} />
          </Group>
        </>
      );
    case "backup":
      return (
        <>
          <Group>
            <Actions actions={controls.backup} />
            <Hint>{m.settings_backup_hint()}</Hint>
          </Group>
          <Group>
            <Actions actions={[controls.erase]} />
          </Group>
        </>
      );
    case "about":
      return (
        <Group>
          <div className="flex items-center justify-between gap-2">
            <Brand />
            <GitHubLink className="-mr-2" />
          </div>
          <Hint>{m.footer_note()}</Hint>
          <DebugButton variant="ghost" className="-mx-2.5 justify-start px-2.5" />
        </Group>
      );
  }
}

// One group: an optional title over its controls, divider lines between
// groups (no boxes, user decision), 24px around each.
function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 py-6 first:pt-2 compact:first:pt-4">
      {title && <h4 className="text-sm font-semibold">{title}</h4>}
      {children}
    </section>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

// The settings' rows: ghost buttons flush with the text edge, the note
// trailing.
function Actions({ actions }: { actions: DataAction[] }) {
  return (
    <div className="-mx-2.5 flex flex-col">
      {actions.map(({ key, icon: Icon, label, note, disabled, destructive, onSelect }) => (
        <Button
          key={key}
          variant="ghost"
          className={cn("w-full justify-start px-2.5", destructive && "text-destructive")}
          disabled={disabled}
          onClick={onSelect}
        >
          <Icon data-icon="inline-start" />
          <span className="truncate">{label}</span>
          {note && (
            <span className="ml-auto pl-4 text-xs font-normal text-muted-foreground">{note}</span>
          )}
        </Button>
      ))}
    </div>
  );
}
