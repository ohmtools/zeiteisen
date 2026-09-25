# src — notes

- `src/lib/primitives/` is the model (own `NOTES.md`, edit only with
  permission). Everything else is glue: hooks own state, components render,
  `src/lib/*` words and wires. No second model — import types from
  primitives.
- **First paint = the grid.** `App.tsx` statically imports only the shell
  (view switch, week nav, day toggle, grid, footer, tab bar), the state hooks and
  what they need. Sidebar, dialogs, toaster and the footer's "Data" menu come
  from ONE deferred chunk: `components/deferred.ts` re-exports them and App
  `lazy()`s each through the same `import()`. Anything new that is not the
  grid goes behind that import. Fallbacks never shift the layout (sidebar:
  `null`, fixed column; Data menu and the tab bar's Settings slot: a disabled
  look-alike button).
  `vite.config.ts` names only a `react` chunk group, no catch-all `vendor`, so
  `ics`, `react-day-picker` and base-ui dialogs stay next to their only user.
- `App.tsx` holds shell state: view, week, phone tab, tree ↔ grid highlight
  and jump, and which of its three dialogs is open (picker, update, import).
  Dialogs sit outside the sidebar because they belong to no section, and the
  import one must work before a profile holds anything. A link opened
  directly is read on the first render, before `useShareLink` strips the URL;
  a link some profile already shares exactly opens no dialog.
- Toasts only through `@/lib/toast`, never `sonner` directly.
- `src/index.css` is shadcn's generated CSS plus the `desktop` variant,
  nothing else.
- Tests sit beside their module, pure logic only (no component tests), and
  reuse `primitives/fixtures.test-util.ts`. `src/test-setup.ts` stubs
  `localStorage` because paraglide reads the locale from it.
- `src/i18n.ts` is the ONLY importer of paraglide; components do
  `import { m } from "@/i18n"`. `localized()` picks a `{ de, en }` value from
  catalog / dates files, never a message.
- `generated/paraglide/` is generated and gitignored, outside `src/` because
  `src/` is TypeScript only; `.d.ts` are emitted so `allowJs` stays off. The
  `@paraglide/*` alias lives in `tsconfig.app.json`, `vite.config.ts` and
  `vitest.config.ts` — change all three together.
- `npm run messages` (CLI) compiles with the default locale strategy (cookie
  first), the vite plugin with `localStorage` first: restart a running dev
  server after the CLI, or the `PARAGLIDE_LOCALE` trick for German
  screenshots does nothing.
