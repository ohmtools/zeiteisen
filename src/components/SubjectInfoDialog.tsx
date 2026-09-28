import { localized, m } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  return (
    <Dialog open={info !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {info && (
          <>
            <DialogHeader>
              <DialogTitle>{localized(info.name)}</DialogTitle>
              <DialogDescription>
                {m.subject_info_code()}: {info.code}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 text-sm">
              <section className="flex flex-col gap-1">
                <span className="font-medium">{m.subject_info_sws()}</span>
                <span>{m.subject_info_sws_lecture({ hours: info.sws.lecture })}</span>
                <span>{m.subject_info_sws_exercise({ hours: info.sws.exercise })}</span>
                <span>{m.subject_info_sws_laboratory({ hours: info.sws.laboratory })}</span>
              </section>
              {info.lp !== undefined && (
                <section className="flex flex-col gap-1">
                  <span className="font-medium">{m.subject_info_lp()}</span>
                  <span>{info.lp}</span>
                </section>
              )}
              <section className="flex flex-col gap-1">
                <span className="font-medium">{m.subject_info_description()}</span>
                <span>{localized(info.description)}</span>
              </section>
              <section className="flex flex-col gap-1">
                <span className="font-medium">{m.subject_info_test()}</span>
                <span>{localized(info.test)}</span>
              </section>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {m.close()}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
