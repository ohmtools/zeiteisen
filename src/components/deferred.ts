// Everything but the timetable grid, in one chunk: the sidebar, App's dialogs
// and the toaster. App and main `lazy()` each export out of this one module,
// so they share the one `import()` and the one chunk; it starts loading during
// the first render and the grid paints without waiting for it.
export { AppDialogs } from "@/components/AppDialogs";
export { AppToaster } from "@/components/AppToaster";
export { SubjectInfoDialog } from "@/components/SubjectInfoDialog";
export { GroupTree } from "@/components/GroupTree";
export { ProfileSection } from "@/components/ProfileSection";
export { DataMenu } from "@/components/DataMenu";
