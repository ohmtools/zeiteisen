import { useEffect, useRef, useState } from "react";
import { useStorageSync } from "@/hooks/useStorageSync";
import { duplicateProfile } from "@/lib/duplicate";
import { requestPersistence } from "@/lib/persist";
import { toast } from "@/lib/toast";
import { m } from "@/i18n";
import { uniqueName } from "@/lib/primitives/name";
import {
  addTimetables,
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

// `active` is the active profile's name: names are unique on the device, so
// the name is the address.
type State = { profiles: Profile[]; active: ProfileName };

// Owns `tt.profiles.v1` + `tt.active.v1`. A profile owns its timetables
// outright: there is no shared file store, so nothing folds new files into
// profiles behind the user's back.
export function useProfiles() {
  const [state, setState] = useState<State>(initial);
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
  // still exists.
  useStorageSync([PROFILES_KEY], () => {
    const profiles = loadProfiles();
    loaded.current = profiles;
    setState((previous) => {
      const active = profileByName(profiles, previous.active)
        ? previous.active
        : (profiles[0]?.name ?? "");
      const next = { profiles, active };
      return profileByName(profiles, active) ? next : withDefault(next);
    });
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
  const add = (profile: Profile): boolean => {
    const name = profile.name.trim();
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
      add(addTimetables({ name, locked: false, timetables: [] }, sources)),
    // An imported profile, whole: from a link (the user typed its name, a
    // taken one is refused) or from a file (already made unique).
    addProfileObject: (profile: Profile) => add(profile),
    // A copy of the active profile, unlocked, under a name the user typed.
    duplicate: (name: ProfileName) => (active ? add(duplicateProfile(active, name)) : false),
    addTimetables: (sources: readonly TimetableSource[]) =>
      update((profile) => addTimetables(profile, sources)),
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
      setState((previous) => {
        const name = to.trim();
        const profile = profileByName(previous.profiles, from);
        if (!profile || profile.locked || !name || nameTaken(previous.profiles, name, from)) {
          return previous;
        }
        return {
          profiles: replace(previous.profiles, profile, { ...profile, name }),
          active: previous.active === from ? name : previous.active,
        };
      }),
    // Deleting a profile deletes its timetables with it: they belong to it.
    remove: (name: ProfileName) =>
      setState((previous) => {
        const profile = profileByName(previous.profiles, name);
        if (!profile || profile.locked) return previous;
        const profiles = previous.profiles.filter((one) => one !== profile);
        // The app always has an active profile; deleting the last one starts a
        // fresh, empty default rather than leaving the app without one.
        if (profiles.length === 0) return withDefault({ ...previous, profiles });
        const next = previous.active === name ? profiles[0].name : previous.active;
        return { profiles, active: next };
      }),
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

function replace(profiles: Profile[], old: Profile, next: Profile): Profile[] {
  return profiles.map((one) => (one === old ? next : one));
}

// `loadProfiles` already drops broken profiles and repeated names.
function initial(): State {
  const profiles = loadProfiles();
  const stored = loadActive();
  const state: State = {
    profiles,
    active: stored && profileByName(profiles, stored) ? stored : (profiles[0]?.name ?? ""),
  };
  return profileByName(state.profiles, state.active) ? state : withDefault(state);
}

function withDefault(state: State): State {
  const profile: Profile = {
    name: uniqueName(
      state.profiles.map((one) => one.name),
      m.profile_default(),
    ),
    locked: false,
    timetables: [],
  };
  return { active: profile.name, profiles: [...state.profiles, profile] };
}
