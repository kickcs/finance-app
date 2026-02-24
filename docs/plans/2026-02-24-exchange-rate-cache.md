# Exchange Rate In-Memory Cache Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate DB queries from exchange rate lookups by caching all rates in memory, reducing GET /api/exchange-rates/:base/:target from 211ms to ~0ms.

**Architecture:** Create `ExchangeRateCacheService` — a NestJS singleton that holds a `Map<string, ExchangeRate>` keyed by `"USD:EUR"`. Loaded on app startup via `OnApplicationBootstrap`, invalidated after every sync/upsert. Query handlers read from cache instead of repository.

**Tech Stack:** NestJS injectable service, Map data structure, existing DDD patterns.

---

### Task 1: Create ExchangeRateCacheService

**Files:**
- Create: `backend/src/modules/exchange/application/services/exchange-rate-cache.service.ts`

**Step 1: Create the cache service**

```typescript
import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ExchangeRate } from '../../domain/aggregates';
import { IExchangeRateRepository, EXCHANGE_RATE_REPOSITORY } from '../../domain/repositories';

export const EXCHANGE_RATE_CACHE = Symbol('EXCHANGE_RATE_CACHE');

export interface IExchangeRateCache {
  get(baseCurrency: string, targetCurrency: string): ExchangeRate | null;
  getAll(): ExchangeRate[];
  reload(): Promise<void>;
}

@Injectable()
export class ExchangeRateCacheService implements IExchangeRateCache, OnApplicationBootstrap {
  private readonly logger = new Logger(ExchangeRateCacheService.name);
  private cache = new Map<string, ExchangeRate>();

  constructor(
    @Inject(EXCHANGE_RATE_REPOSITORY)
    private readonly exchangeRateRepository: IExchangeRateRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.reload();
  }

  private toKey(base: string, target: string): string {
    return `${base.toUpperCase()}:${target.toUpperCase()}`;
  }

  get(baseCurrency: string, targetCurrency: string): ExchangeRate | null {
    return this.cache.get(this.toKey(baseCurrency, targetCurrency)) ?? null;
  }

  getAll(): ExchangeRate[] {
    return Array.from(this.cache.values());
  }

  async reload(): Promise<void> {
    try {
      const rates = await this.exchangeRateRepository.findAll();
      const newCache = new Map<string, ExchangeRate>();
      for (const rate of rates) {
        newCache.set(this.toKey(rate.baseCurrency, rate.targetCurrency), rate);
      }
      this.cache = newCache;
      this.logger.log(`Exchange rate cache loaded: ${newCache.size} rates`);
    } catch (error) {
      this.logger.error(`Failed to load exchange rate cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
```

**Step 2: Commit**

```bash
git add backend/src/modules/exchange/application/services/exchange-rate-cache.service.ts
git commit -m "feat(exchange): add in-memory exchange rate cache service"
```

---

### Task 2: Register cache in ExchangeModule

**Files:**
- Modify: `backend/src/modules/exchange/exchange.module.ts`
- Modify: `backend/src/modules/exchange/application/services/index.ts` (if barrel exists, add export)

**Step 1: Update module providers**

In `exchange.module.ts`, add import and register:

```typescript
import { EXCHANGE_RATE_CACHE, ExchangeRateCacheService } from './application/services/exchange-rate-cache.service';
```

Add to `providers` array:
```typescript
{ provide: EXCHANGE_RATE_CACHE, useClass: ExchangeRateCacheService },
```

Add to `exports` array:
```typescript
exports: [EXCHANGE_RATE_REPOSITORY, EXCHANGE_RATE_CACHE],
```

**Step 2: Commit**

```bash
git add backend/src/modules/exchange/exchange.module.ts
git commit -m "feat(exchange): register cache service in module"
```

---

### Task 3: Invalidate cache after sync

**Files:**
- Modify: `backend/src/modules/exchange/application/services/rate-sync.scheduler.ts`

**Step 1: Inject cache and reload after sync**

Add to constructor:
```typescript
import { IExchangeRateCache, EXCHANGE_RATE_CACHE } from './exchange-rate-cache.service';

constructor(
  private readonly commandBus: CommandBus,
  @Inject(EXCHANGE_RATE_CACHE)
  private readonly exchangeRateCache: IExchangeRateCache,
) {}
```

In `syncRates()`, after `commandBus.execute(...)`:
```typescript
await this.exchangeRateCache.reload();
this.logger.log('Exchange rate cache reloaded');
```

Remove `OnApplicationBootstrap` implementation from scheduler — cache service handles its own startup loading.

**Step 2: Commit**

```bash
git add backend/src/modules/exchange/application/services/rate-sync.scheduler.ts
git commit -m "feat(exchange): reload cache after rate sync"
```

---

### Task 4: Switch GetRateHandler to use cache

**Files:**
- Modify: `backend/src/modules/exchange/application/queries/get-rate/get-rate.handler.ts`

**Step 1: Replace repository with cache**

Replace `EXCHANGE_RATE_REPOSITORY` injection with `EXCHANGE_RATE_CACHE`:

```typescript
import { IExchangeRateCache, EXCHANGE_RATE_CACHE } from '../../services/exchange-rate-cache.service';

@QueryHandler(GetRateQuery)
export class GetRateHandler implements IQueryHandler<GetRateQuery> {
  constructor(
    @Inject(EXCHANGE_RATE_CACHE)
    private readonly cache: IExchangeRateCache,
  ) {}

  async execute(query: GetRateQuery) {
    const { baseCurrency, targetCurrency } = query;
    const base = baseCurrency.toUpperCase();
    const target = targetCurrency.toUpperCase();

    if (base === target) {
      return {
        baseCurrency: base,
        targetCurrency: target,
        rate: 1,
        updatedAt: new Date(),
        isInverse: false,
        isCrossRate: false,
      };
    }

    // Direct rate — O(1) Map lookup
    const exchangeRate = this.cache.get(base, target);
    if (exchangeRate) {
      return {
        baseCurrency: exchangeRate.baseCurrency,
        targetCurrency: exchangeRate.targetCurrency,
        rate: exchangeRate.rate,
        updatedAt: exchangeRate.updatedAt,
        isInverse: false,
        isCrossRate: false,
      };
    }

    // Inverse rate
    const inverseRate = this.cache.get(target, base);
    if (inverseRate) {
      return {
        baseCurrency: base,
        targetCurrency: target,
        rate: inverseRate.getInverseRate(),
        updatedAt: inverseRate.updatedAt,
        isInverse: true,
        isCrossRate: false,
      };
    }

    // Cross-rate through USD
    if (base !== INTERMEDIATE_CURRENCY && target !== INTERMEDIATE_CURRENCY) {
      const crossRateResult = this.calculateCrossRate(base, target);
      if (crossRateResult) {
        return {
          baseCurrency: base,
          targetCurrency: target,
          rate: crossRateResult.rate,
          updatedAt: crossRateResult.updatedAt,
          isInverse: false,
          isCrossRate: true,
        };
      }
    }

    throw new NotFoundException(`Exchange rate not found for ${baseCurrency}/${targetCurrency}`);
  }

  // NOTE: no longer async — pure in-memory lookup
  private calculateCrossRate(from: string, to: string): { rate: number; updatedAt: Date } | null {
    const usdToFrom = this.cache.get(INTERMEDIATE_CURRENCY, from);
    const usdToTo = this.cache.get(INTERMEDIATE_CURRENCY, to);

    if (usdToFrom && usdToTo) {
      const fromToUsd = 1 / usdToFrom.rate;
      const rate = fromToUsd * usdToTo.rate;
      const updatedAt = usdToFrom.updatedAt > usdToTo.updatedAt ? usdToTo.updatedAt : usdToFrom.updatedAt;
      return { rate, updatedAt };
    }

    return null;
  }
}
```

**Step 2: Commit**

```bash
git add backend/src/modules/exchange/application/queries/get-rate/get-rate.handler.ts
git commit -m "perf(exchange): switch GetRateHandler to in-memory cache"
```

---

### Task 5: Switch ConvertAmountHandler to use cache

**Files:**
- Modify: `backend/src/modules/exchange/application/queries/convert-amount/convert-amount.handler.ts`

**Step 1: Replace repository with cache**

Same pattern as Task 4 — replace `EXCHANGE_RATE_REPOSITORY` with `EXCHANGE_RATE_CACHE`, change all `await this.exchangeRateRepository.findByPair(...)` to `this.cache.get(...)`. Remove `async` from `calculateCrossRate`.

**Step 2: Commit**

```bash
git add backend/src/modules/exchange/application/queries/convert-amount/convert-amount.handler.ts
git commit -m "perf(exchange): switch ConvertAmountHandler to in-memory cache"
```

---

### Task 6: Invalidate cache on manual upsert

**Files:**
- Modify: `backend/src/modules/exchange/application/commands/upsert-rate/upsert-rate.handler.ts`

**Step 1: Reload cache after upsert**

Add `EXCHANGE_RATE_CACHE` injection and call `reload()` after `save()`:

```typescript
@Inject(EXCHANGE_RATE_CACHE)
private readonly exchangeRateCache: IExchangeRateCache,
```

At end of `execute()`, before return:
```typescript
await this.exchangeRateCache.reload();
```

**Step 2: Commit**

```bash
git add backend/src/modules/exchange/application/commands/upsert-rate/upsert-rate.handler.ts
git commit -m "perf(exchange): reload cache after manual upsert"
```

---

### Task 7: Build and verify

**Step 1: Run build**

```bash
cd backend && bun run build
```

Expected: no errors.

**Step 2: Run lint**

```bash
cd backend && bun run lint
```

Expected: no errors.

**Step 3: Commit any fixes if needed**

---

## Expected Result

- `GET /api/exchange-rates/:base/:target` — **0 DB queries**, pure Map lookup (~0ms vs 211ms)
- `GET /api/exchange-rates/convert` — same improvement
- Cache auto-loads on app startup and reloads after daily sync or manual upsert
- ~30 entries in memory (7 currencies) — negligible memory usage
