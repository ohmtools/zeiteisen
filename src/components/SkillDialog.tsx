import { Download } from "lucide-react";
import { m } from "@/i18n";
import { Popup } from "@/components/ohmtools/popup";
import { Button } from "@/components/ui/button";

// Root-based, never relative: share links open the app on `/s/`, where a
// relative href would miss the file. Built by `npm run skill`, shipped with
// the app and precached, so the download works offline too.
const SKILL_ZIP = import.meta.env.BASE_URL + "zeiteisen-generator.zip";

// The AI skill that turns the university's PDFs and pages into the app's own
// files, and how to get it into an AI app. Opened from the settings and from
// the timetable picker's hint.
export function SkillDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Popup
      kind="dialog"
      open={open}
      onOpenChange={onOpenChange}
      onCancel={() => onOpenChange(false)}
      title={m.skill_title()}
      description={m.skill_text()}
      closeLabel={m.panel_close()}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {m.close()}
          </Button>
          <Button nativeButton={false} render={<a href={SKILL_ZIP} download />}>
            <Download data-icon="inline-start" />
            {m.skill_download()}
          </Button>
        </>
      }
    >
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
        <li>{m.skill_steps_claude()}</li>
        <li>{m.skill_steps_other()}</li>
        <li>{m.skill_steps_chat()}</li>
      </ol>
      <p className="text-sm text-muted-foreground">{m.skill_check()}</p>
    </Popup>
  );
}
