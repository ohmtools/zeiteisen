import { Component, type ReactNode } from "react";
import { m } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

// The last line behind the lazy chunks: a tab left open across a deploy may
// ask for a chunk that no longer exists (`main.tsx` reloads on that first).
// Without this, one failed `lazy()` would unmount the whole app to a blank
// page. Everything the user made is in storage, so a reload loses nothing.
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Empty className="min-h-dvh">
        <EmptyHeader>
          <EmptyTitle>{m.app_error_title()}</EmptyTitle>
          <EmptyDescription>{m.app_error_text()}</EmptyDescription>
        </EmptyHeader>
        <Button onClick={() => location.reload()}>{m.app_error_reload()}</Button>
      </Empty>
    );
  }
}
