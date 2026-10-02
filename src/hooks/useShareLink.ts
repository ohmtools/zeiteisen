import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { m } from "@/i18n";
import type { Profile } from "@/lib/primitives/profile";
import { appRoot } from "@/lib/catalog";
import { encodeShare, MAX_SHARE_LENGTH, shareUrl } from "@/lib/share";

// The address bar never reflects state: a link opened directly is read once
// on the first render (`payloadFromLocation` in App), then this strips the URL
// back to the bare app root (a share link opens on `/s/`) with
// `history.replaceState` — no history step — once `keepUrl` is false, i.e.
// when the import dialog it opened closes (import or cancel alike), so a
// reload while the dialog is open asks again.
export function useStripSharedUrl(keepUrl: boolean): void {
  useEffect(() => {
    const root = appRoot();
    if (!keepUrl && window.location.href !== root) history.replaceState(null, "", root);
  }, [keepUrl]);
}

// The share link exists only behind the link button (`ExportButtons`, in the
// deferred chunk): encoding hashes every timetable of the profile, which App's
// first render has no use for.
export type ShareLink = { query: string; url: string; tooLong: boolean };

export function shareLinkOf(profile: Profile | undefined): ShareLink | null {
  // An empty profile has nothing to share (and such a link is refused).
  if (!profile || profile.timetables.length === 0) return null;
  const query = encodeShare(profile);
  return { query, url: shareUrl(query), tooLong: query.length > MAX_SHARE_LENGTH };
}

// Copy state for the link button: "Copied" for two seconds, then back.
export function useCopied(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return [
    copied,
    (text: string) => {
      const failed = () => {
        setCopied(false);
        toast.error(m.toast_link_failed());
      };
      // No clipboard outside a secure context (plain http): say so instead of
      // doing nothing.
      if (!navigator.clipboard) {
        failed();
        return;
      }
      void navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        toast.success(m.toast_link_copied());
      }, failed);
    },
  ];
}
