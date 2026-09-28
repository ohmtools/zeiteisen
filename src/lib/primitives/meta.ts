import * as z from "zod/mini";

// Payloads of the optional catalog's `locations.json` and `degreeinformation/*.json`.
// Both are read-only lookup tables the app merges over its own defaults; the
// zod mirrors live at the bottom of this file, the file layout in `CLAUDE.md`.

// The building shortcut of a room ("WE.105" -> "WE") mapped to its links. Both
// links are optional, an entry may carry a name alone.
export type CatalogLocation = {
  code: string;
  name?: string;
  mapsUrl?: string;
  siteUrl?: string;
};

export type Locations = {
  locations: CatalogLocation[];
};

// Everything known about one subject shortcut: name, hours, description, exam.
export type SubjectInformation = {
  name: Localized;
  sws: SWS;
  lp?: number;
  code: string;
  description: Localized;
  test: Localized;
};

// Semesterwochenstunden
export type SWS = {
  lecture: number;
  exercise: number;
  laboratory: number;
};

export type DegreeInformation = {
  subjects: SubjectInformation[];
};

// A string that ships both locales; pick one with `localized` from `@/i18n`.
export type Localized = {
  de: string;
  en: string;
};

export type GlobalEvent = {
  title: Localized;
  startDate: string; // ISO YYYY-MM-DD
  endDate?: string; // if missing = single day
  noLectures: boolean; // true = grey overlay + hide lectures + skip in ics
  description?: Localized;
};

// Global semester dates + events. Optional, shared by all semesters,
// independent from profiles and semesterTimetables. Date-only, no times.
export type SemesterDates = {
  year: number;
  lectureStart: string; // ISO YYYY-MM-DD
  lectureEnd: string; // ISO YYYY-MM-DD inclusive
  events: GlobalEvent[];
};

// Zod mirrors of the types above. Everything read from outside (catalog,
// localStorage, uploaded files) walks through these before it becomes a
// primitive; nothing here throws, callers use `safeParse`.

export const localizedSchema = z.object({
  de: z.string().check(z.minLength(1)),
  en: z.string().check(z.minLength(1)),
}) satisfies z.ZodMiniType<Localized>;

const isoDate = z.iso.date();

const globalEventSchema: z.ZodMiniType<GlobalEvent> = z.object({
  title: localizedSchema,
  startDate: isoDate,
  endDate: z.optional(isoDate),
  noLectures: z._default(z.boolean(), false),
  description: z.optional(localizedSchema),
});

export const semesterDatesSchema: z.ZodMiniType<SemesterDates> = z.object({
  year: z.int().check(z.minimum(1900), z.maximum(2999)),
  lectureStart: isoDate,
  lectureEnd: isoDate,
  events: z._default(z.array(globalEventSchema), []),
});

// Both links end up as `<a href>` in the subject popup, and the file may come
// from any catalog URL the user set or from an upload: web links only, no
// `data:`, `file:` or app schemes.
const webUrl = z.url({ protocol: /^https?$/ });

const locationSchema: z.ZodMiniType<CatalogLocation> = z.object({
  code: z.string().check(z.minLength(1)),
  name: z.optional(z.string()),
  mapsUrl: z.optional(webUrl),
  siteUrl: z.optional(webUrl),
});

export const locationsSchema: z.ZodMiniType<Locations> = z.object({
  locations: z._default(z.array(locationSchema), []),
});

const swsSchema: z.ZodMiniType<SWS> = z.object({
  lecture: z.number().check(z.minimum(0)),
  exercise: z.number().check(z.minimum(0)),
  laboratory: z.number().check(z.minimum(0)),
});

const subjectInformationSchema: z.ZodMiniType<SubjectInformation> = z.object({
  name: localizedSchema,
  sws: swsSchema,
  lp: z.optional(z.number().check(z.minimum(0))),
  code: z.string().check(z.minLength(1)),
  description: localizedSchema,
  test: localizedSchema,
});

export const degreeInformationSchema: z.ZodMiniType<DegreeInformation> = z.object({
  subjects: z._default(z.array(subjectInformationSchema), []),
});
