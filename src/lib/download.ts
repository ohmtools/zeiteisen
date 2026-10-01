import { cleanName } from "@/lib/primitives/name";
import { getTimetableFile, type Timetable } from "@/lib/primitives/timetable";

// Client-only download: a Blob URL and a synthetic click, no server anywhere.
export function downloadText(
  filename: string,
  text: string,
  type = "application/octet-stream",
): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoking in the same task cancels the download in Chromium when several
  // files are saved in one go, so the URL is released
  // after the browser has picked it up.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// `2026-10-01`, the local day, for file names.
export function dayStamp(now: Date): string {
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
}

// Profile and timetable names become file names. Names the app accepts are
// valid already (`@/lib/primitives/name`) and come through unchanged, so an upload
// gets the very name back; this only catches names stored before that rule.
export function safeFilename(name: string): string {
  return cleanName(name, "profile");
}

// `getTimetableFile` in `<name>.timetable`, the very file the picker and the import
// dialog accept as an upload, so a timetable can be carried to another device
// by hand.
export function downloadTimetable(timetable: Timetable): void {
  downloadText(
    `${safeFilename(timetable.name)}.timetable`,
    JSON.stringify(getTimetableFile(timetable), null, 2),
  );
}
