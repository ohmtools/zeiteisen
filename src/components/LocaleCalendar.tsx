import type { ComponentProps } from "react";
import { de, enUS } from "react-day-picker/locale";
import { getLocale } from "@/i18n";
import { Calendar } from "@/components/ui/calendar";

const CALENDAR_LOCALES = { en: enUS, de };

// The shadcn calendar with the UI language already applied. Split out of
// `LazyCalendar` so the whole `react-day-picker` tree (plus its locales) lands
// in a chunk of its own, loaded the first time a picker opens.
export function LocaleCalendar(props: ComponentProps<typeof Calendar>) {
  return <Calendar weekStartsOn={1} locale={CALENDAR_LOCALES[getLocale()]} {...props} />;
}
