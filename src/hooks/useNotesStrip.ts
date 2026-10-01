import { useState } from "react";
import { useStorageSync } from "@/hooks/useStorageSync";
import {
  loadNotesStrip,
  NOTES_STRIP_KEY,
  saveNotesStrip,
  type NotesStrip,
} from "@/lib/primitives/storage";

// Owns `tt.notesstrip.v1`: height and folding of the desktop notes strip.
// `preview` moves the height while a drag lasts without writing (every
// pointer move would reach the other tabs); `save` writes the final state. A
// refused write only loses the layout, so it says nothing.
export function useNotesStrip() {
  const [strip, setStrip] = useState<NotesStrip>(loadNotesStrip);
  useStorageSync([NOTES_STRIP_KEY], () => setStrip(loadNotesStrip()));
  return {
    strip,
    preview: setStrip,
    save: (next: NotesStrip) => {
      setStrip(next);
      saveNotesStrip(next);
    },
  };
}
