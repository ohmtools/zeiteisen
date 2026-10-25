import { Component, Suspense, type ReactNode } from "react";
import { m } from "@/i18n";
import { lazyDeferred } from "@/components/lazyDeferred";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

// Backup and "Delete data…" for the error screen, from the deferred chunk: the
// app loads it right after the first paint, so a tab that fails later (a chunk
// gone after a deploy) already holds it, and a start that fails fetches it
// now. It stays out of the first load, the grid's.
const ErrorTools = lazyDeferred((d) => d.ErrorTools);

// The last line behind the lazy chunks: a tab left open across a deploy may
// ask for a chunk that no longer exists (`main.tsx` reloads on that first).
// Without this, one failed `lazy()` would unmount the whole app to a blank
// page. Everything the user made is in storage, so a reload loses nothing.
// With `fallback`, that is shown instead of the error screen.
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return this.props.fallback === undefined ? <ErrorScreen /> : this.props.fallback;
  }
}

// Reload first, always there. The tools below it are the way out when that
// does not help; should their chunk not load either, the screen goes on
// without them instead of failing too.
function ErrorScreen() {
  return (
    <Empty className="min-h-dvh px-6">
      <EmptyHeader>
        <EmptyTitle>{m.app_error_title()}</EmptyTitle>
        <EmptyDescription>{m.app_error_text()}</EmptyDescription>
      </EmptyHeader>
      <Button onClick={reloadNewest}>{m.app_error_reload()}</Button>
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <ErrorTools />
        </Suspense>
      </ErrorBoundary>
    </Empty>
  );
}

// A new version may be waiting behind the one that failed (the service worker
// waits for the update toast, `UpdatePrompt`): let it take over first, or a
// reload starts the failed version again. Reloads anyway should the new worker
// not take over within a few seconds.
async function reloadNewest() {
  try {
    const sw = navigator.serviceWorker;
    const waiting = sw?.controller && (await sw.getRegistration())?.waiting;
    if (waiting) {
      sw.addEventListener("controllerchange", () => location.reload(), { once: true });
      setTimeout(() => location.reload(), 3000);
      waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }
  } catch {
    // No service worker to ask: a plain reload.
  }
  location.reload();
}
