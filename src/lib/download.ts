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
  // files are saved in one go (one .ics per semester), so the URL is released
  // after the browser has picked it up.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Profile names become file names, so anything a file system dislikes goes.
export function safeFilename(name: string): string {
  return name.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "") || "profile";
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
