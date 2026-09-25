import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { DESKTOP_QUERY as DESKTOP, isDesktop } from "@/lib/media";
import { toasterMounted } from "@/lib/toast";

// Below the `desktop` variant the tab bar is fixed to the bottom of the
// screen, and toasts sit above it.
const ABOVE_TAB_BAR = "calc(3.5rem + 16px + env(safe-area-inset-bottom))";

// The `Toaster` plus the signal `@/lib/toast` waits for. Children's effects
// run first, so sonner is subscribed by the time this one fires.
export function AppToaster() {
  const [desktop, setDesktop] = useState(isDesktop);
  useEffect(() => toasterMounted(), []);
  useEffect(() => {
    const query = matchMedia(DESKTOP);
    const change = () => setDesktop(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  const bottom = desktop ? undefined : { bottom: ABOVE_TAB_BAR };
  return <Toaster offset={bottom} mobileOffset={bottom} />;
}
