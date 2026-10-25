import { useEffect } from "react";
import { m } from "@/i18n";
import { loadIosHintShown, saveIosHintShown } from "@/lib/primitives/storage";
import { toast } from "@/lib/ohmtools/toast";

// Safari on iOS deletes a website's storage after 7 days without a visit,
// unless the app was added to the home screen. Said once per device, in a
// browser tab only.
export function useInstallHint() {
  useEffect(() => {
    if (!isIosBrowserTab() || loadIosHintShown()) return;
    saveIosHintShown();
    toast.warning(m.ios_hint(), { duration: Infinity, closeButton: true });
  }, []);
}

function isIosBrowserTab(): boolean {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    (navigator as { standalone?: boolean }).standalone === true ||
    matchMedia("(display-mode: standalone)").matches;
  return ios && !standalone;
}
