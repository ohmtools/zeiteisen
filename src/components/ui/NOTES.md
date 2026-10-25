# src/components/ui — notes

Copies from [ohmtools/design](https://github.com/ohmtools/design)
(`shadcn/src/components/ui/`), like `src/components/ohmtools/`,
`src/lib/ohmtools/` and `src/styles/ohmtools.css`: shadcn's components with
the design's hand-edits. Each starts with a marker naming its source; **never
edit them here** (nor format them: `.prettierignore`). A change goes into the
design first, for every app, then
`npx --yes github:ohmtools/design add <name>` here; CI runs
`ohmtools-design check` on them. The hand-edits came from zeiteisen; their
reasons stay below.

Style `base-vega` (Base UI primitives, not Radix), switched from `base-sera`
in the redesign (user decision). The theme (colours, radius, Geist) is the
design's, in `src/styles/ohmtools.css`.

- A component the design does not have: `npx shadcn@latest add <name>` into
  `src/components/ui/`, or where the registry cannot be reached shadcn's
  base components (`apps/v4/registry/bases/base/ui/<name>.tsx` in
  shadcn-ui/ui) with every `cn-*` class replaced by its `@apply` list from
  `apps/v4/registry/styles/style-vega.css` and the icon placeholders made
  lucide icons — what the registry build does. Then the hand-edits below.
  Needed by a second app, it belongs in the design.
- Tailwind classes in app components for layout plus semantic tokens
  (`text-muted-foreground`, `border`, `bg-kind-pr`, `text-warning`); no
  raw colours.
- Base UI, not Radix: composition `render={<Button />}`, not `asChild`.
  `Tabs` and `ToggleGroup` values are `unknown` / `string[]`; narrow with a
  type guard (see `ViewSwitch.tsx`), no casts.
- **No uppercase text** (user decision): `uppercase` and
  `tracking-wider/widest` stripped from `src/components/ui/*` (the menu
  shortcut). No reintroduce; strip from newly added components too.
- Hand-edits (DESIGN.md, "Hand-edits"), kept when the design regenerates:
  - `PopoverContent` forwards `anchor` to Base UI's `Positioner` (the grid's
    details open where the pointer clicked).
  - `DialogHeader` carries `pr-10`: the close X is absolute in the top right
    corner, so without it title and wrapping description run into it.
  - `DialogContent`: from `compact:` on centred, at most 28rem (a dialog
    widens it with its own `compact:max-w-…`); below `compact:` a sheet
    from the bottom edge, never shown there (phones get a drawer,
    `Popup`).
    `DialogFooter` stacks below `compact:` (main button on top, full width)
    and is a row from there — `compact:`, not `sm:`, so a phone turned
    sideways gets the row too.
  - `Button` variant `destructive` is filled red (`bg-red`, the one accent);
    red text alone is `text-destructive`.
  - `AlertDialogCancel` defaults to `ghost` (user decision: buttons are
    ghost unless they are the main action).
  - The overlays of `Dialog`, `AlertDialog`, `Sheet` and `Drawer` are a plain
    scrim, `bg-black/40 dark:bg-black/70`, no blur (the design darkens).
  - Every floating surface is frosted glass (user decision: a popover on an
    iPad stood out too little from the black grid): `popup-glass`
    (the design's stylesheet) instead of `bg-popover` and shadcn's shadow on
    `PopoverContent`, `DialogContent`, `AlertDialogContent`, `SheetContent`,
    `DrawerContent`, `SelectContent` (its `before:` blur layer is gone) and
    `SuggestInput`'s popup; the edge `ring-foreground/30` (sheets and
    drawers: `border-foreground/30`). The drawer's bleed is the same glass
    colour. The toasts (`sonner.tsx`) take it through `--normal-bg`,
    `--normal-border` and the class.
  - `TabsList` (default variant): one indicator span before the tabs glides
    to the active tab (`translate` + `width`, measured from `offsetLeft` /
    `offsetWidth`, re-measured on `data-active` changes and resizes); the
    active tab itself has no fill, border or shadow any more. Not Base UI's
    `Tabs.Indicator`: it put 3 KB gzip into the first load.
  - `SheetContent` and `DrawerContent` round their free corners 10px
    (`rounded-*-lg`, design: "dialogs, drawers and sheets"), not square or
    shadcn's 14px.
  - `DrawerContent` wraps its viewport in Base UI's
    `Drawer.VirtualKeyboardProvider` and a drawer from the bottom stands on
    `--drawer-keyboard-inset`: the keyboard covers the page
    (`resizes-visual`), and a field focused as the drawer opens (a
    timetable's name) stayed under it until tapped a second time.
  - Motion at half speed (design decision, 2026-10-25): shadcn's 100 ms
    popups (`Popover`, `Select`, `AlertDialog`, the centred `Dialog`,
    `SuggestInput`'s popup) take 200 ms; the phones' dialog sheet and its
    scrim 400 ms, both `data-closed:fill-mode-forwards` (else the scrim
    springs back for a frame before it unmounts); `Sheet` and its scrim
    560 ms in, 400 ms out in the app's easing; `Drawer` 560 ms in (its own
    easing; a swipe's close stays its own); the tab indicator 560 ms.
  - `checkbox.tsx`: the indicator renders `MinusIcon` instead of `CheckIcon`
    when `indeterminate` is set, so a partial pick reads as partial.
  - `sonner.tsx`: shadcn's version imports `useTheme` from `next-themes`,
    which this project never uses; `theme="system"` instead (sonner then
    reads `prefers-color-scheme`, the same source as `ThemeProvider`).
    Mounted once, by the design's `AppToaster` inside `AppShell`, which also
    lifts toasts above the phones' bottom bar.
  - `DialogContent` and `SheetContent` take `closeLabel` (the close
    button's name in the app's language).
- `cn` comes from the `cn` package (shadcn's clsx + tailwind-merge
  replacement), not a local helper. `src/lib/utils.ts` only re-exports it for
  the shadcn CLI (`components.json`).
- Dark mode = shadcn's `.dark` class, set by the design's `ThemeProvider`
  (`src/components/ohmtools/theme-provider.tsx`, in `AppShell` and around
  the error screen in `main.tsx`) from
  `prefers-color-scheme`, live. Blocking `public/dark.js` (not inline: CSP
  without hashes) in `index.html` sets `.dark` before first paint (plus the
  `color-scheme` meta) so dark users get no white flash on load or locale
  switch. Keep both. **No theme toggle** (user decision).
- Language follows the browser too (paraglide strategy localStorage ->
  preferredLanguage). The only override: the language tabs in the settings.
- `.oxlintrc.json` turns off `react/only-export-components` for
  `src/components/ui/**` and `src/components/ohmtools/**` — shadcn files
  export their `cva` variants, the design's groups their hooks.
- Wide content inside a single-column grid needs `minmax(0,1fr)` columns
  (`grid-cols-1`), or it widens the page on mobile.
- No combobox: free-text suggestions are `src/components/SuggestInput.tsx`,
  Base UI `Autocomplete` rendering the shadcn `Input`, popup classes copied
  from shadcn's combobox.
