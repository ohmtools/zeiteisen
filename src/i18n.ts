// The single door to paraglide. The compiler emits JSDoc-typed `.js` plus
// `.d.ts` next to it (`--emit-ts-declarations`) into `generated/paraglide/`,
// outside `src/`: `src/` is TypeScript source only, `allowJs` stays off and tsc
// reads the declarations through the `@paraglide/*` path. Everything else
// imports from here, so the `.js` specifier never reaches the app and the
// message layer has one file to change.
import { getLocale as currentLocale, localStorageKey } from "@paraglide/runtime.js";
import type { Localized } from "@/lib/primitives/meta";

export { m } from "@paraglide/messages.js";
export { baseLocale, getLocale, locales, setLocale } from "@paraglide/runtime.js";
export type { Locale } from "@paraglide/runtime.js";

// Catalog payloads carry both locales inline (see `Localized`), so picking one
// is a plain lookup and not a paraglide message.
export function localized(value: Localized): string {
  return currentLocale() === "de" ? value.de : value.en;
}

// Another tab switched the language (or cleared the storage, and with it the
// choice): follow it the way `setLocale` does, with a reload. Paraglide reads
// the locale anew on every message, so without it this tab's next render
// would mix both languages.
export function followLocaleOfOtherTabs(): void {
  const shown = currentLocale();
  window.addEventListener("storage", (event) => {
    if (event.key !== null && event.key !== localStorageKey) return;
    if (currentLocale() !== shown) location.reload();
  });
}
