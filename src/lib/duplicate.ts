import { uniqueName } from "@/lib/primitives/name";
import type { Profile, ProfileName } from "@/lib/primitives/profile";

// "Duplicate" in the profile menu: another saved variant to tinker with,
// starting from this one. Everything is copied — timetables, selection,
// origins (catalog updates keep coming) and refused updates — but the copy is
// unlocked: it exists to be changed. Timetables are immutable values, so
// sharing them between the two profiles shares nothing that can change.
export function duplicateProfile(profile: Profile, name: ProfileName): Profile {
  return { ...profile, name, locked: false };
}

// The name the duplicate dialog suggests: "Plan A" → "Plan A 2".
export function duplicateName(profiles: readonly Profile[], profile: Profile): ProfileName {
  return uniqueName(
    profiles.map((one) => one.name),
    profile.name,
  );
}
