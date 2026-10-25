// ohmtools/design: shadcn/src/components/ohmtools/popup.tsx (copied by `ohmtools-design add`, do not edit)
import type { ComponentProps } from "react";
import { ResponsiveAlertDialog } from "@/components/ohmtools/responsive-alert-dialog";
import { ResponsiveDialog } from "@/components/ohmtools/responsive-dialog";
import {
  ResponsiveMenu,
  ResponsiveMenuGroup,
  ResponsiveMenuItem,
  ResponsiveMenuSeparator,
} from "@/components/ohmtools/responsive-menu";
import { ResponsivePopover } from "@/components/ohmtools/responsive-popover";
import { ResponsiveSelect } from "@/components/ohmtools/responsive-select";

// The element group "Popup" (DESIGN.md, "Which group" and "Popups"): short,
// once, then back to the content. Always a drawer from the bottom on phones;
// from compact on the popup its `kind` names:
//
//   kind       compact and wide          leaving it
//   menu       a menu at the trigger     closes
//   select     a select's list           closes
//   popover    a popover at the trigger  closes
//   dialog     a centred dialog          runs `onCancel`, or nothing without it
//   question   a centred question        runs Cancel
//
//   <Popup kind="menu" trigger={<Button variant="outline">Example</Button>} title="Examples" checks>
//     <PopupItem checked onSelect={…}>Rectangle</PopupItem>
//   </Popup>
//   <Popup kind="dialog" open={…} onOpenChange={…} onCancel={…} title="Rename" footer={…}>…</Popup>
//   <Popup kind="question" open={…} onOpenChange={…} title="Delete?" action="Delete"
//     destructive cancel="Cancel" onAction={…} />
export type PopupProps<Value extends string = string> =
  | ({ kind: "menu" } & ComponentProps<typeof ResponsiveMenu>)
  | ({ kind: "popover" } & ComponentProps<typeof ResponsivePopover>)
  | ({ kind: "dialog" } & ComponentProps<typeof ResponsiveDialog>)
  | ({ kind: "question" } & ComponentProps<typeof ResponsiveAlertDialog>)
  | ({ kind: "select" } & Parameters<typeof ResponsiveSelect<Value>>[0]);

export function Popup<Value extends string = string>(props: PopupProps<Value>) {
  switch (props.kind) {
    case "menu": {
      const { kind, ...rest } = props;
      return <ResponsiveMenu {...rest} />;
    }
    case "popover": {
      const { kind, ...rest } = props;
      return <ResponsivePopover {...rest} />;
    }
    case "dialog": {
      const { kind, ...rest } = props;
      return <ResponsiveDialog {...rest} />;
    }
    case "question": {
      const { kind, ...rest } = props;
      return <ResponsiveAlertDialog {...rest} />;
    }
    case "select": {
      const { kind, ...rest } = props;
      return <ResponsiveSelect<Value> {...rest} />;
    }
  }
}

// The rows of a `menu`: an action or, with `checks`, one choice.
export const PopupItem = ResponsiveMenuItem;
export const PopupSeparator = ResponsiveMenuSeparator;
export const PopupGroup = ResponsiveMenuGroup;
