import { m } from "@/i18n";
import { toast } from "@/lib/toast";

// `@/lib/upload` (and zod's locales) load on the first upload only. `null`
// when the chunk cannot be fetched (a deploy since the page loaded), said in
// a toast instead of an upload that silently does nothing.
export async function loadUpload(): Promise<typeof import("@/lib/upload") | null> {
  try {
    return await import("@/lib/upload");
  } catch {
    toast.error(m.app_error_text());
    return null;
  }
}
