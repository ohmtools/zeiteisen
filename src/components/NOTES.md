# src/components — notes

Shell layout, grid, group tree. shadcn primitives in `ui/` have their own
`NOTES.md`.

## Shell

- Full width, no max-width container. No header (user decision): logo,
  name and version (`Brand`) sit in the desktop footer and the phone's
  Settings page; an `sr-only` h1 keeps the page titled. The version is
  `package.json`'s, put in at build time as `__APP_VERSION__` (`define` in
  `vite.config.ts`, declared in `src/env.d.ts`), so the user can tell which
  deploy a browser runs; the pre-commit hook bumps its patch
  (`scripts/NOTES.md`).
- **Desktop (`desktop:` variant, width ≥ 64rem AND height ≥ 600px) is exactly
  one viewport tall, the page never scrolls.** Left column 24rem:
  `ProfileSection` (height set by its content) and `GroupTree` (takes the rest;
  only its trees scroll, the "Add timetables" button stays in view). Right
  column: toolbar, grid, notes, footer at its bottom. The notes are a strip
  (user decision): a title row ("Notes" folds it to that row; upload and download on
  the right) over the text. Its top edge drags its height (or
  arrow keys on it; double click = default), 144px by default, kept between
  112px and 60% of the screen. Folded by default (user decision); height and
  folding persist on the device (`tt.notesstrip.v1`). App sets the wrapper's height, so the grid does not
  jump when the deferred chunk arrives. Anything that only cares about
  width keeps `lg:` / `md:`.
- **Below `desktop` (phones AND short laptop screens): a fixed bottom tab bar
  "Timetable | Groups | Notes | Settings"** (user decision). Timetable = grid plus a
  dock of view switch, week nav and day toggle, all at the bottom within thumb
  reach (user decision). Groups = profiles, group tree. Notes = the same
  `NotesSection` element as on desktop (it sits in the timetable column; the
  notes tab hides dock and grid), titled, filling the page, one viewport
  tall like the Timetable tab. Settings =
  `SettingsPage`, the footer's content as a page (user decision: no footer on
  phones; was a menu upwards out of the bar): one `Section` each for language
  (first, user decision), own files, catalog, backup and reset, about (name and
  note), every one with its title. Items are full-width outline buttons (the
  Data menu's items, from the same `useDataControls`), the catalog mode a
  vertical toggle group applied on pick (nothing passes through ignore, so no
  pending mode), the language a toggle group of the languages named in
  themselves. The active tab is marked by a primary line on the bar's divider,
  not a filled button. Start tab: Groups when the active profile has no
  timetables, else Timetable; not persisted. The page keeps bottom padding for
  the bar, toasts sit above it. Page, bar and toasts also pad by
  `env(safe-area-inset-*)` (home indicator, landscape notch); that needs
  `viewport-fit=cover` in `index.html`, without it iOS reports 0 and an
  installed PWA's bar sat under the home indicator.
- The Timetable tab is exactly one viewport tall on phones, no page scroll (user
  decision; Groups and Settings keep page scroll). Top to bottom: grid (the hour
  rows share the leftover height, floor 24px so common phones need no scroll
  (user decision, was 36px); below that the grid scrolls inside itself), week
  nav (an empty row of the same height in General, so the grid keeps its
  height), day toggle, view switch, tab bar (user decision). The shown week and
  day move on with the clock unless the user picked one that still lasts
  (`src/lib/NOTES.md`, `view.ts`). The dock is the same element as the desktop
  toolbar, last in the timetable column; `desktop:` puts it back above the grid
  as one row (switch left, week nav right). The hour rows share the leftover
  height on desktop too, same 24px floor (user decision, was fixed 56px: a
  landscape tablet under its browser bars had to scroll). `WeekNav` stays one
  row: prev · relative label ("This week", opens the week picker) · next, then
  the range as plain text above the week number (short range below `sm`) (user
  decision: the range was its own picker button). The week picker ends in a
  "This week" button under a divider (user request), disabled while this week
  is shown.
- **No boxes** (user decision): sections are split by divider lines, `Section`
  is shadcn's `Card` minus background, shadow and ring. One spacing unit
  (24px) around every divider — change the paddings together so edges stay
  aligned.
- Footer (desktop only; phones: the Settings tab, same content as a page) = logo
  and name · note · "Data" menu · EN/DE. `useDataControls` (`DataControls.tsx`)
  holds the menu's state, dialogs (`DataDialogs.tsx`) and hidden inputs and
  hands both `DataMenu` and `SettingsPage` the items as `DataAction`s. The Data
  menu has three groups, each headed by a `DropdownMenuLabel` (user decision):
  "Own files", "Catalog", "Backup and reset". Explanations between items are
  plain muted text, not group labels: Base UI names a group by its last
  `GroupLabel`. Own files — dates and locations one item each ("Load own …"
  while the catalog's is in use, "Use catalog …" plus a trailing "own file" note
  while an own file is, disabled while the catalog is ignored); degree programs
  "Load own …" / "Add own …" (several `.degree` files, trailing "n own files";
  after picking, a dialog asks each checked file's name — the `degreeProgram`
  subjects name, filled in with its file name without `.degree`, stored NFC like
  every typed name, unique in any case, noting a name that replaces a held file,
  else one that replaces a catalog file (named, in the catalog's spelling, which
  the file then takes); cancel loads none) plus "Remove own degree programs…", a
  dialog listing the files by name in upload order with a remove button each and
  "Remove all"; removing is immediate (the user still has the file), the last
  one closes it. One hidden file input outside the menu, which unmounts its
  content on closing. Last in the group, always enabled (also with the catalog
  ignored): "Create own files with AI…" opens `SkillDialog` — what the AI skill
  makes, how to get it into Claude / other skill apps / a chat, a
  check-the-results hint, and a download of the shipped
  `zeiteisen-generator.zip` (root-based `BASE_URL` href, never relative: share
  links open the app on `/s/`). While any own file is in use a muted line says
  how they combine with the catalog and that it never updates them. Then the
  catalog — "Mode" cycles ignore → auto-update → freeze on click WITHOUT closing
  the menu (`closeOnClick={false}`), the mode as trailing note and its
  explanation as a muted line below (phones have no tooltips). The cycle is only
  a pending choice: the mode shown when the menu closes is applied then (user
  decision), so passing through ignore (freeze → auto) never drops the catalog
  cache and its dates; "Catalog URL…" opens a dialog (empty or "Use default" =
  built-in, absolute http(s) only, trailing "custom" note when set). Then Save
  backup, Load backup. Load validates first (broken → error toast, nothing
  touched), then confirms ("Profiles now: N, in the backup: M") with "Save
  current backup first" in the dialog; restoring replaces everything but the
  catalog cache. Last "Delete data…" (destructive): the reset for when storage
  breaks the app. Its dialog ticks parts (profiles; notes; dates, locations and
  degree programs; catalog cache; settings; offline app files — `@/lib/reset`, list in
  `DataParts`), none at first, offers "Save current backup first", then removes
  the keys and reloads.
- Error screen (`ErrorBoundary`, first chunk): title, text, Reload. Below it
  `ErrorTools` from the deferred chunk (loaded right after the first paint,
  so a tab failing later holds it): "Save backup" and "Delete data…" as an
  inline list, since the Data menu is out of reach and no toaster runs. If
  that chunk does not load either, the screen stays with Reload alone.
- Exports (ICS | Link | profile file) live in `ProfileSection` and work while
  locked. ICS over the lecture period also holds listed dates outside it;
  classes without a weekday are named in a warning toast (`src/lib/NOTES.md`,
  `ics.ts`). **Never in the header** (user decision): up there they would imply
  global state like the dates, which never leave the device. Link warns first
  when a timetable is outside the catalog (the receiver needs its file); past
  `MAX_SHARE_LENGTH` it is disabled and the profile file becomes the obvious
  fallback. ICS without dates asks for the range.
- Transient feedback is a toast, never a panel. Copying the link toasts too
  (user decision), on top of the button's inline "Copied".
- Own file extensions, JSON inside (user decision, so users tell the files
  apart): `.timetable`, `.profile`, `.backup`, `.degree`; the pickers accept
  only their own. Downloads go out as `application/octet-stream` so no browser
  appends `.json`. Catalog dates / locations and own dates / locations uploads
  stay `.json`. The `.degree` extension is never shown: a degree program is its
  bare name everywhere in the UI.
- `@/lib/ics` is only reached through `import()`, date pickers only through
  `LazyCalendar` — both stay out of the first load.

## Notes

- Plain text in `tt.notes.v1`, never shared (no link, no profile file; the
  backup holds it). At most `MAX_NOTES_LENGTH` characters (1,000,000, user
  decision), a count shows from 90% on.
- Two faces of the same text (user decision): a read view where http(s) and
  `www.` links open in a new tab and `- [ ]` / `- [x]` lines (GitHub's task
  syntax, `*` too, indented too) are checkboxes that tick the text itself
  (`@/lib/notes`); the text area while editing. No edit or save button (user
  decision): every keystroke is saved. Tab onto the view opens the text area
  with the caret at the end (links and checkboxes are out of the Tab order,
  they would vanish under it); a click on the view's text
  opens the text area with the caret on that character (`caretAt`, each
  piece carries its offset as `data-start`); a drag selection stays a
  selection for copying. Leaving the text area returns to the view. Empty
  notes are the text area alone (its placeholder explains links, tasks and
  N). The view copies the text area's box and type so no line moves. No
  underline on either, focused or not (user decision).
- N anywhere outside a field, dialog or menu (App, `isNotesShortcut`) opens
  the notes with the caret at the end, unfolding the strip, on phones
  switching to the tab first (`flushSync`, the text area has to be on screen
  to take the focus). Escape in the text area goes back to the grid (desktop;
  the grid's scroll box takes the focus).
- Download: `zeiteisen-notes-<date>.txt` (localized), `text/plain`.
- Upload: any `.txt` (`notesFromFile`): UTF-8 only, BOM dropped, CRLF made
  `\n`; not text or over `MAX_NOTES_LENGTH` = a toast, nothing changes. It
  REPLACES the notes (no merging); with notes there that differ, an alert
  dialog asks first and offers "Save current notes first", like the backup
  restore. A folded strip unfolds to show the new text. Plain text has no
  schema, so no zod here.
- Android's keyboard resizes the page instead of covering it
  (`interactive-widget=resizes-content` in `index.html`).

## Grid

- Mon–Fri, 8–20. `other` is NO column (user decision): a list beside the grid
  (below `md` instead of it, picked like a day) with weekend events, `other`
  classes, SH1/SH2 and dates in the general view, and anything outside the
  hours.
  The list is 8rem wide from `md`, 12rem from `xl` (user decision: tablets
  and small laptops need the room for the weekdays).
- Below `md` one day at a time (`DayToggle` in the dock, defaults to today; App
  owns the day), other columns hidden with CSS; horizontal touch swipe changes
  the day. The overlay is `pointer-events-none` so swipes work; a pointer that
  moved > 10px is a swipe, not a click.
- The all-day row (Current week) has a fixed height (48px phones, 64px from
  `md`), more events scroll inside their cell. General leaves NO space for
  it (user decision, replacing "the hours never move"): no empty gap between
  toolbar and grid, the hours shift when switching views.
- Opens on Current week inside the lecture period, General otherwise (user
  decision).
- Block popup spells out subject, kinds and repeat; the letter badge is hidden
  for weekly `A`. The popup names NO timetable (user decision; the tint does);
  the grid's calendar entries do. It opens where the pointer clicked; opened
  with Enter / Space (a click with `detail` 0 and no coordinates) it opens
  beside the block. A swipe stops it with `preventBaseUIHandler()` — Base UI
  ignores `preventDefault()`.
- **Tree ↔ grid** (user decision): on desktop, hovering (mouse, read off the
  ruler by position so it works on locked, disabled cells too) or keyboard focus
  (`:focus-visible`; a tap focuses the button too on iPad and must not dim the
  grid) on a group cell keeps its blocks and dims all others — a class toggle,
  no re-layout. On every screen the popup names the block's group as a control;
  it jumps to the tree cell (phones switch to Groups), unfolds its timetable,
  scrolls to the cell and flashes it.
- Hovering a block with the mouse gives every block of the same subject name
  (across timetables) a faint ring (user decision: subtle, nothing dimmed).
  Mouse only, so a tap leaves nothing behind.
- The now-line (Current week, today's column) is `--foreground` with a dot at
  the column's left edge, above the blocks: a `--primary` line vanished over
  the blocks (all tints of `--primary`) and looked like a rendering glitch.
- Screen readers: a block in the hour grid carries its day (or date) and time
  as `sr-only` text, every block its timetable (the tint's stand-in; the
  visible popup still names none). Hour rows are `aria-hidden`, the now-line
  too.

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
- Subject editor: an optional "Degree program" select (None + every degree file
  on the device, by its bare name, after the name because it decides the name
  hints). The draft's own value stays listed even when its file is not on the
  device, so an edit never drops it silently.
- A group cell is an on/off switch that keeps the manual pick (user
  decision): switching off a partial group remembers its picked classes,
  switching it on brings them back (all classes when nothing is remembered or
  the remembered subjects moved). Session memory only, in `TimetableTree`
  (`@/lib/groupToggle`); a reload forgets it.
- At the right end of each category line with two or more used groups, just
  left of the `ClassPicker` (user decision), a tri-state checkbox icon
  switches all its groups (user decision, replacing "no select all / none"):
  every group on → all off, each remembering a partial pick; otherwise the
  groups that are off come back on with their pick, the others stay as they
  are. Disabled while locked.
- Screen readers: each category ruler is a `group` labelled by its category
  line; a cell with some of its classes picked is `aria-pressed="mixed"`. The
  heading's icon buttons name their timetable ("Download BEI3"), the class
  picker its category; the folded warning count reads as "3 warnings". The
  jump's flash and scroll respect `prefers-reduced-motion`.
- Lock applies to the profile: tree cells, pickers, rename, delete, removing a
  timetable, subject edits and update decisions are disabled; exports and
  downloads keep working.
- A catalog timetable's heading icon: nothing for `local`, offline, update
  waiting (the only button, opens `UpdateDialog`), or current (a refused
  update counts as current).

## Profiles

- Header: the lock button floats right and title and description flow around
  it (user decision; the card grid kept a column free under the button). The
  description starts exactly at the button's bottom, so its lines run full
  width. No "profile is locked" line (user decision): the button says it.
- Profile dropdown: profiles · Add · Duplicate · Rename · Delete. Duplicate
  copies the whole profile unlocked and works while the source is locked; its
  name is asked with "Name 2" suggested. A taken name is refused, never
  suffixed.
- `TimetablePickerDialog` is the ONLY way a timetable enters a profile (new
  profile or add), one row per source (see `src/lib/NOTES.md`). A new empty
  timetable is created only if still checked on confirm. Every way out of a
  dialog resets it. A confirm or upload still waiting on a download
  when the dialog closes (or goes back) is dropped, never applied late.
  Below the add-empty / upload buttons, a muted line "No file? Let an AI
  create one…" opens the same `SkillDialog`, nested in the picker.
- `ImportDialog` always creates a NEW profile: a profile file imports at once;
  a link asks for the name and shows per timetable where its content is found
  (a local copy, the catalog, or missing — upload it right there).

## Checking

Phones at 360px in German (longest labels) and 400px, English too; desktop 1440.
Screenshots cannot swipe or hover: flip a `useState` default temporarily, or
drive pointer events from a throwaway `public/_*.html` that iframes `/`, and
delete it after.
