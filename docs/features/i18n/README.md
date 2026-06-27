# i18n extraction trackers

- **Bootstrap once:** `Workflow({ scriptPath: ".claude/workflows/i18n-bootstrap-registry.js" })`
  → builds `progress.md` with every FSD slice as `pending`.
- **Per slice:** `Workflow({ scriptPath: ".claude/workflows/i18n-extract-slice.js", args: "features/add-transaction" })`
  → scans, extracts to `locales/{ru,en}.json`, drafts+reviews EN, updates `progress.md` + `glossary.md`. No commit.

`progress.md` is the source of truth for what's done / partial / pending.
`glossary.md` enforces consistent EN terms — every run reads it, appends new terms.
