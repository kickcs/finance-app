# Редизайн «Аналитика» + «Люди» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ужать страницу аналитики с ≈1832px до ≈950px, переделать страницу людей в компактный список с долговым нетто и добавлением без модалки, убрать девять источников джанка в анимациях.

**Architecture:** Аналитика собирается из четырёх секций вместо шести карточек; тяжёлые виджеты (`DonutChart`, `DailyExpenseChart`, `PeriodComparison`) сохраняются, но теряют собственные `UCard`-обёртки и заголовки — их даёт секция-контейнер. Страница людей получает единое поле «поиск + добавление» и строку 52px с нетто по долгам, посчитанным на клиенте из плоского `GET /debts`. Общие правки (`useCountUp`, `transitions.ts`) идут первыми, поскольку от них зависят обе страницы.

**Tech Stack:** Vue 3 (`<script setup>`), TypeScript, Tailwind v4, Reka UI, `vaul-vue`, TanStack Vue Query, VueUse, Vitest + `@vue/test-utils` + MSW.

**Spec:** `docs/superpowers/specs/2026-07-27-analytics-people-redesign-design.md`

## Global Constraints

- FSD: импорты только вниз по слоям `app → pages → widgets → features → entities → shared`.
- Только токены дизайн-системы: `bg-surface-light dark:bg-surface-dark` и т.п., никаких сырых Tailwind-цветов (`bg-zinc-100`).
- `cn()` из `shared/lib/utils.ts` для каждой динамической строки классов.
- Иконки — `<UIcon name="..." />`; имя должно существовать в `shared/ui/icon/iconMap.ts`, иначе сначала добавить маппинг.
- VueUse вместо самописных хуков для listeners/observers/timers.
- В модулях, достижимых из `App.vue`, импорт по подпути (`@/shared/ui/icon`), не из бочки. Обе эти страницы — ленивые роуты, их бочки не в стартовом графе; проверяет `scripts/check-eager-bundle.mjs` после сборки.
- Тесты — колокейшн `*.spec.ts` рядом с исходником.
- Ветка `feat/analytics-people-redesign` уже создана, спека в неё закоммичена.
- Коммит после каждой задачи. Без trailer `Co-Authored-By`.
- В конце — запись в `frontend/src/features/changelog/model/changelogData.ts`, патч-версия, описание на русском для пользователей.

## Файловая структура

**Создаются:**

| Файл | Ответственность |
|---|---|
| `shared/lib/hooks/useCountUp.ts` | Анимация числа через один rAF-тикер, с уважением reduced-motion |
| `shared/lib/hooks/useCountUp.spec.ts` | Тесты хука |
| `entities/person/lib/foldDebtsByPersonName.ts` | Свёртка долгов в нетто по имени человека |
| `entities/person/lib/foldDebtsByPersonName.spec.ts` | Тесты свёртки |
| `features/analytics-filters/ui/PeriodBar.vue` | Однорядная липкая шапка: период + масштаб + фильтр |
| `features/analytics-filters/ui/AccountFilterSheet.vue` | Шторка выбора счетов |
| `widgets/analytics/summary/ui/AnalyticsSummaryCard.vue` | Сводная карточка |
| `widgets/analytics/summary/index.ts` | Публичный API виджета |
| `widgets/analytics/category-breakdown/ui/CategoryBreakdown.vue` | Донат + легенда топ-5 + шторка «все» |
| `widgets/analytics/category-breakdown/index.ts` | Публичный API виджета |
| `widgets/analytics/trends/ui/TrendsSection.vue` | Табы над двумя графиками |
| `widgets/analytics/trends/index.ts` | Публичный API виджета |
| `pages/people/ui/PersonEditSheet.vue` | Шторка правки контакта |

**Удаляются:** `widgets/analytics/income-expense-bar/`, `widgets/analytics/daily-stats/`, `features/analytics-filters/ui/SwipeablePeriodHeader.vue`.

**Изменяются:** `AnalyticsPage.vue`, `PeopleListPage.vue`, `PeopleListPage.spec.ts`, `DonutChart.vue`, `DailyExpenseChart.vue`, `PeriodComparison.vue`, `SpendingPaceChart.vue`, `shared/lib/transitions.ts`, `widgets/analytics/index.ts`, `features/analytics-filters/index.ts`, `changelogData.ts`.

---

### Task 1: Базовый замер

Без замера «до» проверить результат нечем. Делается первым, до единой правки.

**Files:**
- Create: `docs/superpowers/plans/2026-07-27-baseline.md` (временный, удаляется в Task 14)

- [ ] **Шаг 1: Поднять фронт и бэк**

```bash
cd /Users/hamkorlab/WebstormProjects/finance-app && bun run dev
```

Если `.env` смотрит на LAN-IP, поднять второй vite с `VITE_API_URL=http://localhost:3000` — иначе Chrome DevTools MCP не достучится до API.

- [ ] **Шаг 2: Снять высоту обеих страниц**

Через `mcp__chrome-devtools__navigate_page` на `/analytics`, затем `evaluate_script`:

```js
() => ({
  scrollHeight: document.querySelector('main')?.scrollHeight,
  bodyHeight: document.body.scrollHeight,
  sticky: document.querySelector('main')?.previousElementSibling?.getBoundingClientRect().height,
})
```

Повторить для `/people`.

- [ ] **Шаг 3: Снять performance trace скролла аналитики**

`performance_start_trace` с `reload: true, autoStop: true`, затем `performance_analyze_insight` по ключевым инсайтам. Зафиксировать LCP и наличие long tasks.

- [ ] **Шаг 4: Записать числа в baseline-файл**

Формат: таблица «страница / метрика / значение до». Файл в git не коммитится.

---

### Task 2: `useCountUp` — один rAF-тикер вместо N

`IncomeExpenseBar` держит две независимые rAF-петли, каждая пишет в свой ref ~60 раз/сек. Хук заменяет их одним тикером и добавляет уважение к reduced-motion, которого сейчас нет.

**Files:**
- Create: `frontend/src/shared/lib/hooks/useCountUp.ts`
- Test: `frontend/src/shared/lib/hooks/useCountUp.spec.ts`

**Interfaces:**
- Produces: `useCountUp(getters: Record<K, () => number>, options?: { duration?: number }): Record<K, ComputedRef<number>>` — принимает карту геттеров, возвращает карту анимированных значений. Один `requestAnimationFrame` на весь набор.

- [ ] **Шаг 1: Написать падающий тест**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { withSetup } from '@/test/withSetup';
import { useCountUp } from './useCountUp';

vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  usePreferredReducedMotion: () => ref('no-preference'),
}));

describe('useCountUp', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('стартует со стартового значения геттеров', () => {
    const [values] = withSetup(() => useCountUp({ a: () => 100 }));
    expect(values.a.value).toBe(100);
  });

  it('доводит значение до цели за duration', async () => {
    const src = ref(0);
    const [values] = withSetup(() => useCountUp({ a: () => src.value }, { duration: 400 }));
    src.value = 100;
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);
    expect(values.a.value).toBe(100);
  });

  it('использует один rAF на несколько значений', async () => {
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');
    const a = ref(0);
    const b = ref(0);
    withSetup(() => useCountUp({ a: () => a.value, b: () => b.value }, { duration: 400 }));
    rafSpy.mockClear();
    a.value = 10;
    b.value = 20;
    await nextTick();
    expect(rafSpy).toHaveBeenCalledTimes(1);
  });
});

describe('useCountUp с reduced-motion', () => {
  it('присваивает целевое значение мгновенно', async () => {
    vi.doMock('@vueuse/core', async (importOriginal) => ({
      ...(await importOriginal<typeof import('@vueuse/core')>()),
      usePreferredReducedMotion: () => ref('reduce'),
    }));
    const { useCountUp: hook } = await import('./useCountUp?reduced');
    const src = ref(0);
    const [values] = withSetup(() => hook({ a: () => src.value }));
    src.value = 100;
    await nextTick();
    expect(values.a.value).toBe(100);
  });
});
```

Если хелпера `@/test/withSetup` в проекте нет — сначала проверить `frontend/src/test/`, при отсутствии создать минимальный (`createApp` + `runWithContext`), поскольку хук использует `onUnmounted`.

- [ ] **Шаг 2: Запустить тест, убедиться что падает**

Run: `cd frontend && bun run test -- useCountUp` (через subagent `test-runner`)
Expected: FAIL — модуль не найден.

- [ ] **Шаг 3: Реализовать хук**

```ts
import { computed, ref, watch, onUnmounted, type ComputedRef } from 'vue';
import { usePreferredReducedMotion } from '@vueuse/core';

const DEFAULT_DURATION = 400;

/** ease-out cubic — то же ощущение, что у прежней ручной петли в IncomeExpenseBar */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Анимирует набор чисел одним rAF-тикером.
 *
 * Прежняя реализация заводила отдельную петлю на каждое значение, и две петли
 * писали в свои рефы ~60 раз в секунду — компонент перерисовывался дважды за
 * кадр. Один тикер обновляет все значения разом, поэтому кадр стоит один
 * ререндер независимо от того, сколько чисел анимируется.
 */
export function useCountUp<K extends string>(
  getters: Record<K, () => number>,
  options: { duration?: number } = {},
): Record<K, ComputedRef<number>> {
  const duration = options.duration ?? DEFAULT_DURATION;
  const reducedMotion = usePreferredReducedMotion();

  const keys = Object.keys(getters) as K[];
  const current = ref(
    Object.fromEntries(keys.map((k) => [k, getters[k]()])) as Record<K, number>,
  );

  let rafId = 0;
  let from: Record<K, number> | null = null;
  let to: Record<K, number> | null = null;
  let startTime = 0;

  function tick(now: number) {
    if (!from || !to) return;
    const t = Math.min((now - startTime) / duration, 1);
    const eased = easeOutCubic(t);

    const next = { ...current.value };
    for (const key of keys) {
      next[key] = from[key] + (to[key] - from[key]) * eased;
    }
    current.value = next;

    if (t < 1) rafId = requestAnimationFrame(tick);
  }

  watch(
    () => keys.map((k) => getters[k]()),
    (targets) => {
      const nextTo = Object.fromEntries(keys.map((k, i) => [k, targets[i]])) as Record<K, number>;
      if (keys.every((k) => current.value[k] === nextTo[k])) return;

      if (reducedMotion.value === 'reduce') {
        current.value = nextTo;
        return;
      }

      cancelAnimationFrame(rafId);
      from = { ...current.value };
      to = nextTo;
      startTime = performance.now();
      rafId = requestAnimationFrame(tick);
    },
  );

  onUnmounted(() => cancelAnimationFrame(rafId));

  return Object.fromEntries(
    keys.map((k) => [k, computed(() => current.value[k])]),
  ) as Record<K, ComputedRef<number>>;
}
```

- [ ] **Шаг 4: Запустить тесты, убедиться что проходят**

Run: `cd frontend && bun run test -- useCountUp`
Expected: PASS.

- [ ] **Шаг 5: Коммит**

```bash
git add frontend/src/shared/lib/hooks/useCountUp.ts frontend/src/shared/lib/hooks/useCountUp.spec.ts
git commit -m "perf(shared): единый rAF-тикер useCountUp вместо петли на каждое число"
```

---

### Task 3: `transitions.ts` — убрать `transition-all`

`listTransition` — разделяемый пресет, используемый списками по всему приложению. Три его класса просят браузер следить за всеми анимируемыми свойствами, хотя меняются только `opacity` и `transform`.

**Files:**
- Modify: `frontend/src/shared/lib/transitions.ts`

- [ ] **Шаг 1: Найти всех потребителей**

```bash
cd frontend && grep -rn "listTransition" --include="*.vue" --include="*.ts" src/
```

Убедиться, что ни один потребитель не полагается на анимацию иных свойств (цвета, размера) — если полагается, ему нужен собственный пресет, а не расширение общего.

- [ ] **Шаг 2: Заменить классы**

```ts
/**
 * Reusable transition class presets for Vue TransitionGroup
 *
 * Перечисляем opacity и transform поимённо вместо transition-all: меняются
 * только они, а `all` заставляет браузер отслеживать каждое анимируемое
 * свойство элемента.
 */
export const listTransition = {
  enterActiveClass: 'transition-[opacity,transform] duration-150 ease-out',
  leaveActiveClass: 'transition-[opacity,transform] duration-150 ease-in',
  enterFromClass: 'opacity-0 -translate-y-1.5',
  leaveToClass: 'opacity-0 translate-y-1.5',
  moveClass: 'transition-transform duration-150 ease-out',
} as const;
```

`moveClass` применяется только к перемещению элемента — там достаточно `transform`.

- [ ] **Шаг 3: Прогнать тесты потребителей**

Run: `cd frontend && bun run test` (через subagent `test-runner`)
Expected: PASS — визуальный пресет не должен ломать поведенческие тесты.

- [ ] **Шаг 4: Коммит**

```bash
git add frontend/src/shared/lib/transitions.ts
git commit -m "perf(shared): перечислить анимируемые свойства в listTransition вместо transition-all"
```

---

### Task 4: `foldDebtsByPersonName` — нетто по долгам

**Files:**
- Create: `frontend/src/entities/person/lib/foldDebtsByPersonName.ts`
- Test: `frontend/src/entities/person/lib/foldDebtsByPersonName.spec.ts`
- Modify: `frontend/src/entities/person/index.ts` (реэкспорт)

**Interfaces:**
- Consumes: `Debt` из `@/shared/api/database.types`; `convert(amount, fromCurrency) => number` из `useExchangeRates`.
- Produces:
  ```ts
  export interface PersonDebtNet {
    /** Нетто в валюте пользователя: > 0 — вам должны, < 0 — вы должны. */
    net: number;
    debtCount: number;
  }
  export function foldDebtsByPersonName(
    debts: Debt[],
    convert: (amount: number, fromCurrency: string) => number,
  ): Map<string, PersonDebtNet>;
  ```
  Ключ карты — `person_name.trim().toLowerCase()`.

- [ ] **Шаг 1: Написать падающие тесты**

```ts
import { describe, it, expect } from 'vitest';
import { foldDebtsByPersonName } from './foldDebtsByPersonName';
import type { Debt } from '@/shared/api/database.types';

const identity = (amount: number) => amount;

function debt(over: Partial<Debt>): Debt {
  return {
    id: 'd1',
    user_id: 'u1',
    name: 'Долг',
    person_name: 'Аня',
    debt_type: 'given',
    remaining_amount: 100,
    currency: 'UZS',
    is_closed: false,
    forgiven_amount: 0,
    is_private: false,
    created_at: '2026-07-01T00:00:00Z',
    ...over,
  } as Debt;
}

describe('foldDebtsByPersonName', () => {
  it('складывает given плюсом, received минусом', () => {
    const result = foldDebtsByPersonName(
      [
        debt({ person_name: 'Аня', debt_type: 'given', remaining_amount: 300 }),
        debt({ id: 'd2', person_name: 'Аня', debt_type: 'received', remaining_amount: 100 }),
      ],
      identity,
    );
    expect(result.get('аня')).toEqual({ net: 200, debtCount: 2 });
  });

  it('отбрасывает закрытые долги', () => {
    const result = foldDebtsByPersonName(
      [debt({ is_closed: true, remaining_amount: 500 })],
      identity,
    );
    expect(result.has('аня')).toBe(false);
  });

  it('сопоставляет имена без учёта регистра и пробелов', () => {
    const result = foldDebtsByPersonName(
      [
        debt({ person_name: '  Аня ', remaining_amount: 100 }),
        debt({ id: 'd2', person_name: 'аня', remaining_amount: 50 }),
      ],
      identity,
    );
    expect(result.get('аня')?.net).toBe(150);
    expect(result.size).toBe(1);
  });

  it('конвертирует валюту переданной функцией', () => {
    const convert = (amount: number, from: string) => (from === 'USD' ? amount * 12000 : amount);
    const result = foldDebtsByPersonName(
      [debt({ currency: 'USD', remaining_amount: 10 })],
      convert,
    );
    expect(result.get('аня')?.net).toBe(120000);
  });

  it('пропускает долги без имени человека', () => {
    const result = foldDebtsByPersonName([debt({ person_name: null })], identity);
    expect(result.size).toBe(0);
  });

  it('возвращает пустую карту на пустом входе', () => {
    expect(foldDebtsByPersonName([], identity).size).toBe(0);
  });
});
```

- [ ] **Шаг 2: Запустить, убедиться что падает**

Run: `cd frontend && bun run test -- foldDebtsByPersonName`
Expected: FAIL — модуль не найден.

- [ ] **Шаг 3: Реализовать**

```ts
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import type { Debt } from '@/shared/api/database.types';

export interface PersonDebtNet {
  /** Нетто в валюте пользователя: > 0 — вам должны, < 0 — вы должны. */
  net: number;
  debtCount: number;
}

/**
 * Ключ карты. Долги хранят имя человека свободным текстом, без person_id,
 * поэтому единственный доступный ключ — нормализованная строка имени.
 */
export function personKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Сворачивает открытые долги в нетто по человеку.
 *
 * Знак — тот же, что в foldGroupsIntoPeople на странице долгов: «дал» плюсом,
 * «взял» минусом, чтобы встречные долги одного человека гасили друг друга и
 * список показывал одну итоговую сумму вместо двух строк.
 */
export function foldDebtsByPersonName(
  debts: Debt[],
  convert: (amount: number, fromCurrency: string) => number,
): Map<string, PersonDebtNet> {
  const byPerson = new Map<string, PersonDebtNet>();

  for (const debt of debts) {
    if (debt.is_closed) continue;
    const rawName = debt.person_name?.trim();
    if (!rawName) continue;

    const key = personKey(rawName);
    const amount = convert(debt.remaining_amount, debt.currency || DEFAULT_CURRENCY);
    const entry = byPerson.get(key) ?? { net: 0, debtCount: 0 };

    entry.net += debt.debt_type === 'given' ? amount : -amount;
    entry.debtCount += 1;
    byPerson.set(key, entry);
  }

  return byPerson;
}
```

- [ ] **Шаг 4: Запустить тесты**

Run: `cd frontend && bun run test -- foldDebtsByPersonName`
Expected: PASS (6 тестов).

- [ ] **Шаг 5: Реэкспорт + коммит**

Добавить в `entities/person/index.ts`:
```ts
export { foldDebtsByPersonName, personKey, type PersonDebtNet } from './lib/foldDebtsByPersonName';
```

```bash
git add frontend/src/entities/person/
git commit -m "feat(person): свёртка долгов в нетто по имени человека"
```

---

### Task 5: `PeriodBar` + `AccountFilterSheet` — липкая шапка 134px → 44px

**Files:**
- Create: `frontend/src/features/analytics-filters/ui/PeriodBar.vue`
- Create: `frontend/src/features/analytics-filters/ui/AccountFilterSheet.vue`
- Modify: `frontend/src/features/analytics-filters/index.ts`
- Delete: `frontend/src/features/analytics-filters/ui/SwipeablePeriodHeader.vue` (в Task 11, после того как страница перестанет его импортировать)

**Interfaces:**
- Consumes: `usePeriodNavigation()` (`label`, `sublabel`, `canGoNext`, `canGoPrev`, `isCurrentPeriod`, `scale`), `FilterChip` из `FilterChips.vue`.
- Produces:
  - `PeriodBar` props: `label: string`, `sublabel: string`, `scale: PeriodScale`, `canGoNext: boolean`, `canGoPrev: boolean`, `isCurrentPeriod: boolean`, `comparisonPercent?: number`, `comparisonLoading?: boolean`, `activeFilterCount: number`, `showFilter: boolean`; emits `prev`, `next`, `today`, `update:scale` (`PeriodScale`), `open-filter`.
  - `AccountFilterSheet` props: `open: boolean`, `items: FilterChip[]`, `selectedIds: string[]`; emits `update:open`, `toggle` (`string`), `clear`.

- [ ] **Шаг 1: Проверить наличие иконки фильтра в iconMap**

```bash
cd frontend && grep -n "tune\|filter_list\|filter_alt" src/shared/ui/icon/iconMap.ts
```

Если ни одного имени нет — добавить маппинг `tune` на Lucide `SlidersHorizontal` до написания компонента.

- [ ] **Шаг 2: Написать `PeriodBar.vue`**

Раскладка — один flex-ряд высотой 44px:

```vue
<template>
  <div class="flex items-center gap-1 h-11">
    <button
      class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark transition-colors disabled:opacity-30"
      :disabled="!canGoPrev"
      aria-label="Предыдущий период"
      @click="handlePrev"
    >
      <UIcon name="chevron_left" size="sm" />
    </button>

    <div class="flex-1 min-w-0 flex items-center justify-center gap-1.5">
      <span class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
        {{ label }}
      </span>
      <span v-if="scale === 'day' && sublabel" class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark shrink-0">
        {{ sublabel }}
      </span>
      <span
        v-if="comparisonPercent !== undefined && !comparisonLoading"
        class="shrink-0 px-1.5 py-0.5 rounded-md text-caption-sm font-semibold leading-none"
        :class="comparisonColor"
      >
        {{ comparisonText }}
      </span>
    </div>

    <button
      class="w-8 h-8 shrink-0 rounded-full ..."
      :disabled="!canGoNext"
      aria-label="Следующий период"
      @click="handleNext"
    >
      <UIcon name="chevron_right" size="sm" />
    </button>

    <!-- «Сегодня» — в том же ряду, растёт по ширине, не по высоте -->
    <button
      v-if="!isCurrentPeriod"
      class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-primary text-white transition-colors"
      aria-label="Вернуться к текущему периоду"
      @click="handleToday"
    >
      <UIcon name="restart_alt" size="sm" />
    </button>

    <UTabs
      :model-value="scale"
      :items="SCALE_ITEMS"
      size="sm"
      class="shrink-0"
      @update:model-value="emit('update:scale', $event as PeriodScale)"
    />

    <button
      v-if="showFilter"
      class="relative w-8 h-8 shrink-0 rounded-full flex items-center justify-center transition-colors"
      :class="activeFilterCount > 0
        ? 'bg-primary/10 text-primary'
        : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark'"
      aria-label="Фильтр по счетам"
      @click="emit('open-filter')"
    >
      <UIcon name="tune" size="sm" />
      <span
        v-if="activeFilterCount > 0"
        class="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-white text-caption-xs font-semibold flex items-center justify-center"
      >
        {{ activeFilterCount }}
      </span>
    </button>
  </div>
</template>
```

`SCALE_ITEMS` — константа модуля: `[{ id: 'day', label: 'Д' }, { id: 'month', label: 'М' }, { id: 'year', label: 'Г' }]`. Однобуквенные метки нужны, чтобы табы влезли в ряд; полные названия остаются в `aria-label` триггеров.

Хаптику (`useHaptics().trigger('selection')`) сохранить на `prev`/`next`/`today` — как в `SwipeablePeriodHeader`.

- [ ] **Шаг 3: Написать `AccountFilterSheet.vue`**

`DrawerRoot` по образцу `pages/import-inbox/confirm/TypeSheet.vue` (`:direction="isDesktop ? 'right' : 'bottom'"`, `DrawerHandle` на мобилке, `px-3 pb-[max(1rem,env(safe-area-inset-bottom))]`). Внутри — список счетов строками: цветная точка, имя, галочка при выборе. Заголовок `DrawerTitle` — «Счета». Внизу кнопка «Сбросить», видимая при `selectedIds.length > 0`.

- [ ] **Шаг 4: Обновить публичный API фичи**

В `features/analytics-filters/index.ts` добавить экспорт `PeriodBar` и `AccountFilterSheet`. `SwipeablePeriodHeader` пока не убирать — страница его ещё импортирует.

- [ ] **Шаг 5: Проверка сборки и коммит**

Run: `cd frontend && bun run build`
Expected: успешная сборка, `check-eager-bundle` в пределах бюджета.

```bash
git add frontend/src/features/analytics-filters/
git commit -m "feat(analytics): однорядная шапка периода и шторка фильтра счетов"
```

---

### Task 6: `AnalyticsSummaryCard` — сводка вместо трёх карточек

**Files:**
- Create: `frontend/src/widgets/analytics/summary/ui/AnalyticsSummaryCard.vue`
- Create: `frontend/src/widgets/analytics/summary/index.ts`

**Interfaces:**
- Consumes: `useCountUp` (Task 2), `formatCurrency`/`COMPACT_FORMAT` из `@/shared/lib/format/currency`.
- Produces: props `income: number`, `expense: number`, `availableBalance: number`, `daysInPeriod: number`, `daysRemaining: number`, `currency: string`, `budgetAmount?: number`, `isPastPeriod?: boolean`, `balanceLabel?: string`, `loading?: boolean`.

- [ ] **Шаг 1: Перенести вычисления из `DailyStatsCards`**

Три величины обязаны сохранить прежний смысл:
```ts
const avgDailyExpense = computed(() =>
  props.daysInPeriod <= 0 ? 0 : props.expense / props.daysInPeriod,
);
const safeDaily = computed(() =>
  props.daysRemaining <= 0 ? props.availableBalance : props.availableBalance / props.daysRemaining,
);
const budgetPercent = computed(() =>
  props.budgetAmount ? Math.min(100, (props.expense / props.budgetAmount) * 100) : null,
);
```

- [ ] **Шаг 2: Раскладка**

```
Расход                                 ▲ 12%     ← заголовок + дельта
−1 240 000 сум                                   ← text-h2, tabular-nums
▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  59% от бюджета          ← одна полоса
доход +2 100 000 · баланс +860 000                ← строка
42 000/день · безопасно 47 000 · 18 дн            ← grid-cols-3, tabular-nums
```

Нижняя строка метрик — `grid grid-cols-3 gap-2`, каждая ячейка `min-w-0` с `truncate`. Это ключевое отличие от `flex justify-between` в старых карточках: фиксированные колонки убирают конкуренцию за ширину, из-за которой длинные суммы рвали строку.

Все суммы — `formatCurrency(value, currency, COMPACT_FORMAT)` + класс `tabular-nums`.

При `isPastPeriod` ячейки «безопасно» и «осталось дней» не рендерятся (для прошедшего периода они бессмысленны) — сетка становится `grid-cols-1`.
При `balanceLabel` он показывается подписью под ячейкой «безопасно».
Полоса бюджета рендерится только при `budgetAmount`; иначе на её месте — полоса «расход относительно дохода».

- [ ] **Шаг 3: Подключить `useCountUp`**

```ts
const animated = useCountUp({
  income: () => props.income,
  expense: () => props.expense,
});
const animatedBalance = computed(() => animated.income.value - animated.expense.value);
```

- [ ] **Шаг 4: Скелет загрузки**

При `loading` — `Skeleton` той же геометрии, что и содержимое (высота карточки не должна прыгать при появлении данных).

- [ ] **Шаг 5: Сборка и коммит**

Run: `cd frontend && bun run build`

```bash
git add frontend/src/widgets/analytics/summary/
git commit -m "feat(analytics): сводная карточка вместо IncomeExpenseBar и DailyStatsCards"
```

---

### Task 7: `DonutChart` без легенды + `CategoryBreakdown`

**Files:**
- Modify: `frontend/src/widgets/analytics/donut-chart/ui/DonutChart.vue`
- Create: `frontend/src/widgets/analytics/category-breakdown/ui/CategoryBreakdown.vue`
- Create: `frontend/src/widgets/analytics/category-breakdown/index.ts`

**Interfaces:**
- `DonutChart` (после правки): props `segments: DonutSegment[]`, `total: number`, `currency: string`, `size?: number` (по умолчанию 140), `selectedId?: string | null`, `title?: string`; emits `segment-click`. Больше **не** рендерит `UCard` и легенду; выбранный сегмент управляется снаружи через `selectedId`.
- `CategoryBreakdown`: props `segments: DonutSegment[]`, `total: number`, `currency: string`, `categoryType: 'expense' | 'income'`, `loading?: boolean`; emits `update:categoryType`.

- [ ] **Шаг 1: Разгрузить `DonutChart`**

Убрать: `<UCard>`-обёртку, блок легенды (`:173-207`), внутренний `selectedSegment` ref. Оставить: SVG-кольцо, центральный текст, `orderedPaths`.

Заменить в `<style scoped>`:
```css
.donut-segment {
  opacity: 0;
  /* filter здесь никогда не менялся, а stroke-width перерастеризует path
     каждый кадр — оставляем только opacity. */
  transition: opacity 0.3s ease-out;
  transition-delay: var(--delay, 0ms);
}
```

Подсветку выбранного сегмента перевести со `stroke-width` на `opacity` невыбранных (`opacity: 0.35`), убрав `selectedExtra` из расчёта радиуса.

`size` сделать пропом со значением по умолчанию 140; `radius`, `centerX`, `centerY` вывести через `computed` от него.

- [ ] **Шаг 2: Написать `CategoryBreakdown.vue`**

```vue
<template>
  <UCard padding="md">
    <UTabs :model-value="categoryType" :items="TYPE_ITEMS" size="sm" class="mb-3"
           @update:model-value="emit('update:categoryType', $event as 'expense' | 'income')" />

    <div v-if="loading" class="flex gap-4">
      <Skeleton class="w-[140px] h-[140px] rounded-full shrink-0" />
      <div class="flex-1 space-y-2">
        <Skeleton v-for="i in 5" :key="i" class="h-7 rounded" />
      </div>
    </div>

    <EmptyState v-else-if="segments.length === 0" icon="pie_chart" title="Нет данных"
                description="Нет транзакций за выбранный период" />

    <div v-else class="flex flex-col min-[360px]:flex-row items-center gap-4">
      <DonutChart :segments="segments" :total="total" :currency="currency"
                  :selected-id="selectedId" class="shrink-0"
                  @segment-click="handleSegmentClick" />

      <div class="w-full min-w-0 space-y-0.5">
        <button v-for="seg in topSegments" :key="seg.id"
                class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left"
                :class="selectedId === seg.id ? 'bg-surface-light dark:bg-surface-dark' : ''"
                @click="handleSegmentClick(seg)">
          <IconBadge v-if="seg.icon" :icon="seg.icon" size="sm" :color="seg.color" />
          <span v-else class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: seg.color }" />
          <!-- min-w-0 + truncate: имя отдаёт ширину числам, а не рвёт строку -->
          <span class="flex-1 min-w-0 truncate text-body-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ seg.label }}
          </span>
          <span class="w-10 shrink-0 text-right text-caption text-text-tertiary-light dark:text-text-tertiary-dark tabular-nums">
            {{ formatPercentage(seg.percent) }}
          </span>
          <span class="w-20 shrink-0 text-right text-body-sm font-semibold text-text-primary-light dark:text-text-primary-dark tabular-nums">
            {{ formatCurrency(seg.value, currency, COMPACT_FORMAT) }}
          </span>
        </button>

        <button v-if="segments.length > TOP_LIMIT"
                class="w-full px-2 py-1.5 rounded-lg text-left text-body-sm font-medium text-primary transition-colors"
                @click="showAll = true">
          Все категории ({{ segments.length }})
        </button>
      </div>
    </div>

    <CategoryListSheet v-model:open="showAll" :segments="segments" :currency="currency"
                       :selected-id="selectedId" @select="handleSegmentClick" />
  </UCard>
</template>
```

`TOP_LIMIT = 5`. Три правые колонки (`flex-1 min-w-0 truncate`, `w-10`, `w-20`) — это и есть починка легенды: сейчас четыре элемента делят ширину без ограничений, и длинное имя категории выдавливает сумму.

`CategoryListSheet` — вложенный компонент в той же папке, шторка по образцу `TypeSheet.vue` со всеми сегментами тем же макетом строки.

- [ ] **Шаг 3: Сборка и коммит**

Run: `cd frontend && bun run build`

```bash
git add frontend/src/widgets/analytics/donut-chart/ frontend/src/widgets/analytics/category-breakdown/
git commit -m "feat(analytics): донат с легендой сбоку и шторкой всех категорий"
```

---

### Task 8: `DailyExpenseChart` — ширина от контейнера

**Files:**
- Modify: `frontend/src/widgets/analytics/daily-expense-chart/ui/DailyExpenseChart.vue`

- [ ] **Шаг 1: Заменить константу на измеренную ширину**

Сейчас `:51`:
```ts
const totalWidth = Math.max(count * (BAR_MIN_WIDTH + BAR_GAP), 280);
```
При 31 дне даёт `chartWidth = 346` против ~308px доступных — отсюда горизонтальный скролл.

```ts
import { useElementSize } from '@vueuse/core';

const chartHost = useTemplateRef<HTMLElement>('chartHost');
const { width: hostWidth } = useElementSize(chartHost);

/** До первого измерения ResizeObserver ширина равна 0 — берём разумный дефолт,
 *  иначе первый кадр рисуется столбцами нулевой ширины. */
const availableWidth = computed(() => (hostWidth.value > 0 ? hostWidth.value : 300));

const chartWidth = computed(() => availableWidth.value);

const barWidth = computed(() => {
  const count = props.entries.length || 1;
  const usable = availableWidth.value - Y_AXIS_WIDTH - BAR_GAP * count;
  return Math.max(1, usable / count);
});
```

- [ ] **Шаг 2: Снять горизонтальный скролл**

Заменить обёртку `<div class="overflow-x-auto -mx-1 px-1">` на `<div ref="chartHost" class="w-full">` и убрать `:style="{ minWidth: ... }"` с `<svg>`.

- [ ] **Шаг 3: Убрать `UCard` и заголовок**

Их даёт `TrendsSection` (Task 9). Компонент рендерит только скелет/пустое состояние/график. Проп `groupBy` остаётся — от него зависит формат меток оси X.

- [ ] **Шаг 4: Проверить в браузере**

Открыть `/analytics` на месяце с 31 днём, убедиться что горизонтальной прокрутки нет и подписи оси X читаются (шаг подписей `labelStep` уже адаптивный).

- [ ] **Шаг 5: Коммит**

```bash
git add frontend/src/widgets/analytics/daily-expense-chart/
git commit -m "fix(analytics): график по дням вписывается в контейнер вместо горизонтального скролла"
```

---

### Task 9: `TrendsSection` — два графика под общими табами

**Files:**
- Create: `frontend/src/widgets/analytics/trends/ui/TrendsSection.vue`
- Create: `frontend/src/widgets/analytics/trends/index.ts`
- Modify: `frontend/src/widgets/analytics/period-comparison/ui/PeriodComparison.vue` (убрать `UCard` и `<h3>`)

**Interfaces:**
- Produces: props `entries: { date: string; expense: number }[]`, `groupBy: 'day' | 'week' | 'month'`, `currentExpense`, `previousExpense`, `currentIncome`, `previousIncome`, `currentSavingsRate`, `previousSavingsRate` (все `number`), `currency: string`, `chartLoading?: boolean`, `comparisonLoading?: boolean`, `noComparisonData?: boolean`.

- [ ] **Шаг 1: Написать секцию**

`UCard` с `UTabs size="sm"` (`[{ id: 'chart', label: 'По дням' }, { id: 'comparison', label: 'Сравнение' }]`) и `<KeepAlive>` вокруг активного виджета, чтобы переключение таба не перерисовывало SVG с нуля.

Метка первого таба зависит от `groupBy`: `day` → «По дням», `week` → «По неделям», `month` → «По месяцам» (переносится из `title` в `DailyExpenseChart`).

- [ ] **Шаг 2: `content-visibility` на секции**

```vue
<UCard padding="md" class="[content-visibility:auto] [contain-intrinsic-size:auto_240px]">
```

Секция при первой отрисовке заведомо вне вьюпорта — браузер пропустит её рендер до прокрутки. На сводке и категориях этого не делаем: они видны сразу, и хинт только добавит работы.

- [ ] **Шаг 3: Разгрузить `PeriodComparison`**

Убрать `<UCard class="p-4">` и `<h3>Сравнение с прошлым периодом</h3>`, оставить корневой `<div class="space-y-4">`. Логика строк не меняется.

- [ ] **Шаг 4: Сборка и коммит**

```bash
git add frontend/src/widgets/analytics/trends/ frontend/src/widgets/analytics/period-comparison/
git commit -m "feat(analytics): график и сравнение под общими табами"
```

---

### Task 10: `SpendingPaceChart` — компактнее

**Files:**
- Modify: `frontend/src/widgets/analytics/spending-pace/ui/SpendingPaceChart.vue`

- [ ] **Шаг 1: Убрать отдельную строку легенды**

Блок `:250-294` (три пары «svg-линия + подпись») удаляется. Вместо него — подписи `<text>` внутри SVG у правых концов линий: «План» серым у идеальной линии, «Факт» цветом линии, «Прогноз» — уже есть через `projLabel`.

- [ ] **Шаг 2: Уменьшить высоту графика**

Константа высоты 160 → 130. Проверить, что `yTicks` и подписи не наезжают друг на друга при новой высоте.

- [ ] **Шаг 3: `content-visibility`**

Карточка темпа тоже вне первого экрана — добавить те же классы, что в Task 9, с `contain-intrinsic-size: auto 200px`.

- [ ] **Шаг 4: Визуальная проверка**

Открыть месяц с настроенным бюджетом, убедиться что три линии различимы и подписи не перекрываются.

- [ ] **Шаг 5: Коммит**

```bash
git add frontend/src/widgets/analytics/spending-pace/
git commit -m "perf(analytics): компактный график темпа расходов"
```

---

### Task 11: Сборка `AnalyticsPage` + правки анимаций

**Files:**
- Modify: `frontend/src/pages/analytics/AnalyticsPage.vue`
- Modify: `frontend/src/widgets/analytics/index.ts`
- Modify: `frontend/src/features/analytics-filters/index.ts`
- Delete: `frontend/src/widgets/analytics/income-expense-bar/`
- Delete: `frontend/src/widgets/analytics/daily-stats/`
- Delete: `frontend/src/features/analytics-filters/ui/SwipeablePeriodHeader.vue`

- [ ] **Шаг 1: Заменить липкую шапку**

```vue
<div class="sticky top-0 z-20 -mx-5 lg:-mx-8 px-5 lg:px-8 py-1.5
            bg-background-light dark:bg-background-dark
            border-b border-border-light/50 dark:border-border-dark/50">
  <PeriodBar ... @open-filter="showAccountFilter = true" />
</div>

<AccountFilterSheet v-model:open="showAccountFilter" :items="accountChips"
                    :selected-ids="filters.selectedAccountIds"
                    @toggle="toggleAccount" @clear="clearAccountFilters" />
```

`backdrop-blur-md` и полупрозрачный фон убираются: блюр пересчитывается каждый кадр скролла поверх меняющегося контента — самый дорогой пункт списка оптимизаций. Сплошной `bg-background-*` даёт тот же результат бесплатно.

- [ ] **Шаг 2: Заменить контент четырьмя секциями**

```vue
<AnalyticsSummaryCard :income="convertedIncome" :expense="convertedExpense"
  :available-balance="availableBalance" :days-in-period="daysInPeriod"
  :days-remaining="isCurrentPeriod ? financialDaysRemaining : daysInPeriod"
  :currency="currency" :budget-amount="paceBudgetAmount || undefined"
  :is-past-period="!isCurrentPeriod"
  :balance-label="filters.selectedAccountIds.length > 0 ? 'По выбранным счетам' : undefined"
  :loading="analyticsLoading" />

<SpendingPaceChart v-if="showPace || paceLoading" ... />

<CategoryBreakdown :segments="donutSegments" :total="donutTotal" :currency="currency"
  v-model:category-type="categoryType" :loading="analyticsLoading" />

<TrendsSection v-if="showTrendsChart" ... />
```

`showDailyStats` больше не нужен — метрики живут в сводке всегда.

- [ ] **Шаг 3: Правка слайд-переходов**

```css
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  /* Перечисляем свойства поимённо: `all` заставляет браузер следить за
     каждым анимируемым свойством поддерева. will-change ставится только на
     время перехода, постоянный хинт держал бы лишний слой композитора. */
  transition:
    opacity 150ms ease-out,
    transform 150ms ease-out;
  will-change: opacity, transform;
}
```

Аналогично для `.fade-enter-active` / `.fade-leave-active` — `transition: opacity 150ms ease-out`.

- [ ] **Шаг 4: Ранний выход в обработчике свайпа**

```ts
function onSwipeTouchMove(e: TouchEvent) {
  // Направление определено как вертикальное — дальше считать дельты незачем,
  // жест уже отдан скроллу.
  if (swipeIsHorizontal === false) return;
  ...
}
```

- [ ] **Шаг 5: Удалить мёртвые виджеты**

```bash
cd frontend && rm -rf src/widgets/analytics/income-expense-bar src/widgets/analytics/daily-stats \
  src/features/analytics-filters/ui/SwipeablePeriodHeader.vue
```

Вычистить их из `widgets/analytics/index.ts` и `features/analytics-filters/index.ts`. `top-categories` **не трогать** — используется `pages/dashboard/ui/DashboardTopExpenses.vue:95`.

- [ ] **Шаг 6: Проверить, что ничего не осталось**

```bash
cd frontend && grep -rn "IncomeExpenseBar\|DailyStatsCards\|SwipeablePeriodHeader" src/
```
Expected: пусто.

- [ ] **Шаг 7: Сборка и тесты**

Run: `cd frontend && bun run build && bun run test` (тесты через subagent `test-runner`)
Expected: сборка проходит, `useAnalyticsFilters.spec.ts` / `usePeriodNavigation.spec.ts` / `FilterChips.spec.ts` зелёные без правок — модели не менялись.

- [ ] **Шаг 8: Коммит**

```bash
git add -A frontend/src
git commit -m "feat(analytics): плотный дашборд вместо стека из шести карточек"
```

---

### Task 12: `PersonEditSheet`

**Files:**
- Create: `frontend/src/pages/people/ui/PersonEditSheet.vue`

**Interfaces:**
- Props: `open: boolean`, `person: Person | null`, `debtNet?: PersonDebtNet`, `currency: string`, `saving?: boolean`.
- Emits: `update:open`, `save` (`{ name: string; color: string }`), `delete`.

- [ ] **Шаг 1: Написать шторку**

`DrawerRoot` по образцу `TypeSheet.vue`. Содержимое:
- `UInput` с именем (`autofocus`, Enter = сохранить);
- `UColorPicker` с `ENTITY_COLORS`;
- при `debtNet` — строка-ссылка «{{ debtCount }} долга · {{ сумма }} →» на `/debts`;
- ряд кнопок: «Удалить» (`variant="ghost"`, danger-цвет) слева, «Сохранить» справа.

Блок «Предпросмотр» из старой модалки (аватар `scale-[1.3]` в рамке, ≈150px) не переносится: аватар виден в строке списка, цвет — в самой палитре.

Использовать `useDrawerKeyboard` из `shared/lib/composables` — в проекте он уже решает проблему клавиатуры Telegram в шторках.

- [ ] **Шаг 2: Сборка и коммит**

```bash
git add frontend/src/pages/people/ui/
git commit -m "feat(people): компактная шторка правки контакта"
```

---

### Task 13: `PeopleListPage` — поиск-добавление, компактный список, нетто

**Files:**
- Modify: `frontend/src/pages/people/PeopleListPage.vue`
- Modify: `frontend/src/pages/people/PeopleListPage.spec.ts`

- [ ] **Шаг 1: Подключить долги**

```ts
const { debts } = useDebts(userId);
const { convert } = useExchangeRates(currency);
const debtNetByPerson = computed(() => foldDebtsByPersonName(debts.value, convert));
```

- [ ] **Шаг 2: Поле «поиск + добавление»**

```ts
const query = ref('');

const filteredPeople = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return sortedPeople.value;
  return sortedPeople.value.filter((p) => p.name.toLowerCase().includes(q));
});

/** Кнопку создания показываем, только если точного совпадения нет: иначе
 *  предлагали бы завести второго человека с уже занятым именем. */
const canCreate = computed(() => {
  const name = query.value.trim();
  if (!name) return false;
  return !people.value.some((p) => p.name.trim().toLowerCase() === name.toLowerCase());
});

async function handleCreate() {
  const name = query.value.trim();
  if (!name) return;
  await createPerson({ name, color: colorForName(name) });
  query.value = '';
  toast({ title: 'Контакт добавлен', variant: 'success' });
}
```

`colorForName` — детерминированная функция в `shared/config/colors.ts`:
```ts
/** Один и тот же человек всегда получает один цвет: случайный выбор при
 *  повторном создании давал бы «мигание» цвета аватара. */
export function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return ENTITY_COLORS[Math.abs(hash) % ENTITY_COLORS.length];
}
```

- [ ] **Шаг 3: Компактная строка 52px**

```vue
<button class="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-card-light dark:bg-card-dark
               border border-border-light/50 dark:border-border-dark/50
               transition-colors active:bg-surface-light dark:active:bg-surface-dark"
        @click="openEdit(person)">
  <InitialAvatar :name="person.name" :color="person.color" size="md" class="shrink-0" />
  <span class="flex-1 min-w-0 truncate text-left text-body font-medium text-text-primary-light dark:text-text-primary-dark">
    {{ person.name }}
  </span>
  <span v-if="netFor(person)" class="shrink-0 text-right">
    <span class="block text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
      {{ netFor(person)! > 0 ? 'должен вам' : 'вы должны' }}
    </span>
    <span class="block text-body-sm font-semibold tabular-nums"
          :class="netFor(person)! > 0 ? 'text-success' : 'text-danger'">
      {{ formatCurrency(Math.abs(netFor(person)!), currency, COMPACT_FORMAT) }}
    </span>
  </span>
</button>
```

`transition-colors` вместо `transition-all`; шеврон в круге 32px удаляется — он не нёс информации, вся строка кликабельна. `InitialAvatar size="md"` вместо `lg`.

- [ ] **Шаг 4: Строка-сводка**

Вместо «Всего контактов: N» — «{{ N }} контакта · вам должны {{ сумма }}», где сумма — положительная часть нетто. При отсутствии долгов вторая половина не показывается.

- [ ] **Шаг 5: Убрать FAB и модалку**

`UModal` и FAB удаляются, их заменяют поле сверху и `PersonEditSheet`. `SwipeableItem` и `ConfirmDeleteModal` остаются.

- [ ] **Шаг 6: Обновить тесты**

В `PeopleListPage.spec.ts`:
- заменить сценарий «FAB → модалка → сохранить» на «ввести имя в поле → нажать „Добавить «X»“»;
- заменить `data-testid="add-person-fab"` на `data-testid="person-search-input"` и `data-testid="create-person-btn"`;
- добавить тест: ввод существующего имени фильтрует список и **не** показывает кнопку создания;
- добавить тест: контакт с долгом показывает нетто (MSW-хендлер `GET /debts`);
- сохранить существующие тесты пустого состояния, загрузки, удаления.

Проверить, есть ли в `src/test/mocks/handlers/` хендлер для `/debts`; если нет — добавить, иначе запрос уйдёт в сеть и тесты станут флейки.

- [ ] **Шаг 7: Тесты и сборка**

Run: `cd frontend && bun run test -- PeopleListPage` (через subagent `test-runner`), затем `bun run build`
Expected: PASS.

- [ ] **Шаг 8: Коммит**

```bash
git add frontend/src/pages/people/ frontend/src/shared/config/colors.ts frontend/src/test/
git commit -m "feat(people): компактный список с долговым нетто и добавлением без модалки"
```

---

### Task 14: Проверка результата

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`
- Delete: `docs/superpowers/plans/2026-07-27-baseline.md`

- [ ] **Шаг 1: Повторить замеры из Task 1**

Те же скрипты, те же страницы. Записать «стало» рядом с «было».
Ожидание: аналитика ≈1832 → ≈950px, строка списка людей 76 → 52px.
Если расхождение с ожиданием больше 15% — разобраться, что не ужалось, прежде чем идти дальше.

- [ ] **Шаг 2: Повторить performance trace**

Сравнить LCP и long tasks с базовым замером. Отдельно проверить скролл аналитики после снятия `backdrop-blur`.

- [ ] **Шаг 3: Полный прогон тестов и сборки**

```bash
cd frontend && bun run build && bun run lint
cd ../backend && bun run build
```
Тесты — через subagent `test-runner`, чтобы вывод не попал в основной контекст.

- [ ] **Шаг 4: Запись в changelog**

Верхним элементом `CHANGELOG_ENTRIES`, патч-версия (текущая + 1), тип `improvement`, описание на русском простым языком: что аналитика стала компактнее и быстрее, а контакты — с суммами долгов и добавлением в один тап.

- [ ] **Шаг 5: Финальный коммит**

```bash
rm docs/superpowers/plans/2026-07-27-baseline.md
git add -A
git commit -m "chore: changelog для редизайна аналитики и людей"
```

---

## Self-review

**Покрытие спеки.** Прошёл по разделам спеки: липкая шапка → Task 5+11; сводка → Task 6; категории → Task 7; динамика → Task 9; горизонтальный скролл → Task 8; темп → Task 10; страница людей (добавление, компактность, нетто, редактирование) → Task 4+12+13; девять пунктов FPS → `useCountUp` Task 2, `transitions.ts` Task 3, `DonutChart` Task 7, `backdrop-blur`/`transition: all`/`will-change`/свайп Task 11, `content-visibility` Task 9+10, `transition-colors` Task 7+13, `DailyExpenseChart` Task 8. Замеры → Task 1 и 14. Пробелов не осталось.

**Плейсхолдеры.** «Добавить обработку ошибок», «аналогично Task N», «TBD» — не встречаются; код приведён во всех шагах, где меняется логика.

**Согласованность типов.** `foldDebtsByPersonName` возвращает `Map<string, PersonDebtNet>` (Task 4) — в Task 13 используется как `Map` с ключом от `personKey`. `useCountUp` принимает карту геттеров (Task 2) — в Task 6 вызывается именно так. `DonutChart` получает `selectedId` снаружи (Task 7) — `CategoryBreakdown` его и передаёт. `PeriodBar` эмитит `update:scale` типом `PeriodScale` (Task 5) — страница в Task 11 подключает к `setScale`.

**Найдено и исправлено при ревью:** в первой редакции Task 13 создание контакта звало `getRandomEntityColor`, что противоречило требованию спеки о детерминированном цвете — заменено на `colorForName`, функция определена в том же шаге.
