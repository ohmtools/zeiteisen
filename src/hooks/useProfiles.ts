import { useEffect, useRef, useState } from "react";
import { useStorageSync } from "@/hooks/useStorageSync";
import { cleanTimetableName, withCleanNames } from "@/lib/names";
import { requestPersistence } from "@/lib/persist";
import {
  initialState,
  removedState,
  renamedState,
  syncedState,
  type ProfilesState,
} from "@/lib/profileState";
import { toast } from "@/lib/ohmtools/toast";
import { m } from "@/i18n";
import { normalizeName } from "@/lib/primitives/name";
import {
  addTimetables,
  duplicateProfile,
  editSubjects,
  nameTaken,
  profileByName,
  removeTimetable,
  renameTimetable,
  replaceTimetable,
  setEnabled,
  timetableByName,
  type Profile,
  type ProfileName,
} from "@/lib/primitives/profile";
import {
  loadActive,
  loadProfiles,
  PROFILES_KEY,
  saveActive,
  saveProfiles,
} from "@/lib/primitives/storage";
import type { Subjects } from "@/lib/primitives/subject";
import type {
  Timetable,
  TimetableName,
  TimetableSource,
  TimetableSubjectExtra,
} from "@/lib/primitives/timetable";

// Owns `tt.profiles.v1` + `tt.active.v1`. A profile owns its timetables
// outright: there is no shared file store, so nothing folds new files into
// profiles behind the user's back.
export function useProfiles() {
  const [state, setState] = useState<ProfilesState>(() =>
    initialState(loadProfiles(), loadActive()),
  );
  const refused = useRef(false);
  // What storage held on load: writing it back is no change of the user's.
  const loaded = useRef(state.profiles);

  // Every change is persisted. The write carries every timetable, so a browser
  // that refuses it costs real data on the next reload — say so once.
  useEffect(() => {
    if (saveProfiles(state.profiles)) {
      refused.current = false;
      if (state.profiles !== loaded.current) requestPersistence();
    } else if (!refused.current) {
      refused.current = true;
      toast.error(m.upload_error_storage());
    }
    if (state.active) saveActive(state.active);
  }, [state.profiles, state.active]);

  // Another tab changed the profiles: take them over, or this tab's next
  // write would undo that. This tab keeps its own active profile while it
  // still exists, and follows it when it was renamed there.
  useStorageSync([PROFILES_KEY], () => {
    const profiles = loadProfiles();
    loaded.current = profiles;
    setState((previous) => syncedState(previous, profiles));
  });

  const active = profileByName(state.profiles, state.active);

  // Everything that writes the active profile; locked profiles refuse it, so
  // callers do not have to check.
  const update = (change: (profile: Profile) => Profile) =>
    setState((previous) => {
      const profile = profileByName(previous.profiles, previous.active);
      if (!profile || profile.locked) return previous;
      const next = change(profile);
      if (next === profile) return previous;
      return { ...previous, profiles: replace(previous.profiles, profile, next) };
    });

  // A taken name is refused, never suffixed: the dialogs check first, this is
  // the guard behind them. The profile becomes the active one. Returns whether
  // it was added.
  const add = (added: Profile): boolean => {
    // Timetable names become file names; one from a link or a file may not be
    // a valid one yet. The profile's name is checked by the dialogs.
    const profile = { ...added, timetables: withCleanNames(added.timetables) };
    const name = normalizeName(profile.name);
    if (!name || nameTaken(state.profiles, name)) return false;
    setState((previous) => {
      if (nameTaken(previous.profiles, name)) return previous;
      return { active: name, profiles: [...previous.profiles, { ...profile, name }] };
    });
    return true;
  };

  return {
    profiles: state.profiles,
    activeName: state.active,
    active,
    timetables: active?.timetables ?? [],
    locked: active?.locked ?? false,

    setEnabled: (name: TimetableName, indexes: readonly number[], enabled: boolean) =>
      update((profile) => setEnabled(profile, name, indexes, enabled)),
    select: (name: ProfileName) =>
      setState((previous) =>
        profileByName(previous.profiles, name) ? { ...previous, active: name } : previous,
      ),

    // A new profile is created with its timetables in ONE state change.
    addProfile: (name: ProfileName, sources: readonly TimetableSource[]) =>
      add(addTimetables({ name, locked: false, timetables: [] }, cleanSources(sources))),
    // An imported profile, whole: from a link (the user typed its name, a
    // taken one is refused) or from a file (already made unique).
    addProfileObject: (profile: Profile) => add(profile),
    // A copy of the profile `source`, unlocked, under a name the user typed;
    // the copy becomes the active one.
    duplicate: (source: ProfileName, name: ProfileName) => {
      const profile = profileByName(state.profiles, source);
      return profile ? add(duplicateProfile(profile, name)) : false;
    },
    // `false` when there is no active profile or it is locked (another tab
    // may have locked it while a dialog was open).
    addTimetables: (sources: readonly TimetableSource[]): boolean => {
      if (!active || active.locked) return false;
      update((profile) => addTimetables(profile, cleanSources(sources)));
      return true;
    },
    removeTimetable: (name: TimetableName) => {
      // The toast is fired here, not inside the updater: an updater may run
      // twice and would then report the removal twice.
      if (timetableByName(active, name) && !active?.locked) {
        toast.success(m.toast_timetable_removed({ name }));
      }
      update((profile) => removeTimetable(profile, name));
    },
    renameTimetable: (from: TimetableName, to: string) =>
      update((profile) => renameTimetable(profile, from, to)),
    // An accepted update (new content, same name) or a refused one (the hash
    // joins `rejected`).
    replaceTimetable: (name: TimetableName, next: Timetable) =>
      update((profile) => replaceTimetable(profile, name, next)),
    // The user added, edited or deleted a subject; a catalog timetable turns
    // local.
    editSubjects: (name: TimetableName, subjects: Subjects<TimetableSubjectExtra>) =>
      update((profile) => editSubjects(profile, name, subjects)),

    // A taken name is refused. The active profile's name moves along with it.
    rename: (from: ProfileName, to: string) =>
      setState((previous) => renamedState(previous, from, to)),
    // Deleting a profile deletes its timetables with it: they belong to it.
    // Deleting the last one starts a fresh, empty default.
    remove: (name: ProfileName) => setState((previous) => removedState(previous, name)),
    // Lock applies to the profile, not to the live selection: a locked profile
    // keeps everything it stores — its timetables included — until unlocked.
    toggleLock: () =>
      setState((previous) => {
        const profile = profileByName(previous.profiles, previous.active);
        if (!profile) return previous;
        return {
          ...previous,
          profiles: replace(previous.profiles, profile, { ...profile, locked: !profile.locked }),
        };
      }),
  };
}

// File-safe names; `addTimetables` then makes them unique in the profile.
function cleanSources(sources: readonly TimetableSource[]): TimetableSource[] {
  return sources.map((source) => ({ ...source, name: cleanTimetableName(source.name) }));
}

function replace(profiles: Profile[], old: Profile, next: Profile): Profile[] {
  return profiles.map((one) => (one === old ? next : one));
}
