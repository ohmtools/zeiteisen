import type { ReactNode } from "react";
import { Archive, FolderOpen, Info, Library, Settings2, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { getLocale, locales, m, setLocale } from "@/i18n";
import { Brand } from "@/components/Brand";
import { DebugButton } from "@/components/DebugDialog";
import {
  CATALOG_MODES,
  MODE_OPTION,
  MODE_TEXT,
  useDataControls,
  type DataAction,
  type DataProps,
} from "@/components/DataControls";
import { Area, type AreaSection } from "@/components/ohmtools/area";
import { GitHubLink } from "@/components/ohmtools/github-link";
import { LanguageTabs, languageName } from "@/components/ohmtools/settings";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CatalogMode } from "@/lib/primitives/catalog";

const REPO_URL = "https://github.com/ohmtools/zeiteisen";

function isCatalogMode(value: unknown): value is CatalogMode {
  return CATALOG_MODES.some((mode) => mode === value);
}

// The settings, for this whole device, in sections (user decision: room for
// more settings later), an area (`Area`): on wide screens a dialog with the
// sections on the left, on phones and compact screens a page listing them,
// each a page of its own. Never a panel: groups and notes are the panels.
// Lives in the deferred chunk.
type Section = "general" | "files" | "catalog" | "backup" | "about";

const SECTIONS: readonly { key: Section; icon: LucideIcon; label: () => string }[] = [
  { key: "general", icon: Settings2, label: m.settings_general },
  { key: "files", icon: FolderOpen, label: m.data_section_own },
  { key: "catalog", icon: Library, label: m.data_section_catalog },
  { key: "backup", icon: Archive, label: m.data_section_backup },
  { key: "about", icon: Info, label: m.settings_about },
];

type Controls = ReturnType<typeof useDataControls>;

export function Settings({
  open,
  onClose,
  ...props
}: DataProps & { open: boolean; onClose: () => void }) {
  const controls = useDataControls(props);
  const own = controls.ownCount;
  // What is set now, at the right of a section's row on the page.
  const value: Record<Section, ReactNode> = {
    general: languageName(getLocale()),
    files: own === 0 ? null : own === 1 ? m.data_own_file() : m.data_own_files({ count: own }),
    catalog: MODE_OPTION[props.catalogMode](),
    backup: null,
    about: <span className="font-mono text-xs">v{__APP_VERSION__}</span>,
  };
  const sections: AreaSection[] = SECTIONS.map(({ key, icon, label }) => ({
    key,
    icon,
    label: label(),
    value: value[key],
    content: (
      <>
        {/* The section's dialogs and file inputs, inside the settings so
            their dialogs stand over them (first, out of the divider lines). */}
        <div className="hidden">{controls.elements}</div>
        <SectionBody section={key} controls={controls} props={props} />
      </>
    ),
  }));

  return (
    <Area
      open={open}
      onClose={onClose}
      title={m.tab_settings()}
      sections={sections}
      closeLabel={m.panel_close()}
      backLabel={m.panel_back()}
    />
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
          <LanguageTabs
            locales={locales}
            value={getLocale()}
            onChange={(locale) => void setLocale(locale)}
            label={m.language_label()}
          />
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
            <GitHubLink href={REPO_URL} label={m.source_code()} className="-mr-2" />
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
