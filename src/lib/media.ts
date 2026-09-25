// The `desktop` variant of index.css as a media query, for the few places
// that have to know it in script: both columns side by side, no tab bar.
export const DESKTOP_QUERY = "(width >= 64rem) and (height >= 700px)";

export function isDesktop(): boolean {
  return matchMedia(DESKTOP_QUERY).matches;
}
