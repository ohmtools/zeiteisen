// ohmtools/design: shadcn/src/lib/ohmtools/toast.ts (copied by `ohmtools-design add`, do not edit)

// The element group "Toast" (DESIGN.md, "Which group"): feedback on what
// already happened, above the bar at the bottom on phones, bottom right from
// compact on. `AppShell` mounts the toaster; call `toast("Link copied")`,
// `toast.success(…)`, or offer undo instead of a question:
// `toast("Deleted", { action: { label: "Undo", onClick: restore } })`.
export { toast } from "sonner";
