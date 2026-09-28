import { useState } from "react";
import { Download, Eraser } from "lucide-react";
import { m } from "@/i18n";
import { Button } from "@/components/ui/button";
import { EmptyContent } from "@/components/ui/empty";
import { DataPartsList } from "@/components/DataParts";
import { downloadBackup } from "@/lib/backup";
import { resetAndReload, type DataPart } from "@/lib/reset";

// The error screen's way out when reloading does not help. The Data menu is
// out of reach there, so its backup and "Delete data…" come along: a backup of
// everything on the device, then deleting what keeps the app from starting
// (stored data, or the offline app files a broken deploy left behind). No
// toasts: the toaster is part of the app that failed, a refusal is said
// inline. Deferred chunk (`ErrorBoundary`).
export function ErrorTools() {
  const [deleting, setDeleting] = useState(false);
  const [chosen, setChosen] = useState<DataPart[]>([]);
  const [refused, setRefused] = useState(false);

  return (
    <EmptyContent>
      <p className="text-muted-foreground">{m.app_error_help()}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={() => downloadBackup()}>
          <Download data-icon="inline-start" />
          {m.backup_save()}
        </Button>
        <Button
          variant="outline"
          aria-expanded={deleting}
          aria-controls="error-delete"
          onClick={() => setDeleting(!deleting)}
        >
          <Eraser data-icon="inline-start" />
          {m.data_delete()}
        </Button>
      </div>
      {deleting && (
        <div id="error-delete" className="flex w-full flex-col gap-4 text-left text-wrap">
          <p className="text-muted-foreground">{m.data_delete_text()}</p>
          <DataPartsList id="error-delete" chosen={chosen} onChange={setChosen} />
          {refused && (
            <p role="alert" className="text-destructive">
              {m.data_delete_error()}
            </p>
          )}
          <Button
            variant="destructive"
            disabled={chosen.length === 0}
            onClick={async () => setRefused(!(await resetAndReload(chosen)))}
          >
            {m.data_delete_confirm()}
          </Button>
        </div>
      )}
    </EmptyContent>
  );
}
