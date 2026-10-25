// Everything but the timetable grid, in one chunk: the panels (groups,
// notes), the settings, the profile menu, the sheets and drawers, App's dialogs,
// the toaster and the error screen's tools. App and main `lazy()` each export
// out of this one module, so they share the one `import()` and the one chunk;
// it starts loading during the first render and the grid paints without
// waiting for it.
import { MARK_DEFERRED, mark } from "@/lib/launch";

// When this chunk arrived, for the debug info.
mark(MARK_DEFERRED);

export { AppDialogs } from "@/components/AppDialogs";
export { AppToaster } from "@/components/AppToaster";
export { SubjectInfoDialog } from "@/components/SubjectInfoDialog";
export { GroupTree } from "@/components/GroupTree";
export { ProfileMenu } from "@/components/ProfileMenu";
export { DetailsSheet, PanelSheet, WeekDrawer } from "@/components/Sheets";
export { SettingsDialog, SettingsPage } from "@/components/SettingsPage";
export { NotesSection } from "@/components/NotesSection";
export { ErrorTools } from "@/components/ErrorTools";
