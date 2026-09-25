import { lazy, Suspense, type ComponentProps } from "react";
import type { LocaleCalendar } from "@/components/LocaleCalendar";

const Calendar = lazy(() =>
  import("@/components/LocaleCalendar").then((module) => ({ default: module.LocaleCalendar })),
);

// Date pickers only ever sit inside a popover or a dialog, so nothing is
// loaded until one opens. The fallback holds the calendar's size so the
// popover does not jump once the chunk arrives; offline it comes from the
// service worker's precache like every other chunk.
export function LazyCalendar(props: ComponentProps<typeof LocaleCalendar>) {
  return (
    <Suspense fallback={<div className="h-[17.5rem] w-[15.5rem]" />}>
      <Calendar {...props} />
    </Suspense>
  );
}
