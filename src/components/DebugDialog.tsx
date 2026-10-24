import { useEffect, useState, type ComponentProps } from "react";
import { Bug, Copy } from "lucide-react";
import { m } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { debugReport } from "@/lib/debug";
import { toast } from "@/lib/toast";

// "Debug info" under About in the settings: the button and its dialog in one,
// in the deferred chunk with the settings.
export function DebugButton(props: Omit<ComponentProps<typeof Button>, "onClick" | "children">) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button {...props} onClick={() => setOpen(true)}>
        <DebugButtonContent />
      </Button>
      <DebugDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function DebugButtonContent() {
  return (
    <>
      <Bug data-icon="inline-start" />
      <span className="truncate">{m.debug_menu()}</span>
    </>
  );
}

// The report of
// `debugReport`, read-only, with a copy button. Built anew on every opening,
// so it always shows this moment.
export function DebugDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [report, setReport] = useState<string | null>(null);
  // A report still being built when the dialog closes is dropped.
  useEffect(() => {
    if (!open) return;
    let live = true;
    void debugReport().then((text) => {
      if (live) setReport(text);
    });
    return () => {
      live = false;
    };
  }, [open]);

  const copy = () => {
    if (report === null) return;
    // No clipboard outside a secure context: the text stays selectable.
    if (!navigator.clipboard) {
      toast.error(m.toast_debug_failed());
      return;
    }
    navigator.clipboard.writeText(report).then(
      () => toast.success(m.toast_debug_copied()),
      () => toast.error(m.toast_debug_failed()),
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      // Cleared once closed, so the next opening never shows an old report.
      onOpenChangeComplete={(next) => {
        if (!next && !open) setReport(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.debug_title()}</DialogTitle>
          <DialogDescription>{m.debug_text()}</DialogDescription>
        </DialogHeader>
        <Textarea
          readOnly
          aria-label={m.debug_title()}
          value={report ?? m.debug_loading()}
          // Phones keep the default 16px: smaller, iOS zooms in on focus.
          className="h-72 font-mono md:text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {m.close()}
          </Button>
          <Button disabled={report === null} onClick={copy}>
            <Copy data-icon="inline-start" />
            {m.debug_copy()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
