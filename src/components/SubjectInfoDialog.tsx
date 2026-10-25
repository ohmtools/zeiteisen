import { useState } from "react";
import { localized, m } from "@/i18n";
import { Popup } from "@/components/ohmtools/popup";
import { Button } from "@/components/ui/button";
import type { SubjectInformation } from "@/lib/primitives/meta";

// Everything the catalog knows about one subject; opened by the popup's
// "More info". `info` null = closed.
export function SubjectInfoDialog({
  info,
  onClose,
}: {
  info: SubjectInformation | null;
  onClose: () => void;
}) {
  // The last subject stays while the dialog closes, so it never empties.
  const [shown, setShown] = useState(info);
  if (info !== null && info !== shown) setShown(info);

  return (
    <Popup
      kind="dialog"
      open={info !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onCancel={onClose}
      title={shown ? localized(shown.name) : ""}
      description={shown && `${m.subject_info_code()}: ${shown.code}`}
      closeLabel={m.panel_close()}
      footer={
        <Button variant="ghost" onClick={onClose}>
          {m.close()}
        </Button>
      }
    >
      {shown && (
        <div className="flex flex-col gap-4 text-sm">
          <section className="flex flex-col gap-1">
            <span className="font-medium">{m.subject_info_sws()}</span>
            <span>{m.subject_info_sws_lecture({ hours: shown.sws.lecture })}</span>
            <span>{m.subject_info_sws_exercise({ hours: shown.sws.exercise })}</span>
            <span>{m.subject_info_sws_laboratory({ hours: shown.sws.laboratory })}</span>
          </section>
          {shown.lp !== undefined && (
            <section className="flex flex-col gap-1">
              <span className="font-medium">{m.subject_info_lp()}</span>
              <span>{shown.lp}</span>
            </section>
          )}
          <section className="flex flex-col gap-1">
            <span className="font-medium">{m.subject_info_description()}</span>
            <span>{localized(shown.description)}</span>
          </section>
          <section className="flex flex-col gap-1">
            <span className="font-medium">{m.subject_info_test()}</span>
            <span>{localized(shown.test)}</span>
          </section>
        </div>
      )}
    </Popup>
  );
}
