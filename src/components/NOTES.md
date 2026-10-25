# src/components — notes

Shell layout, grid, group selection, panels. shadcn primitives in `ui/` have
their own `NOTES.md`. The design lives on the "Zeiteisen Redesign" canvas
(claude.ai artifact) and in the doc "Zeiteisen-Redesign:
Designentscheidungen"; this file keeps what the code has to hold to.

## Shell

- **The design's element groups** (ohmtools/design, DESIGN.md "Elements by
  step", "Which group"; the copies in `ohmtools/`, never edited here): App
  names the group, the group picks the element per step. `AppShell` (header,
  content, wide sidebar, the bar at the bottom on phones, pages over
  everything, toaster, colour scheme), `Views` ("Week | General") and
  `ViewControls` (week nav or filter, the day bar on phones), `Panel`
  (groups, notes), `Area` (the settings), `Popup` (menus, popovers,
  dialogs, questions) and `toast()`. Each step has its own elements: no
  popups on phones (drawers instead), no drawers from compact on, no sidebar
  on phones, no pages of their own on wide screens.
- Full width, no max-width container. **Every step is exactly one viewport
  tall, the page never scrolls** (user decision): the grid, the panels and
  the phone pages scroll inside themselves. Every region that scrolls is
  `relative` (design rule): an absolute child without a positioned ancestor
  (`sr-only` text) would escape it and make the document taller. The root
  sets `text-sm`, so text without a size of its own is 14px. Three steps
  (`useStep()` from `@/lib/ohmtools/steps`, the `compact:` / `wide:` /
  `short:` variants of the design's stylesheet), the same content in other
  containers (user decision):
  - **Narrow** (below 40rem: phones upright, narrow windows): header with the
    profile and lock, groups, notes, settings; the grid shows one day; at the
    bottom (within thumb reach, user decision) the view tabs, the week nav
    (or the week filter) and the two-line day bar, the picked day red. A
    panel (and the settings) is a page of its own over all that, with a back
    arrow; the rest is inert under it.
  - **Compact** (from 40rem, or under 600px height in landscape: a phone
    turned sideways, iPads upright, small laptops): the whole week, one
    header row (week nav as "‹ CW 43 [today] ›", range from `md`; on an
    iPad upright in German the views take a second row), panels as a 380px
    sheet from the right. On `short` screens blocks show code and kinds
    only, every second hour is labelled, the header is 48px and the details
    are a sheet from the right.
  - **Wide** (from 64rem AND 700px height, the design's: large iPads, iPads
    in landscape, desktops; a laptop with about 650px under the browser's
    bars is compact): the week beside a 340px sidebar, **closable** (user
    decision; was always there). It opens on the groups (user decision),
    elsewhere panels start closed; a first visit has no groups yet, so the
    sidebar opens once the welcome brought a timetable in. Not persisted.
  - Panels are groups and notes only. **The settings are an area** (user
    decision, room for more settings later; was a panel): a dialog on wide
    screens beside whatever panel is open, a page on phones and compact
    screens (the design's, 2026-10-25; was a dialog from compact on).
- Header (`HeaderBrand` / `HeaderActions` in `AppShell`, entry chunk): the
  profile menu's trigger (the logo, name, chevrons; a disabled look-alike
  until the deferred chunk arrives), lock, a divider, the view tabs "Week |
  General", the week nav or the filter; right "Groups" (with its label on
  wide screens), notes, settings, 8px apart. An open panel's button is
  filled, hovered too (dark mode's ghost hover is darker than the fill). A
  first visit (one empty profile) shows the app's name and settings only,
  and the grid's place shows the welcome with three ways in (catalog,
  import, empty timetable). On phones a long profile name truncates.
- The panel's header is App's (`Panel` draws it): groups with "+" (add
  timetables), a category with its title, the timetable as subtitle and a
  back arrow on every step (`onBack`), notes with upload and download
  (`NotesActions`, deferred); the lock on phones. The bodies (`GroupTree`,
  `NotesSection`) are the deferred chunk's.
- Lock applies to the profile, so its button sits on every view of it (header,
  groups page), never on notes or settings. Filled while locked; the groups
  panel then says so with an "Unlock" button (user decision, was no line).
- `WeekNav` stays one row: ‹ · relative label ("This week", "In 4 weeks";
  opens the week picker) with "CW 43 · 19.–25.10." · today (icon only,
  user decision: back to this week and the phone's default day, disabled
  while both are shown) · ›. The picker is a month with week numbers, the
  shown week a band, today red, and "This week" under a divider (user
  request); `Popup kind="popover"`, a drawer on phones.
- General view: "All weeks | Even weeks | Odd weeks" takes the week nav's
  place and height; on `short` screens "All | Even | Odd" (one header row
  holds it only with less in each part, the design's rule). It filters G and U only (user decision): G1, G2, U1 and
  U2 stay and show their code, SH1/SH2 and listed dates stay in Other.
- **No boxes** (user decision): sections are split by divider lines. One
  spacing unit (24px, 16px on phones) around every divider — change the
  paddings together so edges stay aligned. Safe areas pad header, grid,
  pages, bottom bar and sheets (`viewport-fit=cover` in `index.html`).
- Settings (`Settings.tsx`, the design's `Area`; design on the canvas
  "Zeiteisen Einstellungen"): five sections, the same on every step (user
  decision). Wide: a dialog of up to 1000×720 (user decision, was 760×560;
  24px off the screen's edges below that), the sections on the left
  (240px), the picked one on the right under its title with the close
  button, scrolling inside; it opens on "General" and keeps the last
  section while the app runs. Phones and compact screens: a page listing
  the sections, each row with what is set now (language, own files in use,
  catalog mode, version), each section a page one level deeper (forward /
  back transitions, back goes to the list). `useDataControls`' dialogs and
  file inputs render inside the open section, so their dialogs stand over
  the settings dialog.
  The sections: general (language tabs, the languages named in themselves;
  a note that light and dark follow the browser), own files (below them,
  after a divider, "Create with AI…" with a note), catalog (mode tabs
  "Ignore | Auto-update | Freeze", applied on pick — nothing passes through
  ignore — with its explanation; under "Source" "Catalog URL…"), backup
  ("Save backup", "Load backup…" with what a backup holds; after a divider
  "Delete data…" in red), about (name, version, GitHub mark, note, "Debug
  info"). Its dialogs open over the settings dialog. Rows are ghost buttons flush with the text; `useDataControls`
  (`DataControls.tsx`) holds their state, dialogs (`DataDialogs.tsx`) and
  hidden inputs. Own files: dates and locations one row each ("Load …"
  while the catalog's is in use, "Use catalog …" plus a trailing "own file"
  note while an own file is, disabled while the catalog is ignored); degree
  programs "Load …" / "Add …" (several `.degree` files, trailing "n own";
  after picking, a dialog asks each file's name — the `degreeProgram`
  subjects name, filled in with its file name without `.degree`, stored NFC
  like every typed name, unique in any case, noting a name that replaces a
  held file, else one that replaces a catalog file (named, in the catalog's
  spelling, which the file then takes); cancel loads none) plus "Remove own
  degree programs…", a dialog listing the files with a remove button each and
  "Remove all"; removing is immediate, the last one closes it. "Create with
  AI…" (always enabled) opens `SkillDialog`, with a download of the shipped
  `zeiteisen-generator.zip` (root-based `BASE_URL` href, never relative:
  share links open the app on `/s/`). While any own file is in use a muted
  line says how they combine with the catalog. Load backup validates first
  (broken → error toast), then confirms ("Profiles now: N, in the backup: M")
  with "Save current backup first"; restoring replaces everything but the
  catalog cache. "Delete data…": the reset for when storage breaks the app;
  its dialog ticks parts (none at first, `@/lib/reset`, list in
  `DataParts`), offers "Save current backup first", removes and reloads.
- Error screen (`ErrorBoundary`, first chunk): title, text, Reload. Below it
  `ErrorTools` from the deferred chunk: "Save backup" and "Delete data…",
  since the settings are out of reach and no toaster runs. If that chunk does
  not load either, the screen stays with Reload alone.
- Profile menu (`ProfileMenu`, deferred; `Popup kind="popover"`, a drawer
  on phones):
  the profiles with the active one ticked and a lock on locked ones, each
  row with rename, duplicate and delete (icon buttons without gaps); "New
  profile", "Import…"; then the active profile's exports. Duplicate copies
  the active profile (another row's is picked first), unlocked, under a name
  asked with "Name 2" suggested; it works while locked. A taken name is
  refused, never suffixed. Delete asks nothing: the toast offers "Undo"
  (`restoredState`), which also drops the fresh default that deleting the
  last profile started.
- Exports (`.ics` | Link | `.profile`) live in the profile menu and work
  while locked. **Never in the header** (user decision): up there they would
  imply global state like the dates, which never leave the device. ICS over
  the lecture period also holds listed dates outside it; classes without a
  weekday are named in a warning toast (`src/lib/NOTES.md`, `ics.ts`). Link
  warns first when a timetable is outside the catalog (the receiver needs its
  file); past `MAX_SHARE_LENGTH` it is disabled and the profile file becomes
  the obvious fallback. ICS without dates asks for the range.
- Transient feedback is a toast (`toast()` from `@/lib/ohmtools/toast`),
  never a panel; on phones above the bottom bar (`--bottom-bar`), elsewhere
  bottom right. Copying the link toasts too
  (user decision), on top of the button's inline "Copied".
- Popups (`Popup`, DESIGN.md "Popups"): on phones every menu, popover,
  dialog and question is a drawer from the bottom (the content 16px under
  the swipe handle, buttons 44px, the main one on top); from compact on a
  menu or popover at its trigger, a centred dialog or question, destructive
  buttons red next to "Cancel". Leaving without choosing (a swipe down, a
  press outside, Esc, the close button) runs the popup's Cancel; a dialog
  without a Cancel does nothing then and shows no swipe handle. On phones
  the long or multi-step dialogs (subject editor, import, timetable
  picker) are pages of their own (`page`), over the groups page too, their
  back arrow runs Cancel. Over a dialog only another dialog or a question:
  the export's dates are the device's date fields, the subject editor's
  multi-date month opens in place (`Expand`). The grid's
  details are the one exception to `Popup` (one popover for the whole grid,
  at the pointer, below): `DetailsSheet` with the design's `PhoneDrawer`.
- **Undo before questions** (the design's): what can be brought back is
  removed at once and the toast offers "Undo" for 8 s — a profile, a
  timetable, a class (the timetable as it was, catalog origin included,
  while nothing changed it since) and notes replaced by an upload. Questions
  stay for what cannot be undone: "Delete data…", loading a backup, a
  catalog timetable turning local.
- Own file extensions, JSON inside (user decision, so users tell the files
  apart): `.timetable`, `.profile`, `.backup`, `.degree`; the pickers accept
  only their own. Downloads go out as `application/octet-stream` so no browser
  appends `.json`. Catalog dates / locations and own dates / locations uploads
  stay `.json`. The `.degree` extension is never shown: a degree program is its
  bare name everywhere in the UI.
- `@/lib/ics` is only reached through `import()`, date pickers only through
  `LazyCalendar` — both stay out of the first load.

## Notes

- A panel (sidebar, sheet or page; user decision, was a strip under the grid
  on desktop). Plain text in `tt.notes.v1`, never shared (no link, no
  profile file; the backup holds it). At most `MAX_NOTES_LENGTH` characters
  (1,000,000, user decision), a count shows from 90% on.
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
  N). The view copies the text area's box and type so no line moves. The
  text area sits inside the panel's padding like everything else, the same
  space left, right and below (user request; a negative margin to line its
  text up with the hint shifted it left only, `w-full` kept its width). No
  underline on either, focused or not (user decision).
- N anywhere outside a field, dialog or menu (App, `isNotesShortcut`) opens
  the notes panel with the caret at the end (`flushSync`: the text area has
  to be on screen to take the focus). Escape in the text area goes back to the
  grid.
- Download: `zeiteisen-notes-<date>.txt` (localized), `text/plain`.
- Upload: any `.txt` (`notesFromFile`): UTF-8 only, BOM dropped, CRLF made
  `\n`; not text or over `MAX_NOTES_LENGTH` = a toast, nothing changes. It
  REPLACES the notes (no merging); with notes there that differ, the toast
  offers "Undo" (while nothing was typed since) instead of a question first
  (the design's undo before questions; was a question with "Save current
  notes first"). Plain text has no schema, so no zod here.
- The on-screen keyboard covers the page instead of resizing it
  (`interactive-widget=resizes-visual` in `index.html`, the design's rule:
  the keyboard never changes the step); the browser keeps the caret in
  view, and a drawer stands above the keyboard (the design's `Drawer`). Was
  `resizes-content` for the notes' sake.

## Grid

- 08:00–19:00 (user decision, was 20:00), Mon–Fri plus **Other** as a sixth
  column of the same width (weekend events, `other` classes, SH1/SH2 and
  dates in the general view, anything outside the hours), not aligned to the
  hours. Phones show one column, picked in the day bar, Other included.
  The frame is open on the left, rounded on the right; the hour lines are
  `--grid`, the labels mono `--hour`, centred on their line, 19:00 just
  above it.
- **The hours never move** (user decision): the all-day row is always there,
  one line (36px, 32px on phones), also in General, where it explains
  itself ("Regular classes, whatever the week"); empty it says "No all-day
  events". Neighbouring days with the very same events share one chip
  (`@/lib/allday`); a day with several shows "+n", a press lists them (a
  popover on iPad and desktop; in the details' drawer or sheet on phones and
  `short` screens, like a block, user request); a lecture-free day wins the
  line. Then 12px to the first hour line.
- Height: the hours share the leftover height down to a floor that keeps the
  shortest block's lines whole (`BLOCK_MIN_HEIGHT` × 60 / its minutes: three
  lines, two on `short` screens; never under 24px). Below the floor the body
  scrolls inside the frame (iPhone SE, Safari with its bars), day names and
  all-day row stay.
- **Colour by kind only** (user decision, was a tint per timetable): the most
  specific kind of the subject (`colourKind`: Pr, Ue, Tu, S, WF, SU), the
  kinds always also written in the block. Name never cut or broken inside;
  kinds and group, then room (mono); in General the rhythm ("even weeks",
  "G1").
- **No lane narrower than 48px** (user decision, `fitDay`): a column too
  narrow for every lane of a cluster keeps its first lanes and gathers the
  rest into the last one as a dashed collected block (codes stacked, "+n"
  when they do not fit, a press lists them and each opens its details). The
  column width comes from a `ResizeObserver` on the body.
- Current week names each weekday's date: "Mo 19" in the heads, two lines
  in the phone's day bar. Today: its date on red, the red now-line with its
  dot at the column's left edge. A lecture-free day is covered by the
  surface colour with "No lectures"; lectures there are gone (listed dates
  still meet, above the cover).
- A week without classes says so over the grid, where the next ones start
  and jumps there (`nextWeekWithEntries`, only computed for an empty week).
  A profile without timetables shows its own card there.
- Opens on Current week inside the lecture period, General otherwise (user
  decision).
- A horizontal touch swipe changes the day on phones, the week on compact
  screens (Current week only); never on wide ones (the design: no swipe
  gestures there), the buttons do it everywhere. The overlay is `pointer-events-none` so swipes work; a
  pointer that moved > 10px is a swipe, not a click.
- Details (user decision: names NO timetable): kind badges in their colours
  and the group, the full name with the code under it, time with rhythm and
  "on now", lecturer, room with building, "Map" and "Campus", "Module
  description" (only with a degree file, opens `SubjectInfoDialog`), note,
  "on request"; then "Switch class off", "Edit class" (both hidden while
  locked; editing asks first for a catalog timetable) and "Show in groups".
  The open block gets a light border. A popover on iPad and desktop, opened
  where the pointer clicked (Enter / Space, or a click with `detail` 0: beside
  the block); a drawer on phones, a sheet on `short` screens (`DetailsSheet`,
  deferred). A swipe opens nothing; one that changes the day closes it.
- **One popup for the whole grid** (state in `TimetableGrid`), not a Base UI
  popover per block: a root per block was most of the first render of a full
  grid. Blocks are `role="button"` divs that do what a trigger did by hand:
  Enter / Space, `aria-expanded`, a press on the open block closes it, on
  another moves it there (a press on a block is no outside press). Pointer
  opens leave focus where it is, key opens move it in; closing returns it to
  the block. A press never focuses a block (`preventDefault` on mousedown).
  The popup shows the entry under its key as the grid has it now: an edit
  shows at once, a block that left the grid takes the popup with it.
- **Tree ↔ grid** (user decision): on wide screens, hovering (mouse, read off
  the ruler by position so it works on locked, disabled cells too) or
  keyboard focus (`:focus-visible`) on a group cell keeps its blocks and dims
  all others — a class toggle, no re-layout; so does an open category view.
  "Show in groups" opens the groups panel on its overview, scrolls to the cell
  and flashes it: smoothly when the overview was already shown, at once when
  it has just opened (the cell mounts flashing).
- Hovering a block with the mouse gives every block of the same subject name
  (across timetables) a faint ring (user decision: subtle, nothing dimmed).
- Screen readers: a block in the hour grid carries its day (or date) and time
  as `sr-only` text, every block its timetable (nothing visible names it).
  Hour labels are `aria-hidden`, the now-line too.

## Group selection

- A panel (`GroupTree`). Overview: one section per timetable (numeric name
  order): name with update (red dot: an update waits; opens `UpdateDialog`),
  pen (`TimetableDialog`: name and "Remove timetable", at once with "Undo"
  in the toast) and
  download; under it one status line (user decision): "Own timetable · no
  updates", "From the catalog · current / outdated / catalog unreachable /
  catalog ignored" (a refused update counts as current). Then "Classes
  without a group" (one cell "All classes") if there are any, a ruler per
  category (ascending), "partly picked" under a ruler with dashed cells,
  "No group picked yet" right under its category, the other warnings (one
  amber line per kind, user decision, `@/lib/warnings`), "Add subject".
  Header: "+" adds timetables (`TimetablePickerDialog`).
- **A category row is a ruler, never a wrapped list.** Group `n.i` owns slice
  `[(i-1)/n, i/n]` of the row, exactly as `isOverlapping` reads it, so rows
  line up and show which combinations work. n equal grid columns, nothing
  else; what gives way is the label (`--cell-font` scales with the slice).
  Check categories 1, 2, 3, 6, 12 stacked at 1440 and 360px after touching it.
- A group cell is an on/off switch that keeps the manual pick (user
  decision): on (filled like a picked tab), off (plain), partly on (dashed).
  Switching off a partial group remembers its picked classes, switching it on
  brings them back (all classes when nothing is remembered or the subjects
  moved). Several groups on at once are fine. Session memory only, per
  timetable, in `GroupTree` (`@/lib/groupToggle`); a reload forgets it.
- With two or more used groups a tri-state icon next to the category's name
  switches all of them: every group on → all off, each remembering a partial
  pick; otherwise the groups that are off come back on with their pick.
  Disabled while locked.
- Category view (the chevron at the category): the same ruler, a search,
  every subject (same name and kinds) as a fold with its used groups as
  badges (amber when it breaks a rule: several groups, or every class off),
  at most half the row wide, wrapping into more lines (twelve of category 12
  overflowed the panel).
  Open: per used group "Only this one" and its classes with a checkbox and a
  pen; "Show other groups · n" adds the rest, each switchable alike. One row
  per entry, never merged (user decision): a class listed twice with
  different slots is two rows.
- Any subject change turns a catalog timetable local (no more updates), so
  for one the user is asked first, on "Add subject", the pen or the block's
  "Edit class", before the editor opens (user decision: never after the
  changes are made). Adding suggests a new empty timetable instead (user
  decision), "Add to BEI3 anyway" is the other way; a local timetable is
  never asked about. `SubjectEditor` (in `AppDialogs`) holds the request,
  the question and the editor, read against the current timetables.
- Subject editor: an optional "Degree program" select (None + every degree
  file on the device, by its bare name, after the name because it decides the
  name hints). The draft's own value stays listed even when its file is not
  on the device, so an edit never drops it silently.
- Screen readers: each category ruler is a `group` labelled by its category
  line; a cell with some of its classes picked is `aria-pressed="mixed"`. The
  icon buttons name their timetable ("Download BEI3"). The jump's flash and
  scroll respect `prefers-reduced-motion`.
- Lock applies to the profile: cells, checkboxes, rename, removal, subject
  edits and update decisions are disabled or hidden; exports and downloads
  keep working.

## Profiles and timetables in

- `TimetablePickerDialog` is the ONLY way a timetable enters a profile (new
  profile or add), one row per source (see `src/lib/NOTES.md`): a search,
  then new rows (uploads, empties), the catalog by folder ("Catalog · B-EI")
  with its change date, then "From other profiles" ("Copy from “X” · 14 of 40
  picked"). Content the profile holds already is greyed out ("Already in the
  profile"); the profile's own copies are not listed. Below: "Empty
  timetable", "Upload file…", "Let an AI create it…". Offline: "Catalog
  unreachable" with "Try again". A new empty timetable is created only if
  still checked on confirm. Every way out of a dialog resets it. A confirm or
  upload still waiting on a download when the dialog closes is dropped,
  never applied late.
- `ImportDialog` always creates a NEW profile: a profile file imports at once;
  a link asks for the name and shows per timetable where its content is found
  (a local copy, the catalog, or missing — upload it right there).
- `UpdateDialog`: "New", "Changed" (old → new per field: a class whose
  `SubjectID` pairs up uniquely, `diffSubjects`) and "Dropped", then "Later",
  "Reject" (never offered again for that version) and "Apply". Never applied
  by itself.

## Motion

The app moves where state changes, never for decoration; how it is done is in
`src/lib/NOTES.md` (`motion.ts`). One easing, `cubic-bezier(0.2, 0, 0, 1)`,
at half the usual speed (design decision, 2026-10-25): 560 ms coming in,
400 ms going out, shadcn's popups 200 ms; hover and press feedback stays
quick. Everything stops under `prefers-reduced-motion` (the design's
stylesheet).

- Week and phone day: the day heads' labels, the columns' contents (never the
  hour lines or borders) and the all-day row slide in from the side the week
  moved to (the general view counts as after every week: second tab), one
  column 24ms after the other. The week nav's label slides with them.
- Blocks fade and zoom in when they mount (a group switched on, another filter,
  a collected block split up, the first paint); dimming and the related ring
  ease; hover lifts the colour a little, a press shrinks it a little. CSS only:
  a block's cost multiplies by hundreds.
- Tabs: one indicator glides to the picked tab (`ui/tabs.tsx`); the phones'
  day bar: the red pill glides from day to day (each date eases to its own
  colour, never inheriting the button's mid-fade grey).
- Wide sidebar: slides in and out from the right, the grid takes its new
  width at once (a crossfade of the two widths showed every block twice).
  Phones: a panel's page comes in from the right, back goes the other way.
- Groups: the category view slides in from the right and back from the left;
  a subject's fold opens by its height; cells ease between on, off and
  partial and give a little under a press.
- The now-line's dot pulses slowly and the line glides on with the minute.
  Welcome and empty-grid cards rise in.

## Checking

Phones at 360px in German (longest labels) and 400px, English too; a phone
turned sideways (844×390); desktop 1440; dark and light. Screenshots cannot
swipe or hover: flip a `useState` default temporarily, or drive pointer
events from a throwaway `public/_*.html` that iframes `/`, and delete it
after.
