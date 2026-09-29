# src/components/ui — notes

Shadcn CLI make this. No hand-edit unless note below say ok.

Style `base-sera` (Base UI primitives, not Radix), theme and font (Inter) pick during
`shadcn init`.

- **Use shadcn defaults. Avoid custom styling** until user ask customize pass.
  Tailwind classes in app components for layout (flex/grid/gap/width) plus semantic
  tokens (`text-muted-foreground`, `border`); no colors, radii, shadows, custom CSS. Only
  sanctioned override: `Section` (`src/components/NOTES.md`, Shell).
- Add components with `npx shadcn@latest add <name>` into `src/components/ui/`. No
  hand-edit those files unless necessary.
- Base UI, not Radix: composition `render={<Button />}`, not `asChild`. `ToggleGroup`
  values `string[]`; narrow with type guard (see `ViewSwitch.tsx`), no casts.
- `ToggleGroupItem` with `spacing={0}` set padding as
  `group-data-[spacing=0]/toggle-group:px-6`; plain `px-*` className lose to it
  (tailwind-merge keep both). Use `px-*!` to override.
- **No uppercase text** (user decision): `uppercase` and `tracking-wider/widest` stripped
  from `src/components/ui/*`. No reintroduce; strip from newly added components too.
- `PopoverContent` forward `anchor` to Base UI `Positioner` (hand-edited, need for
  cursor-anchored subject popup).
- `DialogHeader` carry `pr-10` (hand-edited): the close X is absolute in the top right
  corner, so without it title and wrapping description run into the button. Every dialog
  in the app use this header, so fix belong here, not per dialog.
- `cn` come from `cn` package (shadcn's clsx + tailwind-merge replacement), not local
  helper. `src/lib/utils.ts` only re-export it for the shadcn CLI (`components.json`).
- Dark mode = shadcn's `.dark` class, set by `ThemeProvider`
  (`src/components/theme-provider.tsx`, wrap `App` in `main.tsx`) from
  `prefers-color-scheme`, live. Blocking `public/dark.js` (not inline: CSP without hashes)
  in `index.html` set `.dark` before first paint (plus `color-scheme` meta) so dark users get no white flash on load or locale
  switch. Keep both. **No theme toggle** (user decision).
- Language follow browser too (paraglide strategy localStorage -> preferredLanguage).
  Only override: small EN/DE ghost buttons in the desktop footer, a language
  toggle group on the phone's Settings page; nothing language- or
  theme-related in header.
- base-sera `Button` set no `data-variant`, so `ButtonGroupText`'s outline-border selector
  never match; pass `className="border-border"` if use it.
- `.oxlintrc.json` turn off `react/only-export-components` for `src/components/ui/**` —
  shadcn files export their `cva` variants.
- Wide content inside single-column grid need `minmax(0,1fr)` columns (`grid-cols-1`),
  or it widen page on mobile.
- `sonner.tsx`: shadcn version import `useTheme` from `next-themes`, which this project
  never use. Hand-edited to `theme="system"` (sonner then read `prefers-color-scheme`,
  same source as `ThemeProvider`); `next-themes` uninstalled. Mounted once, by `AppToaster` (deferred chunk), which also moves toasts above the phone tab bar.
- `select.tsx` added by CLI (subject editor), `uppercase tracking-wider` stripped from
  `SelectLabel`. No combobox: free-text suggestions are `src/components/SuggestInput.tsx`,
  Base UI `Autocomplete` rendering the shadcn `Input`, popup classes copied from shadcn's
  combobox.
- `checkbox.tsx`: indicator render `MinusIcon` instead of `CheckIcon` when
  `indeterminate` set, so partial class selection in `ClassPicker` read as partial.
