import * as z from "zod/mini";
import { de, en } from "zod/locales";
import { getLocale, m } from "@/i18n";
import { cleanTimetableName } from "@/lib/names";
import { toast } from "@/lib/toast";
import { degreeSchema, locationsSchema, semesterDatesSchema } from "@/lib/primitives/meta";
import { parseTimetableFile, type TimetableSource } from "@/lib/primitives/timetable";

// Localized zod issue messages; `setLocale` reloads the page, so once is enough.
z.config(getLocale() === "de" ? de() : en());

// `details` lists what exactly is wrong (zod issues with their JSON path).
export type UploadError = { file: string; message: string; details?: string[] };

const MAX_DETAILS = 5;

// Caps a list of lines at five plus "n more"; the update dialog's diff uses
// it too, a rewritten file would otherwise print a hundred lines.
export function limit(details: string[]): string[] {
  if (details.length <= MAX_DETAILS) return details;
  return [
    ...details.slice(0, MAX_DETAILS),
    m.upload_error_more({ count: details.length - MAX_DETAILS }),
  ];
}

// Path like `[3] ("Analysis").startTime.hour`: array items that carry
// a `name`/`title` get it appended so the entry is easy to find in the file.
function formatPath(path: readonly PropertyKey[], json: unknown): string {
  let out = "";
  let node = json;
  for (const key of path) {
    node = node && typeof node === "object" ? Reflect.get(node, key) : undefined;
    if (typeof key === "number") {
      out += `[${key}]`;
      const label = labelOf(node);
      if (label) out += ` ("${label}")`;
    } else {
      out += (out ? "." : "") + String(key);
    }
  }
  return out;
}

function labelOf(node: unknown): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const label = Reflect.get(node, "name") ?? Reflect.get(node, "title");
  return typeof label === "string" ? label : undefined;
}

function issueDetails(error: z.core.$ZodError, json: unknown): string[] {
  return limit(
    error.issues.map((issue) =>
      issue.path.length > 0 ? `${formatPath(issue.path, json)}: ${issue.message}` : issue.message,
    ),
  );
}

export type UploadResult = {
  // Every timetable the files hold, in file order, named after its file,
  // origin `local`, every subject enabled. A name that is taken where it lands
  // is the caller's business (`uniqueName`).
  sources: TimetableSource[];
  errors: UploadError[];
};

// Each file through `parseTimetableFile` (a plain `Subject[]`, the group rule
// part of the schema); this only reads the files and words what went wrong.
export async function readTimetableFiles(files: File[]): Promise<UploadResult> {
  const result: UploadResult = { sources: [], errors: [] };

  for (const file of files) {
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      result.errors.push({ file: file.name, message: m.upload_error_json() });
      continue;
    }

    const parsed = parseTimetableFile(json, file.name);
    if (!("error" in parsed)) {
      // A file saved on Linux may carry a ":" Windows refuses.
      result.sources.push({ ...parsed.source, name: cleanTimetableName(parsed.source.name) });
    } else if (parsed.error === "content") {
      result.errors.push({
        file: file.name,
        message: m.upload_error_shape(),
        details: issueDetails(parsed.issues, json),
      });
    } else {
      result.errors.push({ file: file.name, message: m.upload_error_name() });
    }
  }

  return result;
}

// One JSON file against `schema`; `empty` refuses a file that parses but
// holds nothing — every list defaults to empty, so without it any other JSON
// object (a dates file picked as locations, say) would read as valid.
async function readJsonFile<T>(
  file: File,
  schema: z.ZodMiniType<T>,
  shape: string,
  empty?: { test: (data: T) => boolean; message: string },
): Promise<{ data: T } | { error: UploadError }> {
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    return { error: { file: file.name, message: m.upload_error_json() } };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      error: { file: file.name, message: shape, details: issueDetails(parsed.error, json) },
    };
  }
  if (empty?.test(parsed.data)) return { error: { file: file.name, message: empty.message } };
  return { data: parsed.data };
}

export function readDatesFile(file: File) {
  return readJsonFile(file, semesterDatesSchema, m.upload_error_dates_shape());
}

export function readLocationsFile(file: File) {
  return readJsonFile(file, locationsSchema, m.upload_error_locations_shape(), {
    test: (data) => data.locations.length === 0,
    message: m.upload_error_locations_empty(),
  });
}

export function readDegreeFile(file: File) {
  return readJsonFile(file, degreeSchema, m.upload_error_degree_shape(), {
    test: (data) => data.subjects.length === 0,
    message: m.upload_error_degree_empty(),
  });
}

// A refused file of the Data menu: a toast with zod's details, the menu has no
// panel to show them in.
export function toastUploadError(error: UploadError) {
  toast.error(`${error.file}: ${error.message}`, { description: error.details?.join(" · ") });
}
