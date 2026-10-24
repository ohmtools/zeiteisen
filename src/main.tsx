import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startLaunchLog } from "@/lib/launch";
import { dropRetiredKeys } from "@/lib/retired";
import "./index.css";
import App from "./App.tsx";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LaunchMarks } from "@/components/LaunchMarks";
import { ThemeProvider } from "@/components/theme-provider";
import { followLocaleOfOtherTabs, getLocale } from "@/i18n";

// For the debug info: timings, returns from the background, errors.
startLaunchLog();

// What older versions stored and none reads any more (the notes strip).
dropRetiredKeys();

// Screen readers and translation offers read the page's language from here.
document.documentElement.lang = getLocale();
followLocaleOfOtherTabs();

// A lazy chunk that fails to load after a deploy (an open tab asking for the
// old file names): start again on the new version, at most once a minute so
// a chunk that is really missing cannot loop; the error boundary shows then.
const RELOADED_KEY = "tt.reloaded";
window.addEventListener("vite:preloadError", (event) => {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_KEY) ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <App />
        <LaunchMarks />
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
);
