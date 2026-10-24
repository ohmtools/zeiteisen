import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toasterMounted } from "@/lib/toast";

// Phones: above the bar at the bottom (`BottomBar` publishes its height as
// `--bottom-bar`, 0 elsewhere); otherwise bottom right, sonner's default.
const ABOVE_BAR = "calc(var(--bottom-bar, 0px) + 16px)";

// The `Toaster` plus the signal `@/lib/toast` waits for. Children's effects
// run first, so sonner is subscribed by the time this one fires.
export function AppToaster() {
  useEffect(() => toasterMounted(), []);
  return <Toaster mobileOffset={{ bottom: ABOVE_BAR }} />;
}
