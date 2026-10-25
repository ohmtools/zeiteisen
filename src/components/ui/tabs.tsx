// ohmtools/design: shadcn/src/components/ui/tabs.tsx (copied by `ohmtools-design add`, do not edit)
import * as React from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("gap-2 group/tabs flex data-horizontal:flex-col", className)}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "rounded-lg p-[3px] group-data-horizontal/tabs:h-9 data-[variant=line]:rounded-none group/tabs-list inline-flex w-fit items-center justify-center text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  // Hand-edit: the default variant's picked look is one indicator that
  // glides to the active tab (before the tabs, so it paints under them); the
  // tabs themselves stay flat (`src/components/ui/NOTES.md`). Measured here,
  // not with Base UI's `Tabs.Indicator`: that one cost 3 KB gzip of the
  // first load for what `offsetLeft` / `offsetWidth` tell.
  const ref = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState<{ left: number; width: number } | null>(null);
  React.useLayoutEffect(() => {
    const list = ref.current;
    if (!list || variant !== "default") return;
    const measure = () => {
      const tab = list.querySelector<HTMLElement>("[data-slot=tabs-trigger][data-active]");
      setActive((shown) =>
        !tab
          ? null
          : shown?.left === tab.offsetLeft && shown.width === tab.offsetWidth
            ? shown
            : { left: tab.offsetLeft, width: tab.offsetWidth },
      );
    };
    measure();
    // Another tab picked, or a tab or the list changed size (fonts, labels).
    const mutations = new MutationObserver(measure);
    mutations.observe(list, { subtree: true, attributeFilter: ["data-active"] });
    const sizes = new ResizeObserver(measure);
    sizes.observe(list);
    for (const tab of list.children) sizes.observe(tab);
    return () => {
      mutations.disconnect();
      sizes.disconnect();
    };
  }, [variant]);
  return (
    <TabsPrimitive.List
      ref={ref}
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), "relative", className)}
      {...props}
    >
      {variant === "default" && active && (
        <span
          aria-hidden
          data-slot="tabs-indicator"
          className="absolute top-[3px] bottom-[4px] left-0 rounded-md border border-transparent bg-background shadow-sm transition-[translate,width] duration-560 ease-[cubic-bezier(0.2,0,0,1)] dark:border-input dark:bg-input/30"
          style={{ width: active.width, translate: `${active.left}px` }}
        />
      )}
      {children}
    </TabsPrimitive.List>
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg:not([class*='size-'])]:size-4 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:text-foreground dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("text-sm flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
