# i18n extraction trackers

- **Bootstrap once:** `Workflow({ scriptPath: ".claude/workflows/i18n-bootstrap-registry.js" })`
  → builds `progress.md` with every FSD slice as `pending`.
- **Per slice:** `Workflow({ scriptPath: ".claude/workflows/i18n-extract-slice.js", args: "features/add-transaction" })`
  → scans, extracts to `locales/{ru,en}.json`, drafts+reviews EN, updates `progress.md` + `glossary.md`. No commit.

`progress.md` is the source of truth for what's done / partial / pending.
`glossary.md` enforces consistent EN terms — every run reads it, appends new terms.

> The workflow scripts live under `.claude/workflows/` which is git-ignored, so
> they are not committed (same as `mobile-port-page.js`). Commit only the
> resulting `locales/`, touched components, `progress.md`, and `glossary.md`.

## Test infrastructure (already wired)

Component specs mount via `renderWithProviders()` (`src/test/test-utils.ts`),
which registers the real vue-i18n plugin, and `src/test/setup.ts` forces the
`ru` locale. So after extraction, `$t('<ns>.key')` renders the Russian source
in tests and existing literal-string assertions keep passing. No per-slice test
setup is needed — but the tech-gate runs `vitest run src/<slice>` to confirm.

> The `i18n` instance is a module-global singleton. If a future spec calls the
> real `setI18nLocale('en')` to exercise the English render path, reset it in an
> `afterEach` (`setI18nLocale('ru')`) — otherwise the locale leaks into later
> spec files.

## Suggested rollout order

Process highest-visibility slices first, then sweep the rest:
1. pages/dashboard, widgets/* (balance, recent, sections)
2. features/add-transaction, features/edit-transaction
3. pages/profile + features/manage-subscription
4. entities/category, entities/subscription (centralized constants)
5. Remaining features/, pages/, entities/
6. features/changelog last — discuss whether to localize historical entries at all (spec deferral).

Run one slice per workflow invocation. After each: review the diff, commit. Check `progress.md` for what's left.
