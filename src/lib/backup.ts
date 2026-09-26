import { emptyCatalogCache } from "@/lib/primitives/catalog";
import {
  getBackupFile,
  loadBackup,
  loadCatalogUrl,
  parseBackupFile,
  saveBackup,
  saveCatalogCache,
  type Backup,
} from "@/lib/primitives/storage";
import { downloadText } from "@/lib/download";

// The backup file of the footer's "Data" menu: everything on this device but
// the catalog cache, `zeiteisen-<date>.backup`.
export function downloadBackup(now = new Date()): void {
  const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
  downloadText(`zeiteisen-${day}.backup`, JSON.stringify(getBackupFile(loadBackup()), null, 2));
}

// `null` for anything that is no complete backup: not JSON, or any part of it
// broken.
export async function readBackupFile(file: File): Promise<Backup | null> {
  try {
    return parseBackupFile(JSON.parse(await file.text()));
  } catch {
    return null;
  }
}

// A restore replaces everything, and every hook read its state on the first
// render: write, then start the app again on the new data. `false` when the
// browser refused the write (the page stays as it is). A backup reading
// another catalog, or none, drops the cached one, like switching the URL or
// to `ignore` in the Data menu does: its timetables, names and links would
// otherwise stay until the new catalog answers.
export function restoreBackup(backup: Backup): boolean {
  const otherCatalog = backup.catalogUrl !== loadCatalogUrl() || backup.catalogMode === "ignore";
  if (!saveBackup(backup)) return false;
  if (otherCatalog) saveCatalogCache(emptyCatalogCache);
  location.reload();
  return true;
}
