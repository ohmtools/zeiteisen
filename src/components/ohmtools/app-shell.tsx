// ohmtools/design: shadcn/src/components/ohmtools/app-shell.tsx (copied by `ohmtools-design add`, do not edit)
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { AppToaster } from "@/components/ohmtools/app-toaster";
import { ThemeProvider } from "@/components/ohmtools/theme-provider";
import { bottomBar } from "@/lib/ohmtools/bottom-bar-height";
import { useMedia, useStep, SHORT_QUERY } from "@/lib/ohmtools/steps";

// The app shell of DESIGN.md, "App shell": one viewport tall, a header, the
// content, a sidebar on wide screens, a bar at the bottom on phones, pages
// of their own over everything. The element groups place themselves into it
// (`Views`, `ViewControls`, `Panel`, `Area`): an app says what it shows, the
// shell and the groups pick where, per step.

type Slot = "views" | "bar" | "sidebar" | "page";

type Shell = {
  slots: Partial<Record<Slot, HTMLElement>>;
  // A page of its own is open: the rest of the shell is inert under it.
  addPage: () => () => void;
};

const ShellContext = createContext<Shell | null>(null);

export function useShell(): Shell {
  const shell = useContext(ShellContext);
  if (!shell) throw new Error("An element group needs an <AppShell> around it.");
  return shell;
}

// Marks a page of its own as open while `active`.
export function usePage(active: boolean) {
  const { addPage } = useShell();
  useEffect(() => (active ? addPage() : undefined), [active, addPage]);
}

// The shell's place for pages of its own, marked as open while `active`;
// `null` outside an `AppShell` (a popup on an error screen), where the caller
// falls back to another element.
export function usePageSlot(active: boolean): HTMLElement | null {
  const shell = useContext(ShellContext);
  const addPage = shell?.addPage;
  useEffect(() => (active && addPage ? addPage() : undefined), [active, addPage]);
  return shell?.slots.page ?? null;
}

export function AppShell({
  title,
  brand,
  actions,
  className,
  children,
}: {
  // The app's name: the page's one <h1>, for screen readers.
  title: string;
  // Left in the header: the app tile with the name, or what the view
  // belongs to (a profile).
  brand: ReactNode;
  // Right in the header: the panels' icon buttons, the settings last.
  actions?: ReactNode;
  className?: string;
  // The content. The element groups go anywhere inside.
  children: ReactNode;
}) {
  const step = useStep();
  const short = useMedia(SHORT_QUERY);
  const [slots, setSlots] = useState<Shell["slots"]>({});
  const [pages, setPages] = useState(0);
  const header = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const viewsRef = useRef<HTMLDivElement | null>(null);
  // One stable ref per slot: a new function each render would unset and
  // set the slot again, a state change every render.
  const refs = useMemo(() => {
    const set = (name: Slot, element: HTMLElement | undefined) =>
      setSlots((current) =>
        current[name] === element ? current : { ...current, [name]: element },
      );
    const ref = (name: Slot) => (element: HTMLElement | null) => {
      if (!element) return;
      set(name, element);
      return () => set(name, undefined);
    };
    return {
      views: (element: HTMLDivElement | null) => {
        viewsRef.current = element;
        return ref("views")(element);
      },
      sidebar: ref("sidebar"),
      page: ref("page"),
      bar: (element: HTMLElement | null) => {
        if (!element) return;
        const stop = bottomBar(element);
        set("bar", element);
        return () => {
          stop?.();
          set("bar", undefined);
        };
      },
    };
  }, []);
  const addPage = useCallback(() => {
    setPages((n) => n + 1);
    return () => setPages((n) => n - 1);
  }, []);
  const shell = useMemo(() => ({ slots, addPage }), [slots, addPage]);

  // Compact screens that are not short: when one header row does not hold
  // the brand, the views and the actions, the views take a second row.
  const [wrap, setWrap] = useState(false);
  useLayoutEffect(() => {
    const row = header.current;
    if (!row || step === "narrow" || short) {
      setWrap(false);
      return;
    }
    const measure = () => {
      const views = viewsRef.current?.scrollWidth ?? 0;
      // Three 16px gaps and the 1px divider between brand, views and actions.
      const need =
        (brandRef.current?.offsetWidth ?? 0) + views + (actionsRef.current?.offsetWidth ?? 0) + 49;
      const style = getComputedStyle(row);
      const room = row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      setWrap(views > 0 && need > room);
    };
    const observer = new ResizeObserver(measure);
    for (const element of [row, brandRef.current, actionsRef.current, viewsRef.current]) {
      if (element) observer.observe(element);
    }
    measure();
    return () => observer.disconnect();
  }, [step, short]);

  const inert = pages > 0;
  const views = (
    <div ref={refs.views} className="flex w-max min-w-0 items-center gap-4 empty:hidden" />
  );

  return (
    <ShellContext value={shell}>
      <ThemeProvider>
        <div className={cn("relative flex h-dvh flex-col overflow-hidden text-sm", className)}>
          <h1 className="sr-only">{title}</h1>
          <header
            inert={inert}
            className="flex shrink-0 flex-col border-b pt-[env(safe-area-inset-top)]"
          >
            <div
              ref={header}
              className="flex h-14 items-center gap-4 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] short:h-12 compact:pr-[max(1.5rem,env(safe-area-inset-right))] compact:pl-[max(1.5rem,env(safe-area-inset-left))]"
            >
              {/* Phones: the brand gives way to the actions (a long profile
                  name truncates); from compact on it keeps its width and the
                  views move to a second row instead. */}
              <div ref={brandRef} className="flex min-w-0 items-center gap-2 compact:shrink-0">
                {brand}
              </div>
              {step !== "narrow" && !wrap && (
                <>
                  {/* Only where views follow (none on a first visit). */}
                  <div
                    aria-hidden
                    className="h-6 w-px shrink-0 bg-border has-[+div:empty]:hidden"
                  />
                  {views}
                </>
              )}
              {/* `ml-auto`, not a spacer: an empty item would cost a second
                  gap, room a phone's brand needs. */}
              <div ref={actionsRef} className="-mr-2 ml-auto flex shrink-0 items-center gap-2">
                {actions}
              </div>
            </div>
            {step !== "narrow" && wrap && (
              <div className="flex h-12 items-center overflow-x-auto pr-[max(1.5rem,env(safe-area-inset-right))] pb-2 pl-[max(1.5rem,env(safe-area-inset-left))]">
                {views}
              </div>
            )}
          </header>
          <div inert={inert} className="flex min-h-0 flex-1">
            <main
              data-vt="view"
              className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden"
            >
              {children}
            </main>
            <aside
              ref={refs.sidebar}
              data-vt="panel"
              className="hidden min-h-0 w-[340px] shrink-0 flex-col border-l pr-[env(safe-area-inset-right)] wide:flex wide:empty:hidden"
            />
          </div>
          <div
            inert={inert}
            ref={refs.bar}
            className="flex shrink-0 flex-col gap-3 border-t pt-4 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] empty:hidden compact:hidden"
          />
          <div
            ref={refs.page}
            className="absolute inset-0 z-10 flex flex-col bg-background pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] empty:hidden"
          />
          <AppToaster />
        </div>
      </ThemeProvider>
    </ShellContext>
  );
}
