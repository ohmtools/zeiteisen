import {
  getBackupFile,
  loadBackup,
  parseBackupFile,
  saveBackup,
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
// browser refused the write (the page stays as it is).
export function restoreBackup(backup: Backup): boolean {
  if (!saveBackup(backup)) return false;
  location.reload();
  return true;
}
