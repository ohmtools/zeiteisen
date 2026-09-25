import { useEffect, useRef } from "react";

// Another tab of the app wrote one of `keys` (or cleared the storage): read it
// again. Without this, a second open tab keeps its old state and its next
// write throws away what the first one saved — a backup restored there
// included. A `storage` event only ever reaches the OTHER tabs, and writing
// back an unchanged value fires none, so two tabs do not ping-pong.
export function useStorageSync(keys: readonly string[], reload: () => void) {
  const latest = useRef({ keys, reload });
  useEffect(() => {
    latest.current = { keys, reload };
  });

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || latest.current.keys.includes(event.key)) latest.current.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}
