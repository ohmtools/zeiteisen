import { NOTES_STRIP_KEY } from "@/lib/primitives/storage";

// Keys no version reads any more. `tt.notesstrip.v1` held the height and
// folding of the desktop notes strip, which the redesign replaced by the notes
// panel; nothing took its place, so there is nothing to carry over. A device
// that still has it drops it on start (user decision). The notes themselves
// are `tt.notes.v1`, untouched.
const RETIRED_KEYS = [NOTES_STRIP_KEY] as const;

type Store = Pick<Storage, "getItem" | "removeItem">;

// Removes what is left of the retired keys. Never throws: a blocked or full
// storage just keeps them.
export function dropRetiredKeys(store?: Store): void {
  try {
    const target = store ?? globalThis.localStorage;
    for (const key of RETIRED_KEYS) {
      if (target.getItem(key) !== null) target.removeItem(key);
    }
  } catch {
    // Nothing to do: the key stays unread.
  }
}
