import type { ExternalToast } from "sonner";

// sonner lives in the deferred chunk (`components/deferred`), not in the
// first load, yet the state hooks toast from the first render on. Each call
// here waits for sonner itself and for the `Toaster` to be mounted, so a toast
// fired before either arrived is shown late instead of lost. Only the three
// kinds the app uses.
let mounted: () => void = () => {};
const ready = new Promise<void>((resolve) => (mounted = resolve));

// Called by `AppToaster` once the `Toaster` is on the page.
export function toasterMounted() {
  mounted();
}

function show(kind: "success" | "error" | "warning") {
  return (message: string, data?: ExternalToast) => {
    void Promise.all([import("sonner"), ready]).then(([{ toast }]) => toast[kind](message, data));
  };
}

export const toast = { success: show("success"), error: show("error"), warning: show("warning") };
