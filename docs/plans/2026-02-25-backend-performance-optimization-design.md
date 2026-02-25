# Backend Performance Optimization Design

**Date**: 2026-02-25
**Status**: Approved
**Branch**: `fix/backend-performance-optimization`

## Problem

Server monitoring revealed critical performance issues:
- CPU spikes to 100% every ~60 minutes across all nodes
- Memory at 85-90% constantly
- P99 latency: login 10s, monthly stats 10s, health 5s, refresh 5s

## Root Causes Found

| Area | Root Cause | Impact |
|------|-----------|--------|
| Demo cleanup cron | Deletes records one-by-one in a loop with cascading deletes | Hourly CPU spikes to 100%, table locks |
| Auth (refresh token) | bcrypt(10 rounds) on already-random refresh tokens | +100ms per login/refresh |
| Monthly stats | 12 separate DB queries per request | 100-500ms, amplified under CPU load |
| DB indexes | Missing composite index for stats aggregation | Potential sequential scans |
| Docker | No memory/CPU resource limits | OOM risk, unbounded resource consumption |

## Design

### 1. Demo Cleanup Cron — Batch DELETE

**Current**: Loop over expired profiles, delete related records one profile at a time.

**New**:
- Collect expired demo profile IDs in one query
- Batch delete all related records with `DELETE WHERE user_id IN (...)`
- Process in chunks of 50 profiles max per cron run
- Single DB transaction per chunk
- Add `LIMIT` to prevent unbounded work

### 2. Auth — SHA-256 for Refresh Tokens

**Current**: `bcrypt.hash(refreshToken, 10)` and `bcrypt.compare()` for storage/verification.

**New**:
- Use `crypto.createHash('sha256').update(token).digest('hex')` for refresh tokens
- Refresh tokens are already 64-byte cryptographically random — bcrypt is redundant
- Keep bcrypt(10) for passwords (that's correct and necessary)
- Migration: on next refresh, old bcrypt hashes fail compare → user re-logs → new SHA-256 hash stored. No data migration needed.

### 3. Monthly Stats — Consolidate to 2 Queries

**Current**: 12 separate queries (6 aggregations + 6 currency breakdowns).

**New**: 2 queries using conditional aggregation:
```sql
-- Query 1: Totals by type
SELECT
  type,
  is_debt_related,
  SUM(amount) as total,
  currency
FROM transactions
WHERE user_id = ? AND date BETWEEN ? AND ?
GROUP BY type, is_debt_related, currency;

-- Query 2: Category breakdown
SELECT
  type,
  category_id,
  SUM(amount) as total,
  currency
FROM transactions
WHERE user_id = ? AND date BETWEEN ? AND ?
GROUP BY type, category_id, currency;
```

Post-process in application code to separate income/expense/debt categories.

### 4. Database Index

New migration adding composite index:
```sql
CREATE INDEX idx_transactions_monthly_stats
ON transactions (user_id, date, type, is_debt_related, category_id, currency, amount);
```

Covering index — all columns needed by stats queries, avoids table lookups.

### 5. Docker Resource Limits

Add to `docker-compose.prod.yml`:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
  postgres:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
```

## Out of Scope

- Receipt scan async pipeline (acceptable latency for OCR, requires major architectural change)
- Redis caching (not needed after SQL consolidation)
- Health check optimization (slow only due to CPU contention, fixed by cron fix)

## Expected Impact

| Metric | Before | After (expected) |
|--------|--------|-------------------|
| CPU spikes | 100% every hour | Eliminated |
| Login P99 | 10s | <500ms |
| Monthly stats P99 | 10s | <200ms |
| Refresh P99 | 5s | <200ms |
| Health P99 | 5s | <50ms |
| Memory | 85-90% | <70% with limits |
