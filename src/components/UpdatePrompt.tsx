import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { m } from "@/i18n";
import { toast } from "@/lib/ohmtools/toast";

// How often a page that stays open asks the server for a new version.
const CHECK_EVERY = 60 * 60_000;

// Registers the service worker and offers a new version as a toast that
// stays until it is used or wiped away (`registerType: "prompt"`): the new
// worker waits until "Reload", so an open tab keeps the files it started
// with. Deferred chunk, like everything but the shell and the grid.
export function UpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ onRegisteredSW: (_url, registration) => setRegistration(registration) });

  // The browser looks for a new version on every start; an installed app
  // returning from the background or a tab left open does not start again.
  useEffect(() => {
    if (!registration) return;
    let checked = Date.now();
    const check = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      if (Date.now() - checked < CHECK_EVERY) return;
      checked = Date.now();
      registration.update().catch(() => {});
    };
    const timer = setInterval(check, CHECK_EVERY);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [registration]);

  useEffect(() => {
    if (!needRefresh) return;
    toast(m.app_update_ready(), {
      id: "app-update",
      duration: Infinity,
      action: { label: m.app_update_reload(), onClick: () => updateServiceWorker(true) },
      onDismiss: () => setNeedRefresh(false),
    });
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}
