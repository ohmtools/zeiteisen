import { cn } from "cn";
import { getLocale, locales, m, setLocale } from "@/i18n";
import { Brand } from "@/components/Brand";
import {
  CATALOG_MODES,
  MODE_ICON,
  MODE_OPTION,
  MODE_TEXT,
  useDataControls,
  type DataAction,
  type DataProps,
} from "@/components/DataControls";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CatalogMode } from "@/lib/primitives/catalog";

function isCatalogMode(value: string | undefined): value is CatalogMode {
  return CATALOG_MODES.some((mode) => mode === value);
}

// The phones' Settings tab: the language first, then the desktop footer's
// Data menu as a page, one section each (own files, catalog, backup), then the
// footer's name and note. Unlike the menu, the catalog
// mode is picked directly and applied at once — nothing passes through
// "ignore" on the way. Lives in the deferred chunk.
export function SettingsPage({ className, ...props }: DataProps & { className?: string }) {
  const { own, ownHint, catalogUrl, backup, elements } = useDataControls(props);
  const mode = props.catalogMode;

  // The inputs and dialogs stay out of the sections' list: `divide-y` would
  // draw a line under the last section for them.
  return (
    <>
      <div className={cn("flex flex-col divide-y", className)}>
        <Section>
          <CardHeader>
            <CardTitle>{m.language_label()}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Languages are named in themselves, the way a lost reader finds
              theirs. */}
            <ToggleGroup
              variant="outline"
              spacing={0}
              className="w-full"
              aria-label={m.language_label()}
              value={[getLocale()]}
              onValueChange={([value]) => {
                const locale = locales.find((one) => one === value);
                if (locale) void setLocale(locale);
              }}
            >
              {locales.map((locale) => (
                <ToggleGroupItem key={locale} value={locale} lang={locale} className="flex-1">
                  {new Intl.DisplayNames([locale], { type: "language" }).of(locale)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </CardContent>
        </Section>

        <Section>
          <CardHeader>
            <CardTitle>{m.data_section_own()}</CardTitle>
            {ownHint && <CardDescription>{ownHint}</CardDescription>}
          </CardHeader>
          <CardContent>
            <Actions actions={own} />
          </CardContent>
        </Section>

        <Section>
          <CardHeader>
            <CardTitle>{m.data_section_catalog()}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <ToggleGroup
              variant="outline"
              orientation="vertical"
              spacing={0}
              className="w-full"
              aria-label={m.catalog_mode()}
              value={[mode]}
              onValueChange={([next]) => {
                if (isCatalogMode(next) && next !== mode) props.onCatalogMode(next);
              }}
            >
              {CATALOG_MODES.map((one) => {
                const Icon = MODE_ICON[one];
                return (
                  <ToggleGroupItem key={one} value={one} className="justify-start">
                    <Icon data-icon="inline-start" />
                    {MODE_OPTION[one]()}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
            <p className="text-muted-foreground">{MODE_TEXT[mode]()}</p>
            <Actions actions={[catalogUrl]} className="mt-2" />
          </CardContent>
        </Section>

        <Section>
          <CardHeader>
            <CardTitle>{m.data_section_backup()}</CardTitle>
          </CardHeader>
          <CardContent>
            <Actions actions={backup} />
          </CardContent>
        </Section>

        <Section>
          <CardHeader>
            <CardTitle>{m.data_section_about()}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Brand />
            <p className="text-muted-foreground">{m.footer_note()}</p>
          </CardContent>
        </Section>
      </div>
      {elements}
    </>
  );
}

// The page's form of menu items: full-width buttons, the note trailing.
function Actions({ actions, className }: { actions: DataAction[]; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {actions.map(({ key, icon: Icon, label, note, disabled, destructive, onSelect }) => (
        <Button
          key={key}
          variant={destructive ? "destructive" : "outline"}
          className="w-full justify-start"
          disabled={disabled}
          onClick={onSelect}
        >
          <Icon data-icon="inline-start" />
          <span className="truncate">{label}</span>
          {note && <span className="ml-auto pl-4 font-normal text-muted-foreground">{note}</span>}
        </Button>
      ))}
    </div>
  );
}
