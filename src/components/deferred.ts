// Everything but the app shell and the timetable grid, in one chunk: what the
// panels show (groups, notes), the settings, the profile menu, the details'
// sheet, App's dialogs, the update prompt and the error screen's tools. The
// shell's own containers (`AppShell`, `Panel`, the toaster) are in the first
// load. App and main `lazy()` each export out of this one module, so they
// share the one `import()` and the one chunk; it starts loading during the
// first render and the grid paints without waiting for it.
import { MARK_DEFERRED, mark } from "@/lib/launch";

// When this chunk arrived, for the debug info.
mark(MARK_DEFERRED);

export { AppDialogs } from "@/components/AppDialogs";
export { SubjectInfoDialog } from "@/components/SubjectInfoDialog";
export { GroupTree } from "@/components/GroupTree";
export { ProfileMenu } from "@/components/ProfileMenu";
export { DetailsSheet } from "@/components/Sheets";
export { Settings } from "@/components/Settings";
export { NotesActions, NotesSection } from "@/components/NotesSection";
export { ErrorTools } from "@/components/ErrorTools";
export { UpdatePrompt } from "@/components/UpdatePrompt";
