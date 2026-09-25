import { useEffect } from "react";

// Follows the browser's color scheme by toggling shadcn's `.dark` class on
// <html>, including live changes. Based on shadcn's Vite dark mode guide,
// minus the user-selectable theme: there is deliberately no toggle.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", query.matches);

    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return children;
}
