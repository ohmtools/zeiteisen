import { m } from "@/i18n";
import { nameTaken, profileByName, type Profile, type ProfileName } from "@/lib/primitives/profile";
import { normalizeName, uniqueName } from "@/lib/primitives/name";

// The state `useProfiles` holds, and how it moves. `active` is the active
// profile's name: names are unique on the device, so the name is the address.
// The app always has an active profile.
export type ProfilesState = { profiles: Profile[]; active: ProfileName };

// A fresh, empty default profile ("Profile", or "Profile 2" when taken), made
// the active one.
export function withDefault(state: ProfilesState): ProfilesState {
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

// What storage held on load (`loadProfiles` already dropped broken profiles and
// repeated names): the stored active profile while it exists, else the first.
export function initialState(profiles: Profile[], stored: ProfileName | null): ProfilesState {
  const state: ProfilesState = {
    profiles,
    active: stored && profileByName(profiles, stored) ? stored : (profiles[0]?.name ?? ""),
  };
  return profileByName(state.profiles, state.active) ? state : withDefault(state);
}

// Another tab changed the profiles: take them over. This tab keeps its own
// active profile while it exists. Gone, with exactly one new name in its place
// and the count unchanged, it was renamed there: follow it. Else the first
// profile, or a fresh default when none is left.
export function syncedState(previous: ProfilesState, profiles: Profile[]): ProfilesState {
  const next = { profiles, active: followActive(previous, profiles) };
  return profileByName(profiles, next.active) ? next : withDefault(next);
}

function followActive(previous: ProfilesState, profiles: readonly Profile[]): ProfileName {
  if (profileByName(profiles, previous.active)) return previous.active;
  const before = new Set(previous.profiles.map((profile) => profile.name));
  const added = profiles.filter((profile) => !before.has(profile.name));
  if (added.length === 1 && profiles.length === previous.profiles.length) return added[0].name;
  return profiles[0]?.name ?? "";
}

// A profile renamed; the active one's name moves along with it. Unchanged when
// the profile is missing or locked, or the name empty or taken by another
// (a change of case alone is a rename).
export function renamedState(state: ProfilesState, from: ProfileName, to: string): ProfilesState {
  const name = normalizeName(to);
  const profile = profileByName(state.profiles, from);
  if (!profile || profile.locked || !name || nameTaken(state.profiles, name, from)) return state;
  return {
    profiles: state.profiles.map((one) => (one === profile ? { ...profile, name } : one)),
    active: state.active === from ? name : state.active,
  };
}

// A profile deleted, its timetables with it. The active one moves to the first
// profile left; deleting the last one starts a fresh default. Unchanged when
// the profile is missing or locked.
export function removedState(state: ProfilesState, name: ProfileName): ProfilesState {
  const profile = profileByName(state.profiles, name);
  if (!profile || profile.locked) return state;
  const profiles = state.profiles.filter((one) => one !== profile);
  if (profiles.length === 0) return withDefault({ ...state, profiles });
  return { profiles, active: state.active === name ? profiles[0].name : state.active };
}
