import { useId, useState, type ReactElement, type ReactNode } from "react";
import { m } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MODE_ICON,
  MODE_NAME,
  MODE_TEXT,
  useDataControls,
  type DataAction,
  type DataProps,
} from "@/components/DataControls";
import type { CatalogMode } from "@/lib/primitives/catalog";

type TriggerProps = {
  // The trigger's element (`render`) and its content.
  trigger: ReactElement;
  children: ReactNode;
};

// The desktop footer's "Data" menu: everything about the data on this device
// that is no profile's business. Where dates, locations and degrees come from
// (the catalog or the user's own files), how the catalog is used and where it
// is read from, and the backup of it all — one headed group each. Phones get
// the same as the Settings page. Lives in the deferred
// chunk; App shows a disabled look-alike trigger until it arrives.
export function DataMenu({ trigger, children, ...props }: DataProps & TriggerProps) {
  const { own, ownHint, catalogUrl, backup, elements } = useDataControls(props);
  // "Catalog" cycles a pending mode while the menu is open; it is applied when
  // the menu closes. Applied on every click, getting from freeze back to auto
  // would pass through ignore, which drops the cached catalog and its dates.
  const [pendingMode, setPendingMode] = useState<CatalogMode | null>(null);
  const shownMode = pendingMode ?? props.catalogMode;
  const ModeIcon = MODE_ICON[shownMode];
  const modeTextId = useId();

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          if (open || pendingMode === null) return;
          if (pendingMode !== props.catalogMode) props.onCatalogMode(pendingMode);
          setPendingMode(null);
        }}
      >
        <DropdownMenuTrigger render={trigger}>{children}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{m.data_section_own()}</DropdownMenuLabel>
            {own.map((action) => (
              <ActionItem key={action.key} action={action} />
            ))}
            {ownHint && <MenuText>{ownHint}</MenuText>}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>{m.data_section_catalog()}</DropdownMenuLabel>
            {/* Cycles ignore → auto-update → freeze and stays open, so the
                line below explains each mode as it comes up; the mode shown
                when the menu closes is the one applied. */}
            <DropdownMenuItem
              closeOnClick={false}
              aria-describedby={modeTextId}
              onClick={() => setPendingMode(NEXT_MODE[shownMode])}
            >
              <ModeIcon data-icon="inline-start" />
              {m.catalog_mode()}
              <Note>{MODE_NAME[shownMode]()}</Note>
            </DropdownMenuItem>
            <MenuText id={modeTextId}>{MODE_TEXT[shownMode]()}</MenuText>
            <ActionItem action={catalogUrl} />
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>{m.data_section_backup()}</DropdownMenuLabel>
            {backup.map((action) => (
              <ActionItem key={action.key} action={action} />
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {elements}
    </>
  );
}

const NEXT_MODE: Record<CatalogMode, CatalogMode> = {
  ignore: "auto",
  auto: "freeze",
  freeze: "ignore",
};

function ActionItem({ action }: { action: DataAction }) {
  const Icon = action.icon;
  return (
    <DropdownMenuItem
      disabled={action.disabled}
      variant={action.destructive ? "destructive" : "default"}
      onClick={action.onSelect}
    >
      <Icon data-icon="inline-start" />
      {action.label}
      {action.note && <Note>{action.note}</Note>}
    </DropdownMenuItem>
  );
}

// The muted trailing note of a menu item: what is in use right now.
function Note({ children }: { children: ReactNode }) {
  return <span className="ml-auto pl-4 text-xs text-muted-foreground">{children}</span>;
}

// An explanation between the items: a group label's look, but no label — Base
// UI makes the last `GroupLabel` of a group its name, and that is the header.
function MenuText({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <div id={id} className="max-w-64 px-3 py-2 text-xs text-muted-foreground">
      {children}
    </div>
  );
}
