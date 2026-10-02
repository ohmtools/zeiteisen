// The single door to paraglide. The compiler emits JSDoc-typed `.js` plus
// `.d.ts` next to it (`--emit-ts-declarations`) into `generated/paraglide/`,
// outside `src/`: `src/` is TypeScript source only, `allowJs` stays off and tsc
// reads the declarations through the `@paraglide/*` path. Everything else
// imports from here, so the `.js` specifier never reaches the app and the
// message layer has one file to change.
import {
  getLocale as currentLocale,
  localStorageKey,
  overwriteGetLocale,
  type Locale,
} from "@paraglide/runtime.js";
import type { Localized } from "@/lib/primitives/meta";

export { m } from "@paraglide/messages.js";
export { baseLocale, getLocale, locales, setLocale } from "@paraglide/runtime.js";
export type { Locale } from "@paraglide/runtime.js";

// Paraglide resolves the locale anew on every message (a localStorage read
// and the strategy walk each time), thousands of times on a full grid. A page
// shows one language for its whole life: `setLocale` reloads, another tab's
// switch reloads this one (`followLocaleOfOtherTabs`), and so do a restored
// backup and "Delete data…". So the first answer is kept for the page.
// `resolveLocale` is paraglide's own, taken before the overwrite: it still
// reads the storage, for the comparison below.
const resolveLocale = currentLocale;
let pageLocale: Locale | undefined;
overwriteGetLocale(() => (pageLocale ??= resolveLocale()));

// Catalog payloads carry both locales inline (see `Localized`), so picking one
// is a plain lookup and not a paraglide message.
export function localized(value: Localized): string {
  return currentLocale() === "de" ? value.de : value.en;
}

// Another tab switched the language (or cleared the storage, and with it the
// choice): follow it the way `setLocale` does, with a reload. This page keeps
// the locale it started with, so without it the tab would go on in the old
// language while the storage names the new one.
export function followLocaleOfOtherTabs(): void {
  const shown = currentLocale();
  window.addEventListener("storage", (event) => {
    if (event.key !== null && event.key !== localStorageKey) return;
    if (resolveLocale() !== shown) location.reload();
  });
}
