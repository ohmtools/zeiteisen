// ohmtools/design: shadcn/src/components/ohmtools/theme-provider.tsx (copied by `ohmtools-design add`, do not edit)
import { useEffect, type ReactNode } from "react";

// Follows the device's colour scheme by toggling shadcn's `.dark` class on
// <html>, including live changes (DESIGN.md, "Light and dark"). There is
// deliberately no toggle. `public/dark.js` sets the class before the first
// paint, so nothing flashes white.
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const query = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", query.matches);

    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return children;
}
