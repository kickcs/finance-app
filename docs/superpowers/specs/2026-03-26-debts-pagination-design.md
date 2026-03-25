# Debts Cursor-Based Pagination

## Problem

`GET /api/debts` returns all debts at once with no limit. Filtering and grouping by person happens in-memory on the frontend. This doesn't scale when users have many debts.

## Solution

Cursor-based pagination with server-side filtering and grouping by person — matching the existing transactions pagination pattern.

## Decisions

- **Pagination unit**: Groups (persons). `pageSize=10` means 10 person-groups per page.
- **Cursor**: `{ personId, createdAt }` — points to last person on current page.
- **Group integrity**: Groups never split across pages.
- **Sorting**: Groups sorted by `MAX(debt.created_at) DESC` (newest debt activity first).
- **Filtering**: Server-side by `status` (active/closed), `currency`, `personId`.
- **Summary**: Server returns `totalSummary` (totalGiven/totalTaken by currency) in response.
- **Backward compat**: Old `GET /api/debts` stays for dashboard widget.

## Backend

### Endpoint

`GET /api/debts/paginated`

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| pageSize | number | 10 | Number of person-groups per page |
| cursorPersonId | string | — | ID of last person on previous page |
| cursorCreatedAt | string | — | createdAt of cursor position |
| status | `active` \| `closed` | — | Filter by debt status |
| currency | string | — | Filter by currency |
| personId | string | — | Filter by specific person |

**Response:**
```json
{
  "groups": [
    {
      "person": { "id": "...", "name": "..." },
      "debts": [
        { "id": "...", "totalAmount": 1000, "remainingAmount": 500, ... }
      ],
      "summary": { "totalGiven": 500, "totalTaken": 300, "currencies": ["USD"] }
    }
  ],
  "totalSummary": {
    "totalGiven": { "USD": 1500, "EUR": 200 },
    "totalTaken": { "USD": 800 }
  },
  "nextCursor": { "personId": "...", "createdAt": "..." },
  "hasMore": true,
  "totalDebtsCount": 45
}
```

### New Files

- `get-debts-paginated.query.ts` — query with userId, pageSize, cursor, filters
- `get-debts-paginated.handler.ts` — @QueryHandler, calls repository, maps response
- `get-debts-paginated.dto.ts` — class-validator DTO for query params
- `paginated-debts-response.mapper.ts` — builds grouped response with summary

### Repository Method

New `getPaginated()` in `DebtRepository` interface and `TypeOrmDebtRepository`:

```sql
-- 1. Find persons with their lastDebtDate
WITH person_stats AS (
  SELECT person_id, MAX(created_at) as last_debt_date
  FROM debts
  WHERE user_id = :userId
    AND (:status IS NULL OR is_closed = :isClosed)
    AND (:currency IS NULL OR currency = :currency)
    AND (:personId IS NULL OR person_id = :personId)
  GROUP BY person_id
)
-- 2. Paginate persons
SELECT * FROM person_stats
WHERE (last_debt_date < :cursorCreatedAt)
   OR (last_debt_date = :cursorCreatedAt AND person_id < :cursorPersonId)
ORDER BY last_debt_date DESC, person_id DESC
LIMIT :pageSize + 1

-- 3. Fetch debts for found persons
SELECT * FROM debts
WHERE person_id IN (:personIds) AND user_id = :userId
  AND (:status IS NULL OR is_closed = :isClosed)
  AND (:currency IS NULL OR currency = :currency)
ORDER BY created_at DESC
```

### Controller

New method in `DebtsController`:

```typescript
@Get('paginated')
async getPaginated(@CurrentUser() user, @Query() dto: GetDebtsPaginatedDto) {
  return this.queryBus.execute(new GetDebtsPaginatedQuery(user.id, dto));
}
```

## Frontend

### API Layer (`entities/debt/api/debtsApi.ts`)

New `getPaginated()` method with params transformation.

### Types (`entities/debt/model/types.ts`)

```typescript
interface DebtGroup {
  person: { id: string; name: string };
  debts: Debt[];
  summary: { total_given: number; total_taken: number; currencies: string[] };
}

interface PaginatedDebtsResult {
  groups: DebtGroup[];
  total_summary: { total_given: Record<string, number>; total_taken: Record<string, number> };
  nextCursor: DebtsPaginatedCursor | null;
  hasMore: boolean;
  total_debts_count: number;
}

interface DebtsPaginatedCursor { personId: string; createdAt: string; }
interface DebtsFilters { status?: 'active' | 'closed'; currency?: string; personId?: string; }
```

### Composable (`entities/debt/api/useInfiniteDebts.ts`)

```typescript
const PAGE_SIZE = 10;

export function useInfiniteDebts(userId, filters?) {
  // useInfiniteQuery with cursor-based pagination
  // queryKey includes filters for auto-refetch on filter change
  // Returns: groups, totalDebtsCount, totalSummary, isLoading,
  //          fetchNextPage, hasNextPage, isFetchingNextPage, refetch
}
```

### Query Keys

Add `infinite` key factory with filters to `debtQueryKeys`.

### Existing `useDebts`

Stays — used by `DebtsSection` widget on dashboard.

## Frontend UI

### `DebtsListPage.vue`

- Switches from `useDebts` to `useInfiniteDebts`
- Filters update reactive `filters` ref → server-side filtering
- Summary cards use `totalSummary` from API (accurate across all pages)
- Groups render via `CollapsibleRoot`/`CollapsibleTrigger`/`CollapsibleContent` from Reka UI

### Infinite Scroll

`IntersectionObserver` on a sentinel element at the bottom of the list. When visible, calls `fetchNextPage()`. No manual "load more" button.

### Optimistic Updates

Mutations update `useInfiniteDebts` cache — prepend new debts to correct group, remove deleted debts from pages.
