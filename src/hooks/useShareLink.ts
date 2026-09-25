import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { m } from "@/i18n";
import type { Profile } from "@/lib/primitives/profile";
import { encodeShare, MAX_SHARE_LENGTH, shareUrl } from "@/lib/share";

// The address bar never reflects state: a link opened directly is read once
// on the first render (`payloadFromLocation` in App), then this strips the URL
// back to the bare page with `history.replaceState` — no history step. The share link exists only behind the link button.
export type ShareLink = { query: string; url: string; tooLong: boolean };

export function useShareLink(profile: Profile | undefined): ShareLink | null {
  const query = profile ? encodeShare(profile) : null;

  useEffect(() => {
    const { hash, search, pathname } = window.location;
    if (hash || search) history.replaceState(null, "", pathname);
  }, []);

  if (query === null) return null;
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
