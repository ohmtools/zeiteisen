import type { ReactNode } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CatalogMode } from "@/lib/primitives/catalog";
import type { Step } from "@/lib/media";

function isCatalogMode(value: unknown): value is CatalogMode {
  return CATALOG_MODES.some((mode) => mode === value);
}

// The settings, for this whole device: a panel (sidebar, sheet or page). The
// language first, then own files, the catalog, backup and reset, and about
// (name, version, GitHub, debug info). The catalog mode is picked directly
// and applied at once — nothing passes through "ignore" on the way. Lives in
// the deferred chunk.
export function SettingsPage({
  step,
  onClose,
  ...props
}: DataProps & { step: Step; onClose: () => void }) {
  const { own, ownHint, catalogUrl, backup, elements } = useDataControls(props);
  const mode = props.catalogMode;
  const narrow = step === "narrow";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelHeader
        title={m.tab_settings()}
        onBack={narrow ? onClose : undefined}
        onClose={narrow ? undefined : onClose}
      />
      <div className="flex min-h-0 flex-1 flex-col divide-y overflow-y-auto px-4 pb-[env(safe-area-inset-bottom)] compact:px-6">
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
                  {new Intl.DisplayNames([locale], { type: "language" }).of(locale)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </Group>

        <Group title={m.data_section_own()}>
          <Actions actions={own} />
          {ownHint && <p className="text-xs text-muted-foreground">{ownHint}</p>}
        </Group>

        <Group title={m.data_section_catalog()}>
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
          <p className="text-xs text-muted-foreground">{MODE_TEXT[mode]()}</p>
          <Actions actions={[catalogUrl]} />
        </Group>

        <Group title={m.data_section_backup()}>
          <Actions actions={backup} />
        </Group>

        <Group>
          <div className="flex items-center justify-between gap-2">
            <Brand />
            <GitHubLink className="-mr-2" />
          </div>
          <p className="text-xs text-muted-foreground">{m.footer_note()}</p>
          <DebugButton variant="ghost" className="-mx-2.5 justify-start px-2.5" />
        </Group>
      </div>
      {elements}
    </div>
  );
}

// One section: a title over its controls, divider lines between sections
// (no boxes, user decision), 24px around each.
function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 py-6 first:pt-2">
      {title && <h3 className="text-sm font-semibold">{title}</h3>}
      {children}
    </section>
  );
}

// The settings' rows: ghost buttons flush with the text edge, the note
// trailing.
function Actions({ actions, className }: { actions: DataAction[]; className?: string }) {
  return (
    <div className={cn("-mx-2.5 flex flex-col", className)}>
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
