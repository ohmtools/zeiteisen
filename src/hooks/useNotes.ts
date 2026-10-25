import { useRef, useState } from "react";
import { m } from "@/i18n";
import { useStorageSync } from "@/hooks/useStorageSync";
import { toast } from "@/lib/ohmtools/toast";
import { loadNotes, NOTES_KEY, saveNotes } from "@/lib/primitives/storage";

// Owns `tt.notes.v1`: the user's plain-text notes. Never shared — no link, no
// profile file; only this device and its backup. Saved on every change.
export function useNotes() {
  const [notes, setNotesState] = useState(loadNotes);
  // Notes typed in another tab.
  useStorageSync([NOTES_KEY], () => setNotesState(loadNotes()));
  // One toast per run of refused writes, not one per keystroke.
  const refused = useRef(false);

  const setNotes = (next: string) => {
    setNotesState(next);
    const saved = saveNotes(next);
    if (!saved && !refused.current) toast.error(m.notes_error_storage());
    refused.current = !saved;
  };

  return { notes, setNotes };
}
