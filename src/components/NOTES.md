# src/components — notes

Shell layout, grid, group tree. shadcn primitives in `ui/` have their own
`NOTES.md`.

## Shell

- Full width, no max-width container. Header = title only, no subtitle (user
  decision).
- **Desktop (`desktop:` variant, width ≥ 64rem AND height ≥ 700px) is exactly
  one viewport tall, the page never scrolls.** Left column 24rem:
  `ProfileSection` (constant height) and `GroupTree` (takes the rest; only its
  trees scroll, the "Add timetables" button stays in view). Right column:
  toolbar, grid, footer at its bottom. Anything that only cares about width
  keeps `lg:` / `md:`.
- **Below `desktop` (phones AND short laptop screens): a fixed bottom tab bar
  "Timetable | Groups | Settings"** (user decision). Timetable = grid plus a
  dock of view switch, week nav and day toggle, all at the bottom within
  thumb reach (user decision). Groups = profiles, group tree. Settings is no
  tab: it opens the footer's content (Data menu items, language, note) as a
  menu upwards (user decision: no footer on phones). The active tab is marked
  by a primary line on the bar's divider, not a filled button. Start tab:
  Groups when the active profile has no timetables, else Timetable; not
  persisted. The page keeps bottom padding for the bar, toasts sit above it.
- The dock is the same element as the desktop toolbar: last in the timetable
  column and `sticky` to the top of the bar, so it needs no guessed page
  padding; `desktop:` puts it back above the grid. `WeekNav` stays one row
  there (short range label below `sm`) so the dock is at most three rows.
- **No boxes** (user decision): sections are split by divider lines, `Section`
  is shadcn's `Card` minus background, shadow and ring. One spacing unit
  (24px) around every divider — change the paddings together so edges stay
  aligned.
- Footer (desktop only; phones: the tab bar's Settings menu, same
  `DataMenu` with `settings`) = note · "Data" menu · EN/DE. The Data menu holds own dates ↔
  catalog dates, "Update catalog data" (dates, locations, abbreviations only —
  timetables never update by themselves), Save backup, Load backup. Load
  validates first (broken → error toast, nothing touched), then confirms
  ("Profiles now: N, in the backup: M") with "Save current backup first" in
  the dialog; restoring replaces everything but the catalog cache.
- Exports (ICS | Link | profile file) live in `ProfileSection` and work while locked.
  **Never in the header** (user decision): up there they would imply global
  state like the dates, which never leave the device. Link warns first when a
  timetable is outside the catalog (the receiver needs its file); past
  `MAX_SHARE_LENGTH` it is disabled and the profile file becomes the obvious fallback.
  ICS without dates asks for the range.
- Transient feedback is a toast, never a panel. Copying the link toasts too
  (user decision), on top of the button's inline "Copied".
- Own file extensions, JSON inside (user decision, so users tell the files
  apart): `.timetable`, `.profile`, `.backup`; the pickers accept only their
  own. Downloads go out as `application/octet-stream` so no browser appends
  `.json`. Catalog files and own dates uploads stay `.json`.
- `@/lib/ics` is only reached through `import()`, date pickers only through
  `LazyCalendar` — both stay out of the first load.

## Grid

- Mon–Fri, 8–20. `other` is NO column (user decision): a list beside the grid
  (below `md` instead of it, picked like a day) with weekend events, `other`
  classes, SH1/SH2 and dates in the general view, and anything outside the
  hours.
- Below `md` one day at a time (`DayToggle` in the dock, defaults to today; App
  owns the day), other columns hidden with CSS; horizontal touch swipe changes the day. The overlay is
  `pointer-events-none` so swipes work; a pointer that moved > 10px is a
  swipe, not a click.
- Opens on Current week inside the lecture period, General otherwise (user
  decision).
- Block popup spells out subject, kinds and repeat; the letter badge is hidden
  for weekly `A`. The popup names NO timetable (user decision; the tint does);
  the grid's calendar entries do.
- **Tree ↔ grid** (user decision): on desktop, hovering (mouse, read off the
  ruler by position so it works on locked, disabled cells too) or focusing a
  group cell keeps its blocks and dims all others — a class toggle, no
  re-layout. On every screen the popup names the block's group as a control;
  it jumps to the tree cell (phones switch to Groups), unfolds its timetable,
  scrolls to the cell and flashes it.

## Group tree

- One block per timetable (numeric name order): heading, one row per
  category, then that timetable's warnings — no separate warnings panel (user
  decision). Folding a timetable keeps a warning count in its heading.
  Open/closed is not persisted.
- **A category row is a ruler, never a wrapped list.** Group `n.i` owns slice
  `[(i-1)/n, i/n]` of the row, exactly as `isOverlapping` reads it, so rows
  line up and show which combinations work. n equal grid columns, cells flush
  (`-ml-px`), always one line; percentage flex bases do NOT work. What gives
  way is the label (`--cell-font` scales with the slice). Check categories 1,
  2, 3, 6, 12 stacked at 1440 and 360px after touching it.
- Partial selection per category, not per cell: `ClassPicker`, one row per
  slot (user decision), each with a pen that opens the subject editor.
- No "select all / none" (user decision: redundant).
- Lock applies to the profile: tree cells, pickers, rename, delete, removing a
  timetable, subject edits and update decisions are disabled; exports and
  downloads keep working.
- A catalog timetable's heading icon: nothing for `local`, offline, update
  waiting (the only button, opens `UpdateDialog`), or current (a refused
  update counts as current).

## Profiles

- Profile dropdown: profiles · Add · Duplicate · Rename · Delete. Duplicate
  copies the whole profile unlocked and works while the source is locked; its
  name is asked with "Name 2" suggested. A taken name is refused, never
  suffixed.
- `TimetablePickerDialog` is the ONLY way a timetable enters a profile (new
  profile or add), one row per source (see `src/lib/NOTES.md`). A new empty
  timetable is created only if still checked on confirm. Every way out of a
  dialog resets it. A confirm or upload still waiting on a download
  when the dialog closes (or goes back) is dropped, never applied late.
- `ImportDialog` always creates a NEW profile: a profile file imports at once;
  a link asks for the name and shows per timetable where its content is found
  (a local copy, the catalog, or missing — upload it right there).

## Checking

Phones at 360px in German (longest labels) and 400px, English too; desktop 1440. Screenshots cannot swipe or hover: flip a `useState` default
temporarily, or drive pointer events from a throwaway `public/_*.html` that
iframes `/`, and delete it after.
