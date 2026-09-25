// Asks the browser once per page load to keep this site's storage when space
// runs low; everything the user made lives there. Only after a real write, so
// a first visit that stores nothing asks nothing (Firefox shows a prompt).
let asked = false;

export function requestPersistence(): void {
  if (asked) return;
  asked = true;
  try {
    const storage = globalThis.navigator?.storage;
    if (!storage?.persist) return;
    void storage
      .persisted()
      .then((already) => (already ? true : storage.persist()))
      .catch(() => {});
  } catch {
    // No storage manager, nothing to ask.
  }
}
