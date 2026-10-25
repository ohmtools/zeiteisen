// ohmtools/design: shadcn/src/components/ohmtools/responsive-menu.tsx (copied by `ohmtools-design add`, do not edit)
import { cloneElement, createContext, useContext, type ReactElement, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PhoneDrawer, useOpenState } from "@/components/ohmtools/phone-drawer";
import { useStep } from "@/lib/ohmtools/steps";

// A list of actions or one choice that closes once picked (DESIGN.md, "Which
// popup"): a drawer from the bottom with 44px rows on phones, a menu at the
// trigger from compact on. Closing loses nothing, so a swipe down, a press
// outside and Esc close it.
//
//   <ResponsiveMenu trigger={<Button variant="outline">Example</Button>} title="Examples">
//     <ResponsiveMenuItem checked onSelect={…}>Rectangle</ResponsiveMenuItem>
//   </ResponsiveMenu>

type MenuContext = { narrow: boolean; close: () => void; checks: boolean };

const Context = createContext<MenuContext>({ narrow: false, close: () => {}, checks: false });

export function ResponsiveMenu({
  trigger,
  open,
  onOpenChange,
  title,
  titleHidden = false,
  checks = false,
  align = "start",
  className,
  children,
}: {
  trigger: ReactElement<Record<string, unknown>>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // The drawer's heading on phones; the menu's accessible name.
  title: string;
  titleHidden?: boolean;
  // A choice: every item keeps room for the tick of the picked one.
  checks?: boolean;
  align?: "start" | "center" | "end";
  className?: string;
  children: ReactNode;
}) {
  const narrow = useStep() === "narrow";
  const [shown, setShown] = useOpenState(open, onOpenChange);
  const context = { narrow, close: () => setShown(false), checks };

  if (narrow) {
    return (
      <Context.Provider value={context}>
        {cloneElement(trigger, {
          "aria-haspopup": "dialog",
          "aria-expanded": shown,
          onClick: () => setShown(true),
        })}
        <PhoneDrawer
          open={shown}
          onOpenChange={setShown}
          dismiss="close"
          title={title}
          titleHidden={titleHidden}
          className={cn("gap-2", className)}
        >
          <ul className="-mx-2 flex flex-col">{children}</ul>
        </PhoneDrawer>
      </Context.Provider>
    );
  }
  return (
    <Context.Provider value={context}>
      <DropdownMenu open={shown} onOpenChange={setShown}>
        <DropdownMenuTrigger render={trigger} />
        <DropdownMenuContent align={align} aria-label={title} className={cn("w-auto", className)}>
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </Context.Provider>
  );
}

export function ResponsiveMenuItem({
  onSelect,
  checked,
  destructive = false,
  disabled = false,
  icon,
  children,
}: {
  onSelect: () => void;
  // In a choice (`checks`): whether this is the picked one.
  checked?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  // A lucide icon before the label.
  icon?: ReactNode;
  children: ReactNode;
}) {
  const { narrow, close, checks } = useContext(Context);
  const lead = checks ? (
    checked ? (
      <Check data-icon="inline-start" />
    ) : (
      <span aria-hidden className="size-4 shrink-0" />
    )
  ) : (
    icon
  );

  if (narrow) {
    return (
      <li>
        <Button
          variant="ghost"
          disabled={disabled}
          aria-current={checked || undefined}
          className={cn(
            "h-11 w-full justify-start px-2 font-normal",
            destructive && "text-destructive hover:text-destructive",
          )}
          onClick={() => {
            onSelect();
            close();
          }}
        >
          {lead}
          {children}
        </Button>
      </li>
    );
  }
  return (
    <DropdownMenuItem
      variant={destructive ? "destructive" : "default"}
      disabled={disabled}
      aria-current={checked || undefined}
      onClick={onSelect}
    >
      {lead}
      {children}
    </DropdownMenuItem>
  );
}

export function ResponsiveMenuSeparator() {
  const { narrow } = useContext(Context);
  if (narrow) return <li role="separator" className="mx-2 my-1 border-t" />;
  return <DropdownMenuSeparator />;
}

// Items under a muted heading.
export function ResponsiveMenuGroup({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  const { narrow } = useContext(Context);
  if (narrow) {
    return (
      <li>
        <div className="px-2 pt-2 pb-1 text-xs text-muted-foreground">{label}</div>
        <ul className="flex flex-col">{children}</ul>
      </li>
    );
  }
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      {children}
    </DropdownMenuGroup>
  );
}
