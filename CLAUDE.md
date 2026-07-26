# CLAUDE.md

Personal finance app: Vue 3 frontend (Feature-Sliced Design) + NestJS backend (DDD + CQRS) + PostgreSQL.

Layer-specific guidance lives in `backend/CLAUDE.md` and `frontend/CLAUDE.md`; the design system is documented in `frontend/DESIGN_SYSTEM.md`. Scripts, dependencies, modules, entities and directory layout are all discoverable from the repo itself — read them there rather than from a list here, which goes stale.

## Entry-point commands

```bash
bun run dev                    # frontend + backend concurrently
docker compose up -d postgres  # local DB only

# Migrations (cd backend/) — the destination path argument is required
bun run migration:generate src/database/migrations/<MigrationName>
```

Verify `bun run build` in both `backend/` and `frontend/` before committing.

## Git Push

**Always push to GitHub** (`origin`), never to `gitlab`. Example: `git push origin master`.

## Changelog

Update `frontend/src/features/changelog/model/changelogData.ts` for every user-visible change:
- **Always bump patch version** (e.g. `1.0.15` → `1.0.16`). Only bump minor/major when the user explicitly requests it
- Add the entry at the **top** of the `CHANGELOG_ENTRIES` array
- Descriptions **на русском**, простым языком для пользователей
- Types: `feature`, `fix`, `improvement`

## Subscription & monetization

**Model**: Soft Paywall — all current features stay free; new premium features go behind a subscription. LemonSqueezy acts as Merchant of Record (handles taxes/VAT globally).

**Adding a premium-gated feature**:
1. Backend: `@UseGuards(PremiumGuard)` on the endpoint
2. Frontend: `const { requirePremium } = usePremiumFeature()` then `if (!requirePremium('Feature Name')) return;`
3. Optionally add `<PremiumBadge />` next to the feature in the UI

The LemonSqueezy webhook endpoint must be `@Public()` and needs raw body parsing (`rawBody: true` in `main.ts`).

## Cross-cutting gotchas

- **API field naming**: the backend speaks camelCase, frontend types use snake_case. Transform at the boundary, inside `entities/<name>/api/*Api.ts` — never let one convention leak into the other layer
- **Multi-currency**: account balances are NOT a column on `accounts`; they live in a separate `account_balances` table, one row per currency
- **Profile fields**: adding one means updating `ProfileResponse` AND every handler that builds it (get-profile, update-profile, create-demo-user) — miss one and the field silently disappears for some users
- **TypeORM**: `synchronize: false` — schema changes only ever go through migrations
