import { parseQuery, parseURL, withQuery } from "ufo";
import * as z from "zod/mini";
import { getProfileFile, getSharedTimetables, type Profile } from "@/lib/primitives/profile";
import { sharedTimetableSchema, type SharedTimetable } from "@/lib/primitives/timetable";

// The share link carries a profile as `SharedTimetable[]` (per timetable its
// content hash and the `enabled` bits), no names — not even the profile's,
// the receiver is asked for one. It is query syntax in the fragment, which
// never reaches the server (no logs, no SPA fallback needed):
//
//   https://host/#v=1&t=1D3m7bpm._________g&t=Cfwjq5pk.__-A
//
// `v` is the version, one `t` per timetable = `<hash>.<bits>` (both
// base64url, so `.` never appears inside either and nothing gets
// percent-encoded), or `<hash>` alone when every subject is enabled. Short enough to stay readable, so no compression. The
// global `SemesterDates` never travel in a link or a file.
type ShareEnvelope = { v: 1; timetables: SharedTimetable[] };

const envelopeSchema: z.ZodMiniType<ShareEnvelope> = z.object({
  v: z.literal(1),
  timetables: z.array(sharedTimetableSchema),
});

// Longer links get cut by chat apps and mail clients, so past this the copy
// button turns off and the JSON download takes over.
export const MAX_SHARE_LENGTH = 1500;

const SEPARATOR = ".";

// The query string alone, without `#`.
export function encodeShare(profile: Profile): string {
  const t = getSharedTimetables(profile).map(({ hash, subjects }) =>
    subjects === undefined ? hash : hash + SEPARATOR + subjects,
  );
  return withQuery("", { v: 1, t }).slice(1);
}

export function decodeShare(query: string): SharedTimetable[] | null {
  try {
    const { v, t } = parseQuery(query);
    const parts = t === undefined ? [] : Array.isArray(t) ? t : [t];
    const parsed = envelopeSchema.safeParse({
      v: Number(v),
      timetables: parts.map(String).map((part) => {
        const at = part.indexOf(SEPARATOR);
        if (at < 0) return { hash: part };
        return { hash: part.slice(0, at), subjects: part.slice(at + 1) };
      }),
    });
    return parsed.success ? parsed.data.timetables : null;
  } catch {
    return null;
  }
}

// Accepts a whole link, `#v=1&t=…` or the query alone, so the import dialog
// takes whatever the user copied.
export function decodeShareInput(input: string): SharedTimetable[] | null {
  const text = input.trim();
  if (!text) return null;
  return decodeShare(text.includes("#") ? parseURL(text).hash.slice(1) : text);
}

// The link that was opened directly. Read once on the first render, before
// `useShareLink` strips the URL back to the bare page.
export function payloadFromLocation(): SharedTimetable[] | null {
  const query = window.location.hash.slice(1);
  return query ? decodeShare(query) : null;
}

export function shareUrl(query: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${query}`;
}

// The downloaded profile `.json`: its full timetables, so it imports on a
// device with neither the catalog nor the files. Indented for reading.
export function profileFileText(profile: Profile): string {
  return JSON.stringify(getProfileFile(profile), null, 2);
}
