# Кредитная карта — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Открыть тип счёта `credit_card` пользователю: долг/доступно/лимит одним компонентом на всех экранах, чистый итог по картам, превращение обычного счёта в кредитку через корректировку баланса и полностью переписанное редактирование счёта в шторке `UOverlay`.

**Architecture:** Чистые хелперы состояния карты живут в `entities/account/model/creditCard.ts` (без Vue). Их читают три презентационных компонента слоя `entities/account` (`CreditCardSummary`, `AccountCard`, `AccountTypeSelector`) и композабл страницы `pages/accounts/model/useAccountsPage.ts`. Форма редактирования разделена на состояние (`features/edit-account/model/useEditAccountForm.ts`) и разметку (`features/edit-account/ui/EditAccountDrawer.vue`) — по образцу `features/edit-debt`. Конвертация счёта в кредитку — двухшаговая операция внутри `useEditAccount.update()`: сначала `PATCH /accounts/:id`, затем `POST /transactions/adjust-balance` по каждой валюте. Бэкенд не меняется, кроме демо-данных.

**Tech Stack:** Vue 3 + TS + Tailwind v4, TanStack Vue Query, vitest+jsdom+msw, NestJS (только демо-данные)

**Spec:** docs/superpowers/specs/2026-09-04-credit-card-design.md

## Global Constraints

- Только design-токены (`bg-surface-light dark:bg-surface-dark`, `text-danger`, `text-success`), никаких сырых цветов Tailwind — см. `frontend/DESIGN_SYSTEM.md` § 12 Anti-Patterns.
- `cn()` из `@/shared/lib/utils` для любой динамической строки классов.
- Фронт говорит snake_case (`credit_limit`, `monthly_payment`), бэкенд camelCase; трансформация только в `entities/account/api/accountsApi.ts` — новых мест трансформации не появляется.
- Платформа не разводится классами `md:`/`lg:` — единственный порог 1024 px живёт в `@/shared/lib/platform`; шторки идут через `UOverlay`.
- Новые строки в `entities/account`, `features/edit-account`, `pages/accounts` — по-русски прямо в шаблоне (эти слайсы не локализованы). Новые строки в `features/create-account` — только через `locales/{ru,en}.json` этого слайса.
- Коммиты БЕЗ trailer `Co-Authored-By` и без подписи Claude Code.
- Перед финалом: `bun run build` в `frontend/` и в `backend/`.
- Changelog — patch-bump `1.0.85` → `1.0.86`.
- Иконки берутся по именам Material Symbols; все нужные (`account_balance_wallet`, `savings`, `payments`, `credit_card`, `account_balance`, `diamond`) уже есть в `shared/ui/icon/iconMap.ts` — новых маппингов не требуется.
- `frontend/package.json` НЕ содержит скрипта `type-check`: проверка типов входит в `bun run build` (`vue-tsc -b && vite build`).

---

## Task 1: Хелперы кредитной карты и видимость типа

**Files:**
- Create: `frontend/src/entities/account/model/creditCard.ts`
- Create: `frontend/src/entities/account/model/creditCard.spec.ts`
- Modify: `frontend/src/entities/account/model/account-types.ts` (строки 10–11 — `VISIBLE_ACCOUNT_TYPES`; добавить `ACCOUNT_TYPE_ICONS` после `ACCOUNT_TYPE_LABELS`, строка 21)
- Modify: `frontend/src/entities/account/index.ts` (после строки 9)
- Test: `frontend/src/features/create-account/AccountForm.spec.ts` (строки 84–92)

**Interfaces:**

Consumes:
- `Account`, `AccountWithBalances` из `@/shared/api/database.types` — snake_case, поля `type`, `credit_limit: number | null`, `balances: { currency: string; balance: number }[]`.
- `AccountType = 'basic' | 'savings' | 'credit_card' | 'cash' | 'loan' | 'deposit'` из `../model/account-types`.

Produces (публично из `@/entities/account`):
```ts
export interface CreditCardState {
  debt: number;             // max(0, -balance)
  ownFunds: number;         // max(0, balance)
  limit: number | null;     // credit_limit как есть
  available: number | null; // limit + balance; null, если лимита нет
  utilization: number | null; // debt / limit, зажато в [0,1]; null без лимита или при limit <= 0
}
export function getCreditCardState(account: Pick<Account, 'credit_limit'>, balance: number): CreditCardState;
export function isCreditCard(account: Pick<Account, 'type'>): boolean;
export function suggestDebtOnConversion(balance: number, limit: number | null): number;
export function sumCreditCardDebtByCurrency(accounts: AccountWithBalances[]): Record<string, number>;
export const VISIBLE_ACCOUNT_TYPES: AccountType[]; // ['basic','savings','cash','credit_card']
export const ACCOUNT_TYPE_ICONS: Record<AccountType, string>;
```

- [ ] **Step 1: Write the failing test**

Создать `frontend/src/entities/account/model/creditCard.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  getCreditCardState,
  isCreditCard,
  suggestDebtOnConversion,
  sumCreditCardDebtByCurrency,
} from './creditCard';
import { VISIBLE_ACCOUNT_TYPES, ACCOUNT_TYPE_ICONS } from './account-types';
import type { AccountWithBalances } from '@/shared/api/database.types';

function makeAccount(over: Partial<AccountWithBalances> = {}): AccountWithBalances {
  return {
    id: 'acc-1',
    user_id: 'u1',
    name: 'Карта',
    icon: 'credit_card',
    color: '#f97316',
    type: 'credit_card',
    order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    credit_limit: 10_000_000,
    grace_period_days: null,
    billing_day: null,
    total_amount: null,
    interest_rate: null,
    monthly_payment: null,
    start_date: null,
    end_date: null,
    maturity_date: null,
    is_replenishable: null,
    is_withdrawable: null,
    balances: [{ id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: -2_350_000, created_at: '' }],
    ...over,
  } as AccountWithBalances;
}

describe('getCreditCardState', () => {
  it('отрицательный баланс — это задолженность', () => {
    const s = getCreditCardState({ credit_limit: 10_000_000 }, -2_350_000);
    expect(s.debt).toBe(2_350_000);
    expect(s.ownFunds).toBe(0);
  });

  it('положительный баланс — собственные средства, долга нет', () => {
    const s = getCreditCardState({ credit_limit: 10_000_000 }, 300_000);
    expect(s.debt).toBe(0);
    expect(s.ownFunds).toBe(300_000);
  });

  it('доступно = лимит + баланс', () => {
    expect(getCreditCardState({ credit_limit: 10_000_000 }, -2_350_000).available).toBe(7_650_000);
    expect(getCreditCardState({ credit_limit: 10_000_000 }, 300_000).available).toBe(10_300_000);
  });

  it('утилизация — доля долга в лимите', () => {
    expect(getCreditCardState({ credit_limit: 10_000_000 }, -2_000_000).utilization).toBeCloseTo(0.2);
  });

  it('утилизация зажата единицей при перерасходе', () => {
    expect(getCreditCardState({ credit_limit: 1_000_000 }, -3_000_000).utilization).toBe(1);
  });

  it('без лимита доступно и утилизация — null', () => {
    const s = getCreditCardState({ credit_limit: null }, -500_000);
    expect(s.limit).toBeNull();
    expect(s.available).toBeNull();
    expect(s.utilization).toBeNull();
    expect(s.debt).toBe(500_000);
  });

  it('нулевой лимит не даёт утилизацию', () => {
    expect(getCreditCardState({ credit_limit: 0 }, -500_000).utilization).toBeNull();
  });
});

describe('isCreditCard', () => {
  it('true для credit_card', () => {
    expect(isCreditCard({ type: 'credit_card' })).toBe(true);
  });
  it('false для остальных типов', () => {
    expect(isCreditCard({ type: 'basic' })).toBe(false);
    expect(isCreditCard({ type: 'savings' })).toBe(false);
  });
});

describe('suggestDebtOnConversion', () => {
  it('баланс внутри [0, лимит) читается как доступный остаток', () => {
    expect(suggestDebtOnConversion(3_000_000, 10_000_000)).toBe(7_000_000);
    expect(suggestDebtOnConversion(0, 10_000_000)).toBe(10_000_000);
  });
  it('баланс выше лимита — 0', () => {
    expect(suggestDebtOnConversion(12_000_000, 10_000_000)).toBe(0);
    expect(suggestDebtOnConversion(10_000_000, 10_000_000)).toBe(0);
  });
  it('отрицательный баланс — 0', () => {
    expect(suggestDebtOnConversion(-500_000, 10_000_000)).toBe(0);
  });
  it('без лимита или при нулевом лимите — 0', () => {
    expect(suggestDebtOnConversion(3_000_000, null)).toBe(0);
    expect(suggestDebtOnConversion(3_000_000, 0)).toBe(0);
  });
});

describe('sumCreditCardDebtByCurrency', () => {
  it('складывает долги только по кредиткам и только по валютам с долгом', () => {
    const cards = [
      makeAccount(),
      makeAccount({
        id: 'acc-2',
        balances: [
          { id: 'b2', account_id: 'acc-2', currency: 'UZS', balance: -650_000, created_at: '' },
          { id: 'b3', account_id: 'acc-2', currency: 'USD', balance: -120, created_at: '' },
        ],
      } as Partial<AccountWithBalances>),
      makeAccount({ id: 'acc-3', type: 'basic', balances: [
        { id: 'b4', account_id: 'acc-3', currency: 'UZS', balance: -9_000_000, created_at: '' },
      ] } as Partial<AccountWithBalances>),
    ];
    expect(sumCreditCardDebtByCurrency(cards)).toEqual({ UZS: 3_000_000, USD: 120 });
  });

  it('карта без долга не попадает в итог', () => {
    const cards = [makeAccount({ balances: [
      { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: 400_000, created_at: '' },
    ] } as Partial<AccountWithBalances>)];
    expect(sumCreditCardDebtByCurrency(cards)).toEqual({});
  });

  it('пустой список — пустой итог', () => {
    expect(sumCreditCardDebtByCurrency([])).toEqual({});
  });
});

describe('account-types', () => {
  it('кредитка видна в форме создания', () => {
    expect(VISIBLE_ACCOUNT_TYPES).toEqual(['basic', 'savings', 'cash', 'credit_card']);
  });

  it('у каждого типа есть иконка', () => {
    expect(ACCOUNT_TYPE_ICONS).toEqual({
      basic: 'account_balance_wallet',
      savings: 'savings',
      cash: 'payments',
      credit_card: 'credit_card',
      loan: 'account_balance',
      deposit: 'diamond',
    });
  });
});
```

В `frontend/src/features/create-account/AccountForm.spec.ts` заменить тест на строках 84–92:

```ts
    it('renders account type selector with visible types', async () => {
      currentWrapper = renderForm(makeFormData());
      await flushPromises();
      const typeSelector = currentWrapper.find('[data-testid="account-type-selector"]');
      expect(typeSelector.exists()).toBe(true);
      expect(currentWrapper.find('[data-testid="account-type-basic"]').exists()).toBe(true);
      expect(currentWrapper.find('[data-testid="account-type-savings"]').exists()).toBe(true);
      expect(currentWrapper.find('[data-testid="account-type-cash"]').exists()).toBe(true);
      expect(currentWrapper.find('[data-testid="account-type-credit_card"]').exists()).toBe(true);
    });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && bun run test -- src/entities/account/model/creditCard.spec.ts src/features/create-account/AccountForm.spec.ts
```
Ожидание: `creditCard.spec.ts` падает на резолве модуля (`Failed to resolve import "./creditCard"`), `AccountForm.spec.ts` падает на `account-type-credit_card ... expected false to be true`.

- [ ] **Step 3: Write minimal implementation**

Создать `frontend/src/entities/account/model/creditCard.ts`:

```ts
import type { Account, AccountWithBalances } from '@/shared/api/database.types';

/** Соглашение о балансе кредитки: минус — долг банку, плюс — свои деньги на карте. */
export interface CreditCardState {
  debt: number;
  ownFunds: number;
  limit: number | null;
  available: number | null;
  utilization: number | null;
}

export function getCreditCardState(
  account: Pick<Account, 'credit_limit'>,
  balance: number,
): CreditCardState {
  const limit = account.credit_limit;
  const debt = Math.max(0, -balance);
  const hasLimit = limit != null && limit > 0;

  return {
    debt,
    ownFunds: Math.max(0, balance),
    limit,
    available: limit != null ? limit + balance : null,
    utilization: hasLimit ? Math.min(1, debt / limit) : null,
  };
}

export function isCreditCard(account: Pick<Account, 'type'>): boolean {
  return account.type === 'credit_card';
}

/**
 * Предзаполнение долга при конвертации обычного счёта в кредитку: если на счёте
 * лежит сумма меньше лимита, вероятнее всего это доступный остаток по карте.
 */
export function suggestDebtOnConversion(balance: number, limit: number | null): number {
  if (limit == null || limit <= 0) return 0;
  if (balance < 0 || balance >= limit) return 0;
  return limit - balance;
}

export function sumCreditCardDebtByCurrency(
  accounts: AccountWithBalances[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const account of accounts) {
    if (!isCreditCard(account)) continue;
    for (const balance of account.balances ?? []) {
      const debt = Math.max(0, -balance.balance);
      if (debt === 0) continue;
      totals[balance.currency] = (totals[balance.currency] ?? 0) + debt;
    }
  }
  return totals;
}
```

В `frontend/src/entities/account/model/account-types.ts` заменить строки 10–11 и добавить иконки после `ACCOUNT_TYPE_LABELS`:

```ts
export const VISIBLE_ACCOUNT_TYPES: AccountType[] = ['basic', 'savings', 'cash', 'credit_card'];
export type AccountType = (typeof ACCOUNT_TYPES)[number];
```

```ts
export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  basic: 'account_balance_wallet',
  savings: 'savings',
  credit_card: 'credit_card',
  cash: 'payments',
  loan: 'account_balance',
  deposit: 'diamond',
};
```

(комментарий `// TODO: re-enable all types after debugging` над `VISIBLE_ACCOUNT_TYPES` удалить — он относился к скрытой кредитке.)

В `frontend/src/entities/account/index.ts` после строки `export * from './model/account-types';` добавить:

```ts
export * from './model/creditCard';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && bun run test -- src/entities/account/model/creditCard.spec.ts src/features/create-account/AccountForm.spec.ts
```
Ожидание: обе спеки зелёные.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/entities/account/model/creditCard.ts frontend/src/entities/account/model/creditCard.spec.ts frontend/src/entities/account/model/account-types.ts frontend/src/entities/account/index.ts frontend/src/features/create-account/AccountForm.spec.ts && git commit -m "feat(accounts): хелперы состояния кредитной карты и видимый тип credit_card"
```

---

## Task 2: AccountTypeSelector — один выбор типа на форму и шторку

**Files:**
- Create: `frontend/src/entities/account/ui/AccountTypeSelector.vue`
- Create: `frontend/src/entities/account/ui/AccountTypeSelector.spec.ts`
- Modify: `frontend/src/entities/account/index.ts` (добавить экспорт рядом со строкой 4)
- Modify: `frontend/src/features/create-account/ui/AccountForm.vue` (строки 1–12 — импорты; строки 52–74 — inline-кнопки типа)

**Interfaces:**

Consumes:
- `VISIBLE_ACCOUNT_TYPES: AccountType[]`, `ACCOUNT_TYPE_LABELS: Record<AccountType, string>`, `ACCOUNT_TYPE_ICONS: Record<AccountType, string>`, `AccountType` — из `../model/account-types` (Task 1).
- `UIcon` из `@/shared/ui/icon` (проп `name: string`, `size: 'xs'|'sm'|'md'|'lg'|'xl'`).
- `cn` из `@/shared/lib/utils`.

Produces:
```ts
// frontend/src/entities/account/ui/AccountTypeSelector.vue
defineProps<{ modelValue: AccountType; types?: AccountType[] }>() // types по умолчанию VISIBLE_ACCOUNT_TYPES
defineEmits<{ 'update:modelValue': [value: AccountType] }>()
// разметка: сетка 2×2, корень с data-testid="account-type-selector",
// каждая кнопка с data-testid=`account-type-${t}` и aria-pressed
```
Экспорт: `export { default as AccountTypeSelector } from './ui/AccountTypeSelector.vue';` в `entities/account/index.ts`.

- [ ] **Step 1: Write the failing test**

Создать `frontend/src/entities/account/ui/AccountTypeSelector.spec.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import AccountTypeSelector from './AccountTypeSelector.vue';

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

afterEach(async () => {
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

function render(props: Record<string, unknown> = {}) {
  return renderWithProviders(AccountTypeSelector, {
    provideAuth: { user: mockUser },
    props: { modelValue: 'basic', ...props },
  });
}

describe('AccountTypeSelector', () => {
  it('рисует все видимые типы по умолчанию', async () => {
    currentWrapper = render();
    await flushPromises();
    expect(currentWrapper.find('[data-testid="account-type-selector"]').exists()).toBe(true);
    for (const t of ['basic', 'savings', 'cash', 'credit_card']) {
      expect(currentWrapper.find(`[data-testid="account-type-${t}"]`).exists()).toBe(true);
    }
  });

  it('показывает подпись и иконку каждого типа', async () => {
    currentWrapper = render();
    await flushPromises();
    const card = currentWrapper.find('[data-testid="account-type-credit_card"]');
    expect(card.text()).toContain('Кредитная карта');
    expect(card.find('svg').exists()).toBe(true);
  });

  it('помечает выбранный тип', async () => {
    currentWrapper = render({ modelValue: 'savings' });
    await flushPromises();
    expect(
      currentWrapper.find('[data-testid="account-type-savings"]').attributes('aria-pressed'),
    ).toBe('true');
    expect(
      currentWrapper.find('[data-testid="account-type-basic"]').attributes('aria-pressed'),
    ).toBe('false');
  });

  it('эмитит update:modelValue по клику', async () => {
    currentWrapper = render();
    await flushPromises();
    await currentWrapper.find('[data-testid="account-type-credit_card"]').trigger('click');
    expect(currentWrapper.emitted('update:modelValue')?.[0]).toEqual(['credit_card']);
  });

  it('уважает суженный список типов', async () => {
    currentWrapper = render({ types: ['basic', 'cash'] });
    await flushPromises();
    expect(currentWrapper.find('[data-testid="account-type-basic"]').exists()).toBe(true);
    expect(currentWrapper.find('[data-testid="account-type-credit_card"]').exists()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && bun run test -- src/entities/account/ui/AccountTypeSelector.spec.ts
```
Ожидание: `Failed to resolve import "./AccountTypeSelector.vue"`.

- [ ] **Step 3: Write minimal implementation**

Создать `frontend/src/entities/account/ui/AccountTypeSelector.vue`:

```vue
<script setup lang="ts">
import { UIcon } from '@/shared/ui/icon';
import { cn } from '@/shared/lib/utils';
import {
  VISIBLE_ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_ICONS,
  type AccountType,
} from '../model/account-types';

withDefaults(
  defineProps<{
    modelValue: AccountType;
    types?: AccountType[];
  }>(),
  { types: () => VISIBLE_ACCOUNT_TYPES },
);

defineEmits<{ 'update:modelValue': [value: AccountType] }>();
</script>

<template>
  <div class="grid grid-cols-2 gap-2" data-testid="account-type-selector">
    <button
      v-for="t in types"
      :key="t"
      type="button"
      :data-testid="`account-type-${t}`"
      :aria-pressed="modelValue === t"
      :class="
        cn(
          'flex items-center gap-2 min-w-0 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
          modelValue === t
            ? 'bg-primary text-white border-primary'
            : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border-border-light dark:border-border-dark hover:border-primary/50',
        )
      "
      @click="$emit('update:modelValue', t)"
    >
      <UIcon :name="ACCOUNT_TYPE_ICONS[t]" size="sm" class="shrink-0" />
      <span class="truncate">{{ ACCOUNT_TYPE_LABELS[t] }}</span>
    </button>
  </div>
</template>
```

В `frontend/src/entities/account/index.ts` рядом со строкой 4 добавить:

```ts
export { default as AccountTypeSelector } from './ui/AccountTypeSelector.vue';
```

В `frontend/src/features/create-account/ui/AccountForm.vue` заменить импорт (строки 5–10) на:

```ts
import { AccountTypeFields, AccountTypeSelector, ACCOUNT_ICONS } from '@/entities/account';
```

и заменить блок «Account Type» (строки 52–74) на:

```vue
    <!-- Account Type -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
        {{ $t('features.createAccount.typeLabel') }}
      </label>
      <AccountTypeSelector
        :model-value="formData.type"
        @update:model-value="updateField('type', $event)"
      />
    </div>
```

(строка `import type { AccountType } from '@/entities/account';` больше не нужна — удалить.)

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && bun run test -- src/entities/account/ui/AccountTypeSelector.spec.ts src/features/create-account/AccountForm.spec.ts
```
Ожидание: обе спеки зелёные.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/entities/account/ui/AccountTypeSelector.vue frontend/src/entities/account/ui/AccountTypeSelector.spec.ts frontend/src/entities/account/index.ts frontend/src/features/create-account/ui/AccountForm.vue && git commit -m "feat(accounts): общий выбор типа счёта иконками вместо inline-кнопок"
```

---

## Task 3: Поля кредитки в AccountTypeFields

**Files:**
- Modify: `frontend/src/entities/account/ui/AccountTypeFields.vue` (строки 32–58 — блок `type === 'credit_card'`)
- Create: `frontend/src/entities/account/ui/AccountTypeFields.spec.ts`

**Interfaces:**

Consumes:
- `AccountTypeFieldValues` из `../model/types` — поля `creditLimit`, `gracePeriodDays`, `billingDay`, `totalAmount`, `interestRate`, `monthlyPayment`, `startDate`, `endDate`, `maturityDate`, `isReplenishable`, `isWithdrawable` (всё `| null`).
- `UInput` из `@/shared/ui` — пропы `modelValue`, `label`, `placeholder`, `type: 'text'|'number'|'date'|…`, `variant: 'default'|'search'|'currency'|'flush'`, `suffix`, `error`, `size`.

Produces (контракт компонента не меняется):
```ts
defineProps<{ type: AccountType; fields: AccountTypeFieldValues }>()
defineEmits<{ 'update:field': [key: keyof AccountTypeFieldValues, value: AccountTypeFieldValues[keyof AccountTypeFieldValues]] }>()
```
Новый порядок credit_card: «Кредитный лимит» (полная ширина) → сетка 2 колонки «Минимальный платёж» + «Грейс-период (дней)» → «День выписки».

- [ ] **Step 1: Write the failing test**

Создать `frontend/src/entities/account/ui/AccountTypeFields.spec.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import AccountTypeFields from './AccountTypeFields.vue';
import type { AccountTypeFieldValues } from '../model/types';

const EMPTY: AccountTypeFieldValues = {
  creditLimit: null,
  gracePeriodDays: null,
  billingDay: null,
  totalAmount: null,
  interestRate: null,
  monthlyPayment: null,
  startDate: null,
  endDate: null,
  maturityDate: null,
  isReplenishable: null,
  isWithdrawable: null,
};

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

afterEach(async () => {
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

function render(type: string, fields: Partial<AccountTypeFieldValues> = {}) {
  return renderWithProviders(AccountTypeFields, {
    provideAuth: { user: mockUser },
    props: { type, fields: { ...EMPTY, ...fields } },
  });
}

describe('AccountTypeFields — кредитная карта', () => {
  it('показывает лимит, минимальный платёж, грейс и день выписки', async () => {
    currentWrapper = render('credit_card');
    await flushPromises();
    const text = currentWrapper.text();
    expect(text).toContain('Кредитный лимит');
    expect(text).toContain('Минимальный платёж');
    expect(text).toContain('Грейс-период (дней)');
    expect(text).toContain('День выписки');
  });

  it('не показывает поля кредита и вклада', async () => {
    currentWrapper = render('credit_card');
    await flushPromises();
    expect(currentWrapper.text()).not.toContain('Сумма кредита');
    expect(currentWrapper.text()).not.toContain('Ставка (%)');
  });

  it('минимальный платёж пишется в monthlyPayment', async () => {
    currentWrapper = render('credit_card');
    await flushPromises();
    const labels = currentWrapper.findAll('label');
    const paymentLabel = labels.find((l) => l.text().includes('Минимальный платёж'));
    expect(paymentLabel).toBeDefined();
    const inputId = paymentLabel!.attributes('for');
    const input = currentWrapper.find(`#${inputId}`);
    await input.setValue('500000');
    const emitted = currentWrapper.emitted('update:field') as unknown[][] | undefined;
    expect(emitted).toBeDefined();
    expect(emitted!.some((args) => args[0] === 'monthlyPayment' && args[1] === 500000)).toBe(true);
  });

  it('заполненные значения приходят в поля', async () => {
    currentWrapper = render('credit_card', {
      creditLimit: 10000000,
      monthlyPayment: 500000,
      gracePeriodDays: 55,
      billingDay: 5,
    });
    await flushPromises();
    const values = currentWrapper
      .findAll('input')
      .map((i) => (i.element as HTMLInputElement).value);
    expect(values).toContain('55');
    expect(values).toContain('5');
  });

  it('для loan разметка не изменилась', async () => {
    currentWrapper = render('loan');
    await flushPromises();
    expect(currentWrapper.text()).toContain('Сумма кредита');
    expect(currentWrapper.text()).toContain('Ежемесячный платёж');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && bun run test -- src/entities/account/ui/AccountTypeFields.spec.ts
```
Ожидание: падают тесты «показывает лимит, минимальный платёж…» (`expected '…' to contain 'Минимальный платёж'`) и «минимальный платёж пишется в monthlyPayment».

- [ ] **Step 3: Write minimal implementation**

В `frontend/src/entities/account/ui/AccountTypeFields.vue` заменить блок строк 32–58 на:

```vue
  <!-- Credit Card Fields -->
  <template v-if="type === 'credit_card'">
    <UInput
      :model-value="fields.creditLimit != null ? String(fields.creditLimit) : ''"
      data-testid="credit-limit-input"
      label="Кредитный лимит"
      placeholder="0"
      type="number"
      variant="currency"
      @update:model-value="updateNumber('creditLimit', $event)"
    />
    <div class="grid grid-cols-2 gap-3">
      <UInput
        :model-value="fields.monthlyPayment != null ? String(fields.monthlyPayment) : ''"
        label="Минимальный платёж"
        placeholder="0"
        type="number"
        variant="currency"
        @update:model-value="updateNumber('monthlyPayment', $event)"
      />
      <UInput
        :model-value="fields.gracePeriodDays != null ? String(fields.gracePeriodDays) : ''"
        label="Грейс-период (дней)"
        placeholder="55"
        type="number"
        @update:model-value="updateNumber('gracePeriodDays', $event)"
      />
    </div>
    <UInput
      :model-value="fields.billingDay != null ? String(fields.billingDay) : ''"
      label="День выписки"
      placeholder="1-31"
      type="number"
      min="1"
      max="31"
      @update:model-value="updateNumber('billingDay', $event)"
    />
  </template>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && bun run test -- src/entities/account/ui/AccountTypeFields.spec.ts src/features/create-account/AccountForm.spec.ts
```
Ожидание: обе спеки зелёные.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/entities/account/ui/AccountTypeFields.vue frontend/src/entities/account/ui/AccountTypeFields.spec.ts && git commit -m "feat(accounts): минимальный платёж в полях кредитной карты"
```

---

## Task 4: CreditCardSummary вместо двух копий блока баланса

**Files:**
- Create: `frontend/src/entities/account/ui/CreditCardSummary.vue`
- Create: `frontend/src/entities/account/ui/CreditCardSummary.spec.ts`
- Modify: `frontend/src/entities/account/index.ts` (экспорт рядом со строкой 4)
- Modify: `frontend/src/pages/accounts/AccountDetailPage.vue` (строки 9 — импорт; 258–336 — inline-блок «Credit Card Balances»; 396–427 — карточка «Параметры кредитной карты»)
- Modify: `frontend/src/entities/account/ui/AccountDetailPanel.vue` (строки 5 — импорт `UProgressBar`; 123–184 — inline-блок)
- Test: `frontend/src/pages/accounts/AccountDetailPage.spec.ts` (describe `'credit card account'`, строки ~148–190)

**Interfaces:**

Consumes:
- `getCreditCardState(account, balance): CreditCardState` из `../model/creditCard` (Task 1).
- `AccountWithBalances` из `../model/types` — `balances: { currency, balance }[]`, `monthly_payment`, `grace_period_days`, `billing_day`, `credit_limit`.
- `formatCurrency(amount, currency)` из `@/shared/lib/format/currency`.
- `UProgressBar` из `@/shared/ui/progress-bar` — пропы `value`, `max`, `color: 'primary'|'success'|'danger'|'warning'|<hex>`, `size`, `showLabel`, `ariaLabel`; корень рендерит `role="progressbar"`.

Produces:
```ts
// frontend/src/entities/account/ui/CreditCardSummary.vue
defineProps<{ account: AccountWithBalances }>()
// корень: data-testid="credit-card-summary"
```
Экспорт: `export { default as CreditCardSummary } from './ui/CreditCardSummary.vue';`

- [ ] **Step 1: Write the failing test**

Создать `frontend/src/entities/account/ui/CreditCardSummary.spec.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import CreditCardSummary from './CreditCardSummary.vue';
import type { AccountWithBalances } from '@/shared/api/database.types';

function makeCard(over: Partial<AccountWithBalances> = {}): AccountWithBalances {
  return {
    id: 'acc-1',
    user_id: 'u1',
    name: 'Кредитка',
    icon: 'credit_card',
    color: '#f97316',
    type: 'credit_card',
    order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    credit_limit: 10_000_000,
    grace_period_days: null,
    billing_day: null,
    total_amount: null,
    interest_rate: null,
    monthly_payment: null,
    start_date: null,
    end_date: null,
    maturity_date: null,
    is_replenishable: null,
    is_withdrawable: null,
    balances: [
      { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: -2_350_000, created_at: '' },
    ],
    ...over,
  } as AccountWithBalances;
}

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

afterEach(async () => {
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

function render(account: AccountWithBalances) {
  return renderWithProviders(CreditCardSummary, {
    provideAuth: { user: mockUser },
    props: { account },
  });
}

describe('CreditCardSummary', () => {
  it('герой — задолженность при отрицательном балансе', async () => {
    currentWrapper = render(makeCard());
    await flushPromises();
    expect(currentWrapper.text()).toContain('Задолженность');
    expect(currentWrapper.text()).toContain('2 350 000');
    expect(currentWrapper.find('.text-danger').exists()).toBe(true);
  });

  it('герой — «Долга нет» при нулевом балансе', async () => {
    currentWrapper = render(
      makeCard({
        balances: [{ id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: 0, created_at: '' }],
      } as Partial<AccountWithBalances>),
    );
    await flushPromises();
    expect(currentWrapper.text()).toContain('Долга нет');
  });

  it('герой — свои средства при положительном балансе', async () => {
    currentWrapper = render(
      makeCard({
        balances: [
          { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: 300_000, created_at: '' },
        ],
      } as Partial<AccountWithBalances>),
    );
    await flushPromises();
    expect(currentWrapper.text()).toContain('Свои средства');
    expect(currentWrapper.text()).toContain('300 000');
  });

  it('метр и концы дорожки — при лимите и долге', async () => {
    currentWrapper = render(makeCard());
    await flushPromises();
    expect(currentWrapper.find('[role="progressbar"]').exists()).toBe(true);
    expect(currentWrapper.text()).toContain('доступно');
    expect(currentWrapper.text()).toContain('7 650 000');
    expect(currentWrapper.text()).toContain('лимит');
  });

  it('без долга метра нет', async () => {
    currentWrapper = render(
      makeCard({
        balances: [{ id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: 0, created_at: '' }],
      } as Partial<AccountWithBalances>),
    );
    await flushPromises();
    expect(currentWrapper.find('[role="progressbar"]').exists()).toBe(false);
  });

  it('без лимита — подсказка вместо дорожки', async () => {
    currentWrapper = render(makeCard({ credit_limit: null }));
    await flushPromises();
    expect(currentWrapper.find('[role="progressbar"]').exists()).toBe(false);
    expect(currentWrapper.text()).toContain('Укажите лимит, чтобы видеть доступный остаток');
  });

  it('метр краснеет при использовании выше 80 %', async () => {
    currentWrapper = render(
      makeCard({
        credit_limit: 1_000_000,
        balances: [
          { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: -900_000, created_at: '' },
        ],
      } as Partial<AccountWithBalances>),
    );
    await flushPromises();
    expect(currentWrapper.html()).toContain('bg-danger');
  });

  it('показывает только заданные параметры карты', async () => {
    currentWrapper = render(makeCard({ grace_period_days: 55, billing_day: 5 }));
    await flushPromises();
    const text = currentWrapper.text();
    expect(text).toContain('Грейс-период');
    expect(text).toContain('55 дней');
    expect(text).toContain('День выписки');
    expect(text).toContain('5-е число');
    expect(text).not.toContain('Мин. платёж');
  });

  it('остальные валюты — строкой с подписью «долг» или «свои средства»', async () => {
    currentWrapper = render(
      makeCard({
        balances: [
          { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: -2_350_000, created_at: '' },
          { id: 'b2', account_id: 'acc-1', currency: 'USD', balance: -120, created_at: '' },
          { id: 'b3', account_id: 'acc-1', currency: 'EUR', balance: 40, created_at: '' },
        ],
      } as Partial<AccountWithBalances>),
    );
    await flushPromises();
    const text = currentWrapper.text();
    expect(text).toContain('USD');
    expect(text).toContain('долг');
    expect(text).toContain('EUR');
    expect(text).toContain('свои средства');
  });
});
```

Заменить в `frontend/src/pages/accounts/AccountDetailPage.spec.ts` весь `describe('credit card account', …)` на:

```ts
  describe('credit card account', () => {
    beforeEach(() => {
      server.use(
        http.get('*/api/accounts', () => HttpResponse.json([mockCreditCardAccountResponse])),
      );
    });

    it('shows credit card summary instead of the plain balance block', async () => {
      const wrapper = await renderPage('acc-3');
      expect(wrapper.find('[data-testid="credit-card-summary"]').exists()).toBe(true);
    });

    it('shows debt as the hero when balance is negative', async () => {
      const wrapper = await renderPage('acc-3');
      expect(wrapper.text()).toContain('Задолженность');
      expect(wrapper.text()).toContain('120 000');
    });

    it('shows available and limit as the two ends of the meter', async () => {
      const wrapper = await renderPage('acc-3');
      expect(wrapper.text()).toContain('доступно');
      expect(wrapper.text()).toContain('380 000');
      expect(wrapper.text()).toContain('лимит');
      expect(wrapper.text()).toContain('500 000');
    });

    it('shows only the card parameters that are set', async () => {
      const wrapper = await renderPage('acc-3');
      expect(wrapper.text()).toContain('Грейс-период');
      expect(wrapper.text()).toContain('55 дней');
      expect(wrapper.text()).toContain('День выписки');
      expect(wrapper.text()).toContain('15-е число');
      expect(wrapper.text()).not.toContain('Мин. платёж');
    });

    it('drops the separate credit card parameters card', async () => {
      const wrapper = await renderPage('acc-3');
      expect(wrapper.text()).not.toContain('Параметры кредитной карты');
    });

    it('shows usage progress bar', async () => {
      const wrapper = await renderPage('acc-3');
      expect(wrapper.find('[role="progressbar"]').exists()).toBe(true);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && bun run test -- src/entities/account/ui/CreditCardSummary.spec.ts src/pages/accounts/AccountDetailPage.spec.ts
```
Ожидание: `CreditCardSummary.spec.ts` падает на резолве `./CreditCardSummary.vue`; в `AccountDetailPage.spec.ts` падают `credit-card-summary`, `доступно`, `drops the separate credit card parameters card`.

- [ ] **Step 3: Write minimal implementation**

Создать `frontend/src/entities/account/ui/CreditCardSummary.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { UProgressBar } from '@/shared/ui/progress-bar';
import { formatCurrency } from '@/shared/lib/format/currency';
import { getCreditCardState } from '../model/creditCard';
import type { AccountWithBalances } from '../model/types';

const props = defineProps<{ account: AccountWithBalances }>();

// Лимит у счёта один на все валюты, поэтому метр и «доступно» показываем
// только по первой валюте; остальные идут тихими строками.
const primary = computed(() => props.account.balances?.[0] ?? null);
const primaryState = computed(() =>
  primary.value ? getCreditCardState(props.account, primary.value.balance) : null,
);
const restBalances = computed(() => props.account.balances?.slice(1) ?? []);

const heroLabel = computed(() => {
  const s = primaryState.value;
  if (!s) return 'Задолженность';
  return s.ownFunds > 0 ? 'Свои средства' : 'Задолженность';
});

const heroValue = computed(() => {
  const s = primaryState.value;
  const currency = primary.value?.currency ?? 'UZS';
  if (!s) return '—';
  if (s.debt > 0) return formatCurrency(s.debt, currency);
  if (s.ownFunds > 0) return formatCurrency(s.ownFunds, currency);
  return 'Долга нет';
});

const heroClass = computed(() => {
  const s = primaryState.value;
  if (s && s.debt > 0) return 'text-danger';
  if (s && s.ownFunds > 0) return 'text-success';
  return 'text-text-primary-light dark:text-text-primary-dark';
});

const hasLimit = computed(() => (primaryState.value?.limit ?? 0) > 0);
const showMeter = computed(() => hasLimit.value && (primaryState.value?.debt ?? 0) > 0);
const meterColor = computed(() => ((primaryState.value?.utilization ?? 0) > 0.8 ? 'danger' : 'primary'));

const params = computed(() => {
  const a = props.account;
  const currency = primary.value?.currency ?? 'UZS';
  const rows: Array<{ key: string; label: string; value: string }> = [];
  if (a.monthly_payment != null) {
    rows.push({ key: 'payment', label: 'Мин. платёж', value: formatCurrency(a.monthly_payment, currency) });
  }
  if (a.grace_period_days != null) {
    rows.push({ key: 'grace', label: 'Грейс-период', value: `${a.grace_period_days} дней` });
  }
  if (a.billing_day != null) {
    rows.push({ key: 'billing', label: 'День выписки', value: `${a.billing_day}-е число` });
  }
  return rows;
});
</script>

<template>
  <div v-if="primaryState" class="space-y-4" data-testid="credit-card-summary">
    <!-- Герой: одна крупная сумма на весь экран -->
    <div class="space-y-1">
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        {{ heroLabel }}
      </p>
      <p :class="['text-2xl font-bold tabular-nums tracking-tight', heroClass]">
        {{ heroValue }}
      </p>
    </div>

    <!-- Метр использования лимита -->
    <div v-if="showMeter" class="space-y-1.5">
      <UProgressBar
        :value="primaryState.debt"
        :max="primaryState.limit ?? 0"
        :color="meterColor"
        aria-label="Использование кредитного лимита"
      />
      <div class="flex justify-between text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
        <span>доступно {{ formatCurrency(primaryState.available ?? 0, primary!.currency) }}</span>
        <span>лимит {{ formatCurrency(primaryState.limit ?? 0, primary!.currency) }}</span>
      </div>
    </div>

    <!-- Лимит есть, долга нет: концы дорожки всё равно информативны -->
    <div
      v-else-if="hasLimit"
      class="flex justify-between text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      <span>доступно {{ formatCurrency(primaryState.available ?? 0, primary!.currency) }}</span>
      <span>лимит {{ formatCurrency(primaryState.limit ?? 0, primary!.currency) }}</span>
    </div>

    <p v-else class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
      Укажите лимит, чтобы видеть доступный остаток
    </p>

    <!-- Параметры карты: подпись над значением, без точек-разделителей -->
    <div v-if="params.length" class="grid grid-cols-3 gap-3">
      <div v-for="p in params" :key="p.key" class="min-w-0">
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark truncate">
          {{ p.label }}
        </p>
        <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate">
          {{ p.value }}
        </p>
      </div>
    </div>

    <!-- Остальные валюты -->
    <div v-if="restBalances.length" class="space-y-2 pt-1">
      <div
        v-for="balance in restBalances"
        :key="balance.currency"
        class="flex items-center justify-between gap-3"
      >
        <div class="min-w-0">
          <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ balance.currency }}
          </p>
          <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
            {{ balance.balance < 0 ? 'долг' : 'свои средства' }}
          </p>
        </div>
        <span
          class="text-sm font-semibold tabular-nums"
          :class="
            balance.balance < 0
              ? 'text-danger'
              : 'text-text-primary-light dark:text-text-primary-dark'
          "
        >
          {{ formatCurrency(Math.abs(balance.balance), balance.currency) }}
        </span>
      </div>
    </div>
  </div>
</template>
```

В `frontend/src/entities/account/index.ts` добавить:

```ts
export { default as CreditCardSummary } from './ui/CreditCardSummary.vue';
```

В `frontend/src/pages/accounts/AccountDetailPage.vue`:
1. Строка 9 — импорт становится:
```ts
import {
  useAccounts,
  getAccountTypeLabel,
  CreditCardSummary,
  type AccountWithBalances,
} from '@/entities/account';
```
2. Блок строк 258–336 («Credit Card Balances») заменить на:
```vue
          <!-- Credit Card Summary -->
          <div
            v-if="account.type === 'credit_card'"
            class="mt-6 pt-6 border-t border-border-light dark:border-border-dark"
          >
            <CreditCardSummary :account="account" />
          </div>
```
3. Карточку «Параметры кредитной карты» (строки 396–427, весь `<UCard v-if="account.type === 'credit_card' && …">…</UCard>`) удалить целиком.

В `frontend/src/entities/account/ui/AccountDetailPanel.vue`:
1. Строка 5 — убрать `UProgressBar` из импорта (`import { UButton, UIcon, UCard, EmptyState, USpinner } from '@/shared/ui';`), добавить импорт компонента:
```ts
import CreditCardSummary from './CreditCardSummary.vue';
```
2. Блок строк 123–184 заменить на:
```vue
        <!-- Credit Card Summary -->
        <div
          v-if="account.type === 'credit_card'"
          class="pt-4 border-t border-border-light dark:border-border-dark"
        >
          <CreditCardSummary :account="account" />
        </div>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && bun run test -- src/entities/account/ui/CreditCardSummary.spec.ts src/pages/accounts/AccountDetailPage.spec.ts src/pages/accounts/desktop/AccountsDesktopPage.spec.ts
```
Ожидание: все три спеки зелёные.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/entities/account/ui/CreditCardSummary.vue frontend/src/entities/account/ui/CreditCardSummary.spec.ts frontend/src/entities/account/index.ts frontend/src/entities/account/ui/AccountDetailPanel.vue frontend/src/pages/accounts/AccountDetailPage.vue frontend/src/pages/accounts/AccountDetailPage.spec.ts && git commit -m "feat(accounts): сводка кредитной карты одним компонентом на мобиле и десктопе"
```

---

## Task 5: Кредитка в строке списка счетов

**Files:**
- Modify: `frontend/src/entities/account/ui/AccountCard.vue` (строки 1–31 — скрипт; строки 76–110 — правая колонка)
- Create: `frontend/src/entities/account/ui/AccountCard.spec.ts`

**Interfaces:**

Consumes:
- `getCreditCardState`, `isCreditCard` из `../model/creditCard` (Task 1).
- `formatCurrency(amount, currency, COMPACT_FORMAT)` и `COMPACT_FORMAT` из `@/shared/lib/format/currency`.

Produces: контракт `AccountCard.vue` не меняется — `defineProps<{ account: AccountWithBalances; showBalance?: boolean; compact?: boolean; hidden?: boolean }>()`, `defineEmits<{ click: [] }>()`. Новая ветка правой колонки помечена `data-testid="account-card-credit"`.

- [ ] **Step 1: Write the failing test**

Создать `frontend/src/entities/account/ui/AccountCard.spec.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import AccountCard from './AccountCard.vue';
import type { AccountWithBalances } from '@/shared/api/database.types';

function makeAccount(over: Partial<AccountWithBalances> = {}): AccountWithBalances {
  return {
    id: 'acc-1',
    user_id: 'u1',
    name: 'Кредитка',
    icon: 'credit_card',
    color: '#f97316',
    type: 'credit_card',
    order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    credit_limit: 10_000_000,
    grace_period_days: null,
    billing_day: null,
    total_amount: null,
    interest_rate: null,
    monthly_payment: null,
    start_date: null,
    end_date: null,
    maturity_date: null,
    is_replenishable: null,
    is_withdrawable: null,
    balances: [
      { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: -2_350_000, created_at: '' },
    ],
    ...over,
  } as AccountWithBalances;
}

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

afterEach(async () => {
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

function render(account: AccountWithBalances) {
  return renderWithProviders(AccountCard, {
    provideAuth: { user: mockUser },
    props: { account },
  });
}

describe('AccountCard — кредитная карта', () => {
  it('показывает долг со знаком минус и в danger', async () => {
    currentWrapper = render(makeAccount());
    await flushPromises();
    const credit = currentWrapper.find('[data-testid="account-card-credit"]');
    expect(credit.exists()).toBe(true);
    expect(credit.text()).toContain('2,35');
    expect(credit.text()).toContain('млн');
    expect(credit.html()).toContain('text-danger');
  });

  it('показывает доступный остаток при лимите', async () => {
    currentWrapper = render(makeAccount());
    await flushPromises();
    const credit = currentWrapper.find('[data-testid="account-card-credit"]');
    expect(credit.text()).toContain('доступно');
    expect(credit.text()).toContain('7,65');
  });

  it('без долга сумма не красная', async () => {
    currentWrapper = render(
      makeAccount({
        balances: [{ id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: 0, created_at: '' }],
      } as Partial<AccountWithBalances>),
    );
    await flushPromises();
    const credit = currentWrapper.find('[data-testid="account-card-credit"]');
    expect(credit.text()).toContain('0');
    expect(credit.html()).not.toContain('text-danger');
  });

  it('без лимита строки «доступно» нет', async () => {
    currentWrapper = render(makeAccount({ credit_limit: null }));
    await flushPromises();
    expect(currentWrapper.find('[data-testid="account-card-credit"]').text()).not.toContain(
      'доступно',
    );
  });

  it('подпись типа остаётся «Кредитная карта»', async () => {
    currentWrapper = render(makeAccount());
    await flushPromises();
    expect(currentWrapper.text()).toContain('Кредитная карта');
  });

  it('мультивалютный вид у кредитки не меняется', async () => {
    currentWrapper = render(
      makeAccount({
        balances: [
          { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: -2_350_000, created_at: '' },
          { id: 'b2', account_id: 'acc-1', currency: 'USD', balance: -120, created_at: '' },
        ],
      } as Partial<AccountWithBalances>),
    );
    await flushPromises();
    expect(currentWrapper.find('[data-testid="account-card-credit"]').exists()).toBe(false);
  });

  it('обычный счёт рисуется как раньше', async () => {
    currentWrapper = render(
      makeAccount({
        type: 'basic',
        name: 'Основной',
        balances: [
          { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: 50_000, created_at: '' },
        ],
      } as Partial<AccountWithBalances>),
    );
    await flushPromises();
    expect(currentWrapper.find('[data-testid="account-card-credit"]').exists()).toBe(false);
    expect(currentWrapper.text()).toContain('Основной');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && bun run test -- src/entities/account/ui/AccountCard.spec.ts
```
Ожидание: падают все тесты про `account-card-credit` (`expected false to be true`).

- [ ] **Step 3: Write minimal implementation**

В `frontend/src/entities/account/ui/AccountCard.vue` в `<script setup>` после `formattedBalance` (строка 31) добавить:

```ts
import { getCreditCardState, isCreditCard } from '../model/creditCard';

// У кредитки правая колонка говорит про долг и доступный остаток, а не про
// «баланс»: минус в списке счетов иначе читается как ошибка ввода.
const isCard = computed(() => isCreditCard(props.account) && props.account.balances?.length === 1);
const cardBalance = computed(() => props.account.balances?.[0] ?? null);
const cardState = computed(() =>
  cardBalance.value ? getCreditCardState(props.account, cardBalance.value.balance) : null,
);
```

и заменить одиночную ветку баланса (строки 103–109) на две:

```vue
      <!-- Credit card -->
      <div v-else-if="isCard && cardState && cardBalance" data-testid="account-card-credit" class="space-y-0.5">
        <p
          class="font-semibold text-sm truncate"
          :class="
            cardState.debt > 0
              ? 'text-danger'
              : 'text-text-primary-light dark:text-text-primary-dark'
          "
        >
          {{
            formatCurrency(
              cardState.debt > 0 ? -cardState.debt : cardBalance.balance,
              cardBalance.currency,
              COMPACT_FORMAT,
            )
          }}
        </p>
        <p
          v-if="cardState.available != null && (cardState.limit ?? 0) > 0"
          class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark truncate"
        >
          доступно {{ formatCurrency(cardState.available, cardBalance.currency, COMPACT_FORMAT) }}
        </p>
      </div>

      <!-- Single currency -->
      <p
        v-else
        class="font-semibold text-sm text-text-primary-light dark:text-text-primary-dark truncate"
      >
        {{ formattedBalance }}
      </p>
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && bun run test -- src/entities/account/ui/AccountCard.spec.ts src/pages/accounts/AccountsPage.spec.ts
```
Ожидание: обе спеки зелёные.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/entities/account/ui/AccountCard.vue frontend/src/entities/account/ui/AccountCard.spec.ts && git commit -m "feat(accounts): в списке кредитка показывает долг и доступный остаток"
```

---

## Task 6: Чистый итог — долг по картам вычитается везде

**Files:**
- Modify: `frontend/src/pages/accounts/model/useAccountsPage.ts` (строка 9 — импорт; после `totalBalance`, строки 52–59; блок `return`, строки 151–176)
- Modify: `frontend/src/pages/accounts/AccountsPage.vue` (строки 27–38 — деструктуризация; строки 108–127 — карточка «Общий баланс»)
- Modify: `frontend/src/pages/accounts/desktop/AccountsDesktopPage.vue` (строки 25–47 — деструктуризация; строки 77–91 — карточка итога)
- Modify: `frontend/src/pages/analytics/AnalyticsPage.vue` (строки 122–131 — `availableBalance`)
- Test: `frontend/src/pages/accounts/AccountsPage.spec.ts`

**Interfaces:**

Consumes:
- `sumCreditCardDebtByCurrency(accounts: AccountWithBalances[]): Record<string, number>` из `@/entities/account` (Task 1).
- `convert(amount: number, fromCurrency: string): number` из `useExchangeRates(currency)` — уже есть в `useAccountsPage.ts` (строка 34).

Produces:
```ts
// useAccountsPage() дополнительно отдаёт:
creditCardDebt: ComputedRef<number> // суммарный долг по всем кредиткам в валюте пользователя, >= 0
```
Строка в обеих страницах: `в т.ч. долг по картам −{{ formatCurrency(creditCardDebt, currency) }}`, класс `text-xs text-danger`, `data-testid="credit-card-debt-line"`, рендерится при `creditCardDebt > 0`.

- [ ] **Step 1: Write the failing test**

В `frontend/src/pages/accounts/AccountsPage.spec.ts` добавить новый describe после describe `'rendering'`:

```ts
  // -----------------------------------------------------------------------
  // Долг по кредитным картам
  // -----------------------------------------------------------------------
  describe('credit card debt line', () => {
    it('shows the card debt under the total balance', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockCreditCardAccountResponse]),
        ),
      );
      const wrapper = await renderPage();

      const line = wrapper.find('[data-testid="credit-card-debt-line"]');
      expect(line.exists()).toBe(true);
      expect(line.text()).toContain('в т.ч. долг по картам');
      expect(line.text()).toContain('120 000');
    });

    it('hides the line when no card carries debt', async () => {
      server.use(http.get('*/api/accounts', () => HttpResponse.json([mockAccountResponse])));
      const wrapper = await renderPage();

      expect(wrapper.find('[data-testid="credit-card-debt-line"]').exists()).toBe(false);
    });

    it('subtracts card debt from the total balance', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockCreditCardAccountResponse]),
        ),
      );
      const wrapper = await renderPage();

      // 50 000 (basic) + (−120 000) (кредитка) = −70 000
      expect(wrapper.text()).toContain('70 000');
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && bun run test -- src/pages/accounts/AccountsPage.spec.ts
```
Ожидание: падают `shows the card debt under the total balance` (`expected false to be true`).

- [ ] **Step 3: Write minimal implementation**

В `frontend/src/pages/accounts/model/useAccountsPage.ts`:
1. Строка 9 — импорт:
```ts
import {
  useAccounts,
  sumCreditCardDebtByCurrency,
  type AccountWithBalances,
} from '@/entities/account';
```
2. После `totalBalance` (строка 59) добавить:
```ts
  // Долг по кредиткам считается отдельно от итога: в «Общем балансе» он уже
  // вычтен (баланс карты отрицательный), а строка под ним объясняет, за счёт
  // чего итог просел.
  const creditCardDebt = computed(() => {
    const byCurrency = sumCreditCardDebtByCurrency(accounts.value);
    let total = 0;
    for (const [curr, amount] of Object.entries(byCurrency)) {
      total += convert(amount, curr);
    }
    return total;
  });
```
3. В `return` после `totalBalance,` добавить `creditCardDebt,`.

В `frontend/src/pages/accounts/AccountsPage.vue`:
1. В деструктуризацию `useAccountsPage()` добавить `creditCardDebt,` после `totalBalance,`.
2. После `<p v-else class="text-2xl font-bold …">…</p>` (строка 124) добавить:
```vue
                <p
                  v-if="!isLoading && creditCardDebt > 0"
                  data-testid="credit-card-debt-line"
                  class="text-xs text-danger tabular-nums"
                >
                  в т.ч. долг по картам −{{ formatCurrency(creditCardDebt, currency) }}
                </p>
```

В `frontend/src/pages/accounts/desktop/AccountsDesktopPage.vue`:
1. В деструктуризацию добавить `creditCardDebt,` после `totalBalance,`.
2. После `<p v-else class="text-3xl font-bold …">…</p>` (строка 88) добавить:
```vue
          <p
            v-if="!isLoading && creditCardDebt > 0"
            data-testid="credit-card-debt-line"
            class="text-xs text-danger tabular-nums"
          >
            в т.ч. долг по картам −{{ formatCurrency(creditCardDebt, currency) }}
          </p>
```

В `frontend/src/pages/analytics/AnalyticsPage.vue` заменить тело `availableBalance` (строки 122–131) на:

```ts
  return filtered.reduce((sum, acc) => {
    return (
      sum +
      acc.balances.reduce((bSum, b) => bSum + convertAmount(b.balance, b.currency), 0)
    );
  }, 0);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && bun run test -- src/pages/accounts/AccountsPage.spec.ts src/pages/accounts/desktop/AccountsDesktopPage.spec.ts src/pages/analytics
```
Ожидание: все спеки зелёные.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/accounts/model/useAccountsPage.ts frontend/src/pages/accounts/AccountsPage.vue frontend/src/pages/accounts/AccountsPage.spec.ts frontend/src/pages/accounts/desktop/AccountsDesktopPage.vue frontend/src/pages/analytics/AnalyticsPage.vue && git commit -m "feat(accounts): долг по картам строкой под общим балансом и в аналитике"
```

---

## Task 7: Состояние формы редактирования и конвертация в кредитку

**Files:**
- Create: `frontend/src/features/edit-account/model/useEditAccountForm.ts`
- Create: `frontend/src/features/edit-account/useEditAccountForm.spec.ts`
- Modify: `frontend/src/features/edit-account/model/useEditAccount.ts` (строки 1–7 — импорты; строки 18–34 — `update`)
- Create: `frontend/src/features/edit-account/useEditAccount.spec.ts`
- Modify: `frontend/src/features/edit-account/index.ts` (строка 3)

**Interfaces:**

Consumes:
- `AccountWithBalances`, `Account` из `@/shared/api/database.types` (snake_case).
- `AccountType`, `AccountTypeFieldValues`, `isCreditCard`, `suggestDebtOnConversion` из `@/entities/account`.
- `useAccounts(userId).updateAccount(id, updates: Partial<Account>): Promise<…>` и `useAccounts(userId).getAccountById(id): AccountWithBalances | undefined` — `frontend/src/entities/account/api/useAccounts.ts`.
- `transactionsApi.adjustBalance(params: { accountId: string; targetBalance: number; currency: string; date?: string; description?: string }): Promise<Transaction>` — `@/entities/transaction`.
- `invalidateAccountRelated(queryClient, userId)`, `invalidateTransactionRelated(queryClient, userId)` из `@/shared/api/invalidation`; singleton `queryClient` из `@/shared/api/queryClient`.
- `useToast().toast({ title, description?, variant?: 'default'|'success'|'error'|'warning'|… })` из `@/shared/ui`.

Produces:
```ts
// frontend/src/features/edit-account/model/useEditAccountForm.ts
export interface EditAccountFormData extends AccountTypeFieldValues {
  name: string;
  icon: string;
  color: string;
  type: AccountType;
}

export function useEditAccountForm(account: MaybeRefOrGetter<AccountWithBalances | null>): {
  formData: Ref<EditAccountFormData>;
  debtByCurrency: Ref<Record<string, number>>;
  isValid: ComputedRef<boolean>;
  isDirty: ComputedRef<boolean>;
  nameError: ComputedRef<string | null>;
  isConverting: ComputedRef<boolean>;
  updateField: <K extends keyof EditAccountFormData>(key: K, value: EditAccountFormData[K]) => void;
  setDebt: (currency: string, value: number) => void;
  reset: () => void;
  buildUpdates: () => Partial<Account>;
};
```

```ts
// frontend/src/features/edit-account/model/useEditAccount.ts — расширенная сигнатура
update(
  accountId: string,
  updates: Partial<Account>,
  options?: { debtByCurrency?: Record<string, number> },
): Promise<boolean>
```
Текущие балансы `update` читает сам через `getAccountById(accountId)` из `useAccounts(userId)` — вызывающая сторона их не передаёт. Порог сравнения цели и текущего баланса — `0.001`. Описание корректировки — `'Перевод счёта в кредитную карту'`.

- [ ] **Step 1: Write the failing test**

Создать `frontend/src/features/edit-account/useEditAccountForm.spec.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { useEditAccountForm } from './model/useEditAccountForm';
import type { AccountWithBalances } from '@/shared/api/database.types';

function makeAccount(over: Partial<AccountWithBalances> = {}): AccountWithBalances {
  return {
    id: 'acc-1',
    user_id: 'u1',
    name: 'Основной',
    icon: 'account_balance_wallet',
    color: '#10b981',
    type: 'basic',
    order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    credit_limit: null,
    grace_period_days: null,
    billing_day: null,
    total_amount: null,
    interest_rate: null,
    monthly_payment: null,
    start_date: null,
    end_date: null,
    maturity_date: null,
    is_replenishable: null,
    is_withdrawable: null,
    balances: [
      { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: 3_000_000, created_at: '' },
    ],
    ...over,
  } as AccountWithBalances;
}

function renderForm(account: AccountWithBalances) {
  let instance!: ReturnType<typeof useEditAccountForm>;
  const source = ref<AccountWithBalances | null>(account);
  const Wrapper = defineComponent({
    setup() {
      instance = useEditAccountForm(source);
      return {};
    },
    template: '<div />',
  });
  const wrapper = renderWithProviders(Wrapper, { provideAuth: { user: mockUser } });
  return { wrapper, source, get: () => instance };
}

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

afterEach(async () => {
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

describe('useEditAccountForm', () => {
  it('наполняется из счёта', () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    expect(get().formData.value.name).toBe('Основной');
    expect(get().formData.value.type).toBe('basic');
    expect(get().isDirty.value).toBe(false);
  });

  it('пустое имя и пробелы дают ошибку', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('name', '   ');
    await nextTick();
    expect(get().nameError.value).toBe('Название не может состоять из пробелов');
    expect(get().isValid.value).toBe(false);
  });

  it('слишком короткое и слишком длинное имя невалидны', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('name', 'A');
    await nextTick();
    expect(get().nameError.value).toBe('Минимум 2 символа');
    get().updateField('name', 'x'.repeat(51));
    await nextTick();
    expect(get().nameError.value).toBe('Максимум 50 символов');
  });

  it('isDirty реагирует на правку', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('name', 'Другой');
    await nextTick();
    expect(get().isDirty.value).toBe(true);
  });

  it('isConverting только при переходе из другого типа в кредитку', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    expect(get().isConverting.value).toBe(false);
    get().updateField('type', 'credit_card');
    await nextTick();
    expect(get().isConverting.value).toBe(true);
  });

  it('кредитка, которая уже кредитка, не конвертируется', async () => {
    const { wrapper, get } = renderForm(makeAccount({ type: 'credit_card', credit_limit: 10_000_000 }));
    currentWrapper = wrapper;
    expect(get().isConverting.value).toBe(false);
  });

  it('долг первой валюты пересчитывается при смене лимита', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('type', 'credit_card');
    await nextTick();
    get().updateField('creditLimit', 10_000_000);
    await nextTick();
    expect(get().debtByCurrency.value.UZS).toBe(7_000_000);
  });

  it('после ручной правки долг больше не пересчитывается', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('type', 'credit_card');
    get().updateField('creditLimit', 10_000_000);
    await nextTick();
    get().setDebt('UZS', 1_000_000);
    await nextTick();
    get().updateField('creditLimit', 20_000_000);
    await nextTick();
    expect(get().debtByCurrency.value.UZS).toBe(1_000_000);
  });

  it('остальные валюты стартуют с нуля', async () => {
    const { wrapper, get } = renderForm(
      makeAccount({
        balances: [
          { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: 3_000_000, created_at: '' },
          { id: 'b2', account_id: 'acc-1', currency: 'USD', balance: 200, created_at: '' },
        ],
      } as Partial<AccountWithBalances>),
    );
    currentWrapper = wrapper;
    get().updateField('type', 'credit_card');
    await nextTick();
    expect(get().debtByCurrency.value.USD).toBe(0);
  });

  it('buildUpdates отдаёт snake_case-патч', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('name', '  Кредитка  ');
    get().updateField('type', 'credit_card');
    get().updateField('creditLimit', 10_000_000);
    get().updateField('monthlyPayment', 500_000);
    await nextTick();
    const updates = get().buildUpdates();
    expect(updates.name).toBe('Кредитка');
    expect(updates.type).toBe('credit_card');
    expect(updates.credit_limit).toBe(10_000_000);
    expect(updates.monthly_payment).toBe(500_000);
  });

  it('reset возвращает исходное состояние', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('name', 'Другой');
    await nextTick();
    get().reset();
    await nextTick();
    expect(get().formData.value.name).toBe('Основной');
    expect(get().isDirty.value).toBe(false);
  });
});
```

Создать `frontend/src/features/edit-account/useEditAccount.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockCreditCardAccountResponse } from '@/test/mocks/handlers/accounts';
import { useEditAccount } from './model/useEditAccount';

const { adjustBalanceMock, toastMock } = vi.hoisted(() => ({
  adjustBalanceMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/entities/transaction', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    transactionsApi: {
      ...(actual.transactionsApi as Record<string, unknown>),
      adjustBalance: adjustBalanceMock,
    },
  };
});

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useToast: () => ({ toast: toastMock }) };
});

function renderComposable() {
  let instance!: ReturnType<typeof useEditAccount>;
  const Wrapper = defineComponent({
    setup() {
      instance = useEditAccount(() => mockUser.id);
      return {};
    },
    template: '<div />',
  });
  const wrapper = renderWithProviders(Wrapper, { provideAuth: { user: mockUser } });
  return { wrapper, get: () => instance };
}

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  adjustBalanceMock.mockResolvedValue({});
  // acc-3: кредитка с балансом −120 000 UZS
  server.use(http.get('*/api/accounts', () => HttpResponse.json([mockCreditCardAccountResponse])));
});

afterEach(async () => {
  server.resetHandlers();
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

describe('useEditAccount.update', () => {
  it('без debtByCurrency корректировку не зовёт', async () => {
    const { wrapper, get } = renderComposable();
    currentWrapper = wrapper;
    await flushPromises();

    const ok = await get().update('acc-3', { name: 'Новая' });
    expect(ok).toBe(true);
    expect(adjustBalanceMock).not.toHaveBeenCalled();
  });

  it('корректирует баланс до −долга после PATCH', async () => {
    const patchCalls: string[] = [];
    server.use(
      http.patch('*/api/accounts/:id', async () => {
        patchCalls.push('patch');
        return HttpResponse.json({ ...mockCreditCardAccountResponse });
      }),
    );
    adjustBalanceMock.mockImplementation(() => {
      patchCalls.push('adjust');
      return Promise.resolve({});
    });

    const { wrapper, get } = renderComposable();
    currentWrapper = wrapper;
    await flushPromises();

    const ok = await get().update(
      'acc-3',
      { type: 'credit_card' },
      { debtByCurrency: { UZS: 2_000_000 } },
    );

    expect(ok).toBe(true);
    expect(patchCalls).toEqual(['patch', 'adjust']);
    expect(adjustBalanceMock).toHaveBeenCalledWith({
      accountId: 'acc-3',
      targetBalance: -2_000_000,
      currency: 'UZS',
      description: 'Перевод счёта в кредитную карту',
    });
  });

  it('пропускает валюту, где цель уже совпадает с балансом', async () => {
    const { wrapper, get } = renderComposable();
    currentWrapper = wrapper;
    await flushPromises();

    // текущий баланс acc-3 = −120 000, цель −120 000
    const ok = await get().update('acc-3', {}, { debtByCurrency: { UZS: 120_000 } });

    expect(ok).toBe(true);
    expect(adjustBalanceMock).not.toHaveBeenCalled();
  });

  it('падение корректировки не отменяет смену типа: true + предупреждение', async () => {
    adjustBalanceMock.mockRejectedValue(new Error('boom'));

    const { wrapper, get } = renderComposable();
    currentWrapper = wrapper;
    await flushPromises();

    const ok = await get().update(
      'acc-3',
      { type: 'credit_card' },
      { debtByCurrency: { UZS: 2_000_000 } },
    );

    expect(ok).toBe(true);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Счёт переведён, но баланс не скорректирован',
        variant: 'warning',
      }),
    );
  });

  it('падение PATCH возвращает false и корректировку не зовёт', async () => {
    server.use(
      http.patch('*/api/accounts/:id', () => new HttpResponse(null, { status: 500 })),
    );

    const { wrapper, get } = renderComposable();
    currentWrapper = wrapper;
    await flushPromises();

    const ok = await get().update(
      'acc-3',
      { type: 'credit_card' },
      { debtByCurrency: { UZS: 2_000_000 } },
    );

    expect(ok).toBe(false);
    expect(adjustBalanceMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && bun run test -- src/features/edit-account/useEditAccountForm.spec.ts src/features/edit-account/useEditAccount.spec.ts
```
Ожидание: `useEditAccountForm.spec.ts` падает на резолве `./model/useEditAccountForm`; `useEditAccount.spec.ts` падает на тестах с `debtByCurrency` (`adjustBalanceMock` не вызван).

- [ ] **Step 3: Write minimal implementation**

Создать `frontend/src/features/edit-account/model/useEditAccountForm.ts`:

```ts
import { computed, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue';
import { suggestDebtOnConversion, type AccountType, type AccountTypeFieldValues } from '@/entities/account';
import type { Account, AccountWithBalances } from '@/shared/api/database.types';

export interface EditAccountFormData extends AccountTypeFieldValues {
  name: string;
  icon: string;
  color: string;
  type: AccountType;
}

const EMPTY_TYPE_FIELDS: AccountTypeFieldValues = {
  creditLimit: null,
  gracePeriodDays: null,
  billingDay: null,
  totalAmount: null,
  interestRate: null,
  monthlyPayment: null,
  startDate: null,
  endDate: null,
  maturityDate: null,
  isReplenishable: null,
  isWithdrawable: null,
};

function fromAccount(account: AccountWithBalances | null): EditAccountFormData {
  if (!account) {
    return { name: '', icon: 'account_balance_wallet', color: '#10b981', type: 'basic', ...EMPTY_TYPE_FIELDS };
  }
  return {
    name: account.name,
    icon: account.icon,
    color: account.color,
    type: account.type as AccountType,
    creditLimit: account.credit_limit,
    gracePeriodDays: account.grace_period_days,
    billingDay: account.billing_day,
    totalAmount: account.total_amount,
    interestRate: account.interest_rate,
    monthlyPayment: account.monthly_payment,
    startDate: account.start_date,
    endDate: account.end_date,
    maturityDate: account.maturity_date,
    isReplenishable: account.is_replenishable,
    isWithdrawable: account.is_withdrawable,
  };
}

export function useEditAccountForm(account: MaybeRefOrGetter<AccountWithBalances | null>) {
  const formData = ref<EditAccountFormData>(fromAccount(toValue(account))) as Ref<EditAccountFormData>;
  const debtByCurrency = ref<Record<string, number>>({});
  // Пока пользователь не тронул поле долга сам, оно следует за лимитом.
  const debtTouched = ref(false);

  const originalType = computed(() => (toValue(account)?.type ?? null) as AccountType | null);
  const balances = computed(() => toValue(account)?.balances ?? []);

  const isConverting = computed(
    () => originalType.value !== 'credit_card' && formData.value.type === 'credit_card',
  );

  function seedDebt() {
    const next: Record<string, number> = {};
    balances.value.forEach((b, index) => {
      next[b.currency] =
        index === 0 ? suggestDebtOnConversion(b.balance, formData.value.creditLimit) : 0;
    });
    debtByCurrency.value = next;
  }

  function reset() {
    formData.value = fromAccount(toValue(account));
    debtByCurrency.value = {};
    debtTouched.value = false;
  }

  watch(() => toValue(account), reset);

  // Смена типа обнуляет чужие поля — иначе в патч уедет ставка от вклада,
  // которую пользователь на кредитке уже не видит.
  watch(
    () => formData.value.type,
    (next, prev) => {
      if (next === prev) return;
      const base = next === originalType.value ? fromAccount(toValue(account)) : null;
      Object.assign(formData.value, base ?? EMPTY_TYPE_FIELDS);
      formData.value.type = next;
      debtTouched.value = false;
      if (next === 'credit_card' && originalType.value !== 'credit_card') seedDebt();
      else debtByCurrency.value = {};
    },
  );

  watch(
    () => formData.value.creditLimit,
    () => {
      if (!isConverting.value || debtTouched.value) return;
      seedDebt();
    },
  );

  const nameError = computed<string | null>(() => {
    const name = formData.value.name;
    if (name.length === 0) return 'Введите название';
    if (name.trim().length === 0) return 'Название не может состоять из пробелов';
    if (name.trim().length < 2) return 'Минимум 2 символа';
    if (name.trim().length > 50) return 'Максимум 50 символов';
    return null;
  });

  const isValid = computed(() => nameError.value === null);

  function buildUpdates(): Partial<Account> {
    const f = formData.value;
    return {
      name: f.name.trim(),
      icon: f.icon,
      color: f.color,
      type: f.type,
      credit_limit: f.creditLimit,
      grace_period_days: f.gracePeriodDays,
      billing_day: f.billingDay,
      total_amount: f.totalAmount,
      interest_rate: f.interestRate,
      monthly_payment: f.monthlyPayment,
      start_date: f.startDate,
      end_date: f.endDate,
      maturity_date: f.maturityDate,
      is_replenishable: f.isReplenishable,
      is_withdrawable: f.isWithdrawable,
    };
  }

  const isDirty = computed(() => {
    const source = toValue(account);
    if (!source) return false;
    const original = JSON.stringify(
      (() => {
        const saved = formData.value;
        formData.value = fromAccount(source);
        const snapshot = buildUpdates();
        formData.value = saved;
        return snapshot;
      })(),
    );
    if (JSON.stringify(buildUpdates()) !== original) return true;
    return Object.values(debtByCurrency.value).some((v) => v !== 0);
  });

  function updateField<K extends keyof EditAccountFormData>(key: K, value: EditAccountFormData[K]) {
    formData.value[key] = value;
  }

  function setDebt(currency: string, value: number) {
    debtTouched.value = true;
    debtByCurrency.value = { ...debtByCurrency.value, [currency]: value };
  }

  return {
    formData,
    debtByCurrency,
    isValid,
    isDirty,
    nameError,
    isConverting,
    updateField,
    setDebt,
    reset,
    buildUpdates,
  };
}
```

> Примечание для исполнителя: подмена `formData` внутри `isDirty` — приём ради одного `buildUpdates()`; если он окажется хрупким, вынести чистую функцию `toUpdates(data: EditAccountFormData): Partial<Account>` и сравнивать `toUpdates(formData.value)` с `toUpdates(fromAccount(source))`. Поведение и тесты при этом не меняются.

В `frontend/src/features/edit-account/model/useEditAccount.ts`:
1. Строки 1–7 — импорты:
```ts
import { ref, toValue, type MaybeRefOrGetter } from 'vue';
import { useAccounts } from '@/entities/account';
import { transactionsApi } from '@/entities/transaction';
import { useProfile } from '@/shared/api';
import type { Account } from '@/shared/api/database.types';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
```
2. Строка 11 — забрать ещё и `getAccountById`:
```ts
  const { updateAccount, deleteAccount, getAccountById } = useAccounts(userId);
```
3. Заменить `update` (строки 18–34) на:
```ts
  const CONVERSION_DESCRIPTION = 'Перевод счёта в кредитную карту';
  // Копейки в целевом балансе не повод дёргать корректировку.
  const BALANCE_EPSILON = 0.001;

  /**
   * Порядок «сначала PATCH, потом корректировка» намеренный: если упадёт
   * второй шаг, у пользователя останется кредитка со старым балансом и кнопка
   * «Скорректировать баланс» на экране. Обратный порядок оставил бы обычный
   * счёт в минусе.
   */
  async function update(
    accountId: string,
    updates: Partial<Account>,
    options?: { debtByCurrency?: Record<string, number> },
  ) {
    isUpdating.value = true;
    error.value = null;

    try {
      await updateAccount(accountId, updates);
    } catch (e) {
      error.value = 'Не удалось обновить счёт';
      toast({ title: 'Не удалось обновить счёт', variant: 'error' });
      console.error('Failed to update account:', e);
      isUpdating.value = false;
      return false;
    }

    const debts = options?.debtByCurrency;
    if (debts && Object.keys(debts).length > 0) {
      const current = getAccountById(accountId);
      try {
        for (const [currency, debt] of Object.entries(debts)) {
          const target = -debt;
          const balance = current?.balances.find((b) => b.currency === currency)?.balance ?? 0;
          if (Math.abs(target - balance) <= BALANCE_EPSILON) continue;
          await transactionsApi.adjustBalance({
            accountId,
            targetBalance: target,
            currency,
            description: CONVERSION_DESCRIPTION,
          });
        }
        const uid = toValue(userId) ?? '';
        await Promise.all([
          invalidateAccountRelated(queryClient, uid),
          invalidateTransactionRelated(queryClient, uid),
        ]);
      } catch (e) {
        console.error('Failed to adjust balance after conversion:', e);
        toast({
          title: 'Счёт переведён, но баланс не скорректирован',
          description: 'Поправьте его кнопкой «Скорректировать баланс» на экране счёта',
          variant: 'warning',
        });
        isUpdating.value = false;
        return true;
      }
    }

    toast({ title: 'Счёт обновлён', variant: 'success' });
    isUpdating.value = false;
    return true;
  }
```

В `frontend/src/features/edit-account/index.ts` строка 3 становится:
```ts
export { useEditAccount } from './model/useEditAccount';
export { useEditAccountForm } from './model/useEditAccountForm';
export type { EditAccountFormData } from './model/useEditAccountForm';
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && bun run test -- src/features/edit-account
```
Ожидание: `useEditAccountForm.spec.ts` и `useEditAccount.spec.ts` зелёные; `EditAccountModal.spec.ts` по-прежнему зелёный.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/edit-account/model/useEditAccountForm.ts frontend/src/features/edit-account/useEditAccountForm.spec.ts frontend/src/features/edit-account/model/useEditAccount.ts frontend/src/features/edit-account/useEditAccount.spec.ts frontend/src/features/edit-account/index.ts && git commit -m "feat(accounts): конвертация счёта в кредитку через корректировку баланса"
```

---

## Task 8: EditAccountDrawer вместо EditAccountModal

**Files:**
- Create: `frontend/src/features/edit-account/ui/EditAccountDrawer.vue`
- Create: `frontend/src/features/edit-account/EditAccountDrawer.spec.ts`
- Delete: `frontend/src/features/edit-account/ui/EditAccountModal.vue`, `frontend/src/features/edit-account/EditAccountModal.spec.ts`
- Modify: `frontend/src/features/edit-account/index.ts` (строка 1)
- Modify: `frontend/src/pages/accounts/AccountDetailPage.vue` (строка 20 — импорт; строки 116–122 — `handleUpdateAccount`; строки 579–584 — использование)
- Modify: `frontend/src/pages/accounts/model/useAccountsPage.ts` (строки 133–140 — `handleUpdateAccount`)
- Modify: `frontend/src/pages/accounts/desktop/AccountsDesktopPage.vue` (строка 7 — импорт; строки 170–176 — использование)
- Test: `frontend/src/pages/accounts/AccountDetailPage.spec.ts` (строки 291 и 409 — имя компонента; шапка файла — мок vaul)

**Interfaces:**

Consumes:
- `useEditAccountForm(account)` (Task 7) — `formData`, `debtByCurrency`, `isValid`, `isDirty`, `nameError`, `isConverting`, `updateField`, `setDebt`, `reset`, `buildUpdates`.
- `UOverlay` из `@/shared/ui` — пропы `modelValue`, `title`, `desktop: 'panel'|'dialog'`, `maxHeight`; слоты `default` и `#footer`; содержимое телепортируется в `body`.
- `IconBadge` из `@/shared/ui` — пропы `icon: string`, `size: 'xs'|'sm'|'md'|'lg'`, `color?: string`, `class?: string`.
- `UInput`, `UButton`, `UIconSelector`, `UColorPicker` из `@/shared/ui`; `ACCOUNT_ICONS` из `@/entities/account`; `ENTITY_COLORS` из `@/shared/config/colors`.
- `AccountTypeSelector` (Task 2), `AccountTypeFields` (Task 3), `getAccountTypeLabel`, `suggestDebtOnConversion` — из `@/entities/account`.
- `formatCurrency`, `getCurrencySymbol` из `@/shared/lib/format/currency`.

Produces:
```ts
// frontend/src/features/edit-account/ui/EditAccountDrawer.vue
defineProps<{ modelValue: boolean; account: AccountWithBalances | null; isUpdating?: boolean }>()
defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [updates: Partial<Account>, debtByCurrency?: Record<string, number>];
}>()
// data-testid: edit-account-form, account-name-input, save-btn, conversion-block, debt-input-<CURRENCY>
```
Новые сигнатуры потребителей:
```ts
// AccountDetailPage.vue
async function handleUpdateAccount(updates: Partial<Account>, debtByCurrency?: Record<string, number>): Promise<void>
// useAccountsPage.ts
async function handleUpdateAccount(updates: Partial<Account>, debtByCurrency?: Record<string, number>): Promise<boolean>
```

- [ ] **Step 1: Write the failing test**

Создать `frontend/src/features/edit-account/EditAccountDrawer.spec.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import EditAccountDrawer from './ui/EditAccountDrawer.vue';
import type { AccountWithBalances } from '@/shared/api/database.types';

vi.mock('vaul-vue', async () => (await import('@/test/stubs/vaul')).vaulStub);

function makeAccount(over: Partial<AccountWithBalances> = {}): AccountWithBalances {
  return {
    id: 'acc-1',
    user_id: 'test-user-1',
    name: 'Основной',
    icon: 'account_balance_wallet',
    color: '#10b981',
    type: 'basic',
    order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    credit_limit: null,
    grace_period_days: null,
    billing_day: null,
    total_amount: null,
    interest_rate: null,
    monthly_payment: null,
    start_date: null,
    end_date: null,
    maturity_date: null,
    is_replenishable: null,
    is_withdrawable: null,
    balances: [
      { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: 3_000_000, created_at: '' },
    ],
    ...over,
  } as AccountWithBalances;
}

function findInBody(selector: string): HTMLElement | null {
  return document.body.querySelector(selector);
}

async function setBodyInputValue(selector: string, value: string) {
  const input = document.body.querySelector(selector) as HTMLInputElement | null;
  if (!input) throw new Error(`Input not found: ${selector}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}

function renderDrawer(props: Record<string, unknown> = {}) {
  return renderWithProviders(EditAccountDrawer, {
    provideAuth: { user: mockUser },
    props: { modelValue: true, account: makeAccount(), isUpdating: false, ...props },
  });
}

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

afterEach(async () => {
  server.resetHandlers();
  currentWrapper?.unmount();
  currentWrapper = null;
  document.body.innerHTML = '';
  await flushPromises();
});

describe('EditAccountDrawer', () => {
  it('рисует форму в body с заголовком', async () => {
    currentWrapper = renderDrawer();
    await flushPromises();
    expect(findInBody('[data-testid="edit-account-form"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Редактировать счёт');
  });

  it('предпросмотр показывает имя и подпись типа', async () => {
    currentWrapper = renderDrawer({ account: makeAccount({ name: 'Наличка', type: 'cash' }) });
    await flushPromises();
    const preview = findInBody('[data-testid="account-preview"]');
    expect(preview).not.toBeNull();
    expect(preview!.textContent).toContain('Наличка');
    expect(preview!.textContent).toContain('Наличные');
  });

  it('предпросмотр обновляется по мере ввода имени', async () => {
    currentWrapper = renderDrawer();
    await flushPromises();
    await setBodyInputValue('[data-testid="account-name-input"] input', 'Кредитка');
    await flushPromises();
    expect(findInBody('[data-testid="account-preview"]')!.textContent).toContain('Кредитка');
  });

  it('«Сохранить» выключена без изменений', async () => {
    currentWrapper = renderDrawer();
    await flushPromises();
    const btn = findInBody('[data-testid="save-btn"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('блока конвертации нет, пока тип не сменили на кредитку', async () => {
    currentWrapper = renderDrawer();
    await flushPromises();
    expect(findInBody('[data-testid="conversion-block"]')).toBeNull();
  });

  it('блок конвертации появляется при смене типа на кредитку', async () => {
    currentWrapper = renderDrawer();
    await flushPromises();
    (findInBody('[data-testid="account-type-credit_card"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(findInBody('[data-testid="conversion-block"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Задолженность сейчас');
  });

  it('у счёта, который уже кредитка, блока конвертации нет', async () => {
    currentWrapper = renderDrawer({
      account: makeAccount({ type: 'credit_card', credit_limit: 10_000_000 }),
    });
    await flushPromises();
    expect(findInBody('[data-testid="conversion-block"]')).toBeNull();
  });

  it('долг предзаполняется и пересчитывается при смене лимита', async () => {
    currentWrapper = renderDrawer();
    await flushPromises();
    (findInBody('[data-testid="account-type-credit_card"]') as HTMLButtonElement).click();
    await flushPromises();

    await setBodyInputValue('[data-testid="credit-limit-input"] input', '10000000');
    await flushPromises();

    const debtInput = findInBody('[data-testid="debt-input-UZS"] input') as HTMLInputElement;
    expect(debtInput.value.replace(/\s/g, '')).toBe('7000000');
  });

  it('confirm отдаёт updates и debtByCurrency', async () => {
    currentWrapper = renderDrawer();
    await flushPromises();
    (findInBody('[data-testid="account-type-credit_card"]') as HTMLButtonElement).click();
    await flushPromises();
    await setBodyInputValue('[data-testid="credit-limit-input"] input', '10000000');
    await flushPromises();

    (findInBody('[data-testid="save-btn"]') as HTMLButtonElement).click();
    await flushPromises();

    const emitted = currentWrapper.emitted('confirm') as unknown[][] | undefined;
    expect(emitted).toBeDefined();
    const [updates, debts] = emitted![0] as [Record<string, unknown>, Record<string, number>];
    expect(updates.type).toBe('credit_card');
    expect(updates.credit_limit).toBe(10_000_000);
    expect(debts).toEqual({ UZS: 7_000_000 });
  });
});
```

В `frontend/src/pages/accounts/AccountDetailPage.spec.ts`:
- после блока `vi.mock('@/app/router', …)` добавить `vi.mock('vaul-vue', async () => (await import('@/test/stubs/vaul')).vaulStub);`
- заменить обе строки `wrapper.findComponent({ name: 'EditAccountModal' })` (строки 291 и 409) на `wrapper.findComponent({ name: 'EditAccountDrawer' })`.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && bun run test -- src/features/edit-account/EditAccountDrawer.spec.ts src/pages/accounts/AccountDetailPage.spec.ts
```
Ожидание: `EditAccountDrawer.spec.ts` падает на резолве `./ui/EditAccountDrawer.vue`; в `AccountDetailPage.spec.ts` падают тесты edit-flow (`EditAccountDrawer` не найден).

- [ ] **Step 3: Write minimal implementation**

Создать `frontend/src/features/edit-account/ui/EditAccountDrawer.vue`:

```vue
<script setup lang="ts">
import { computed, nextTick, watch } from 'vue';
import {
  UOverlay,
  UInput,
  UButton,
  UIconSelector,
  UColorPicker,
  IconBadge,
} from '@/shared/ui';
import {
  AccountTypeSelector,
  AccountTypeFields,
  ACCOUNT_ICONS,
  getAccountTypeLabel,
} from '@/entities/account';
import { ENTITY_COLORS } from '@/shared/config/colors';
import { formatCurrency, getCurrencySymbol } from '@/shared/lib/format/currency';
import type { Account, AccountWithBalances } from '@/shared/api/database.types';
import { useEditAccountForm } from '../model/useEditAccountForm';

const props = defineProps<{
  modelValue: boolean;
  account: AccountWithBalances | null;
  isUpdating?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [updates: Partial<Account>, debtByCurrency?: Record<string, number>];
}>();

const {
  formData,
  debtByCurrency,
  isValid,
  isDirty,
  nameError,
  isConverting,
  updateField,
  setDebt,
  reset,
  buildUpdates,
} = useEditAccountForm(() => props.account);

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

watch(open, (isOpen) => {
  if (!isOpen) nextTick(() => reset());
});

const balances = computed(() => props.account?.balances ?? []);
const primaryBalance = computed(() => balances.value[0] ?? null);

const previewName = computed(() => formData.value.name.trim() || 'Без названия');
const previewIsPlaceholder = computed(() => formData.value.name.trim().length === 0);

const conversionHint = computed(() => {
  const b = primaryBalance.value;
  if (!b) return '';
  return `На счёте ${formatCurrency(b.balance, b.currency)}. Если это доступный остаток по карте, долг = лимит − остаток.`;
});

/** Что случится с балансом первой валюты после сохранения — только если цель отличается. */
const conversionOutcome = computed(() => {
  const b = primaryBalance.value;
  if (!b) return null;
  const target = -(debtByCurrency.value[b.currency] ?? 0);
  if (Math.abs(target - b.balance) <= 0.001) return null;
  return `Баланс станет ${formatCurrency(target, b.currency)}, разница запишется корректировкой`;
});

function handleSubmit() {
  if (!isValid.value || !isDirty.value) return;
  emit('confirm', buildUpdates(), isConverting.value ? { ...debtByCurrency.value } : undefined);
}
</script>

<template>
  <UOverlay v-model="open" title="Редактировать счёт" desktop="panel">
    <div v-if="account" class="space-y-5" data-testid="edit-account-form">
      <!-- Живой предпросмотр: цвет и иконка видны в контексте строки счёта -->
      <div
        data-testid="account-preview"
        class="flex items-center gap-3 rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-3"
      >
        <IconBadge :icon="formData.icon" :color="formData.color" size="lg" />
        <div class="min-w-0">
          <p
            class="text-sm font-medium truncate"
            :class="
              previewIsPlaceholder
                ? 'text-text-tertiary-light dark:text-text-tertiary-dark'
                : 'text-text-primary-light dark:text-text-primary-dark'
            "
          >
            {{ previewName }}
          </p>
          <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark truncate">
            {{ getAccountTypeLabel(formData.type) }}
          </p>
        </div>
      </div>

      <!-- Название -->
      <UInput
        data-testid="account-name-input"
        :model-value="formData.name"
        label="Название"
        placeholder="Наличные, Карта..."
        :error="nameError ?? undefined"
        @update:model-value="updateField('name', String($event))"
      />

      <!-- Тип -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
          Тип счёта
        </label>
        <AccountTypeSelector
          :model-value="formData.type"
          @update:model-value="updateField('type', $event)"
        />
      </div>

      <!-- Поля типа (у поля лимита внутри есть data-testid="credit-limit-input") -->
      <AccountTypeFields
        :type="formData.type"
        :fields="formData"
        @update:field="(key, value) => updateField(key as never, value as never)"
      />

      <!-- Конвертация в кредитку -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        leave-active-class="transition-all duration-150 ease-in"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div
          v-if="isConverting"
          data-testid="conversion-block"
          class="space-y-3 rounded-xl border border-border-light dark:border-border-dark p-3"
        >
          <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            Задолженность сейчас
          </p>

          <div
            v-for="balance in balances"
            :key="balance.currency"
            :data-testid="`debt-input-${balance.currency}`"
          >
            <UInput
              :model-value="
                debtByCurrency[balance.currency] != null
                  ? String(debtByCurrency[balance.currency])
                  : ''
              "
              type="number"
              variant="currency"
              :suffix="getCurrencySymbol(balance.currency)"
              :label="balances.length > 1 ? balance.currency : undefined"
              placeholder="0"
              @update:model-value="setDebt(balance.currency, Number($event) || 0)"
            />
          </div>

          <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
            {{ conversionHint }}
          </p>
          <p v-if="conversionOutcome" class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            {{ conversionOutcome }}
          </p>
        </div>
      </Transition>

      <!-- Иконка и цвет -->
      <UIconSelector
        :model-value="formData.icon"
        :icons="ACCOUNT_ICONS"
        :color="formData.color"
        label="Иконка"
        @update:model-value="updateField('icon', $event)"
      />
      <UColorPicker
        :model-value="formData.color"
        :colors="ENTITY_COLORS"
        label="Цвет"
        @update:model-value="updateField('color', $event)"
      />
    </div>

    <template #footer>
      <UButton
        data-testid="save-btn"
        variant="primary"
        size="xl"
        full-width
        :loading="isUpdating"
        :disabled="!isValid || !isDirty"
        @click="handleSubmit"
      >
        Сохранить
      </UButton>
    </template>
  </UOverlay>
</template>
```


Удалить файлы:
```bash
git rm frontend/src/features/edit-account/ui/EditAccountModal.vue frontend/src/features/edit-account/EditAccountModal.spec.ts
```

`frontend/src/features/edit-account/index.ts` строка 1:
```ts
export { default as EditAccountDrawer } from './ui/EditAccountDrawer.vue';
```

В `frontend/src/pages/accounts/AccountDetailPage.vue`:
1. Строка 20:
```ts
import { EditAccountDrawer, DeleteAccountModal, useEditAccount } from '@/features/edit-account';
```
2. Строки 116–122:
```ts
async function handleUpdateAccount(
  updates: Partial<Account>,
  debtByCurrency?: Record<string, number>,
) {
  if (!account.value) return;
  const success = await updateAccountFn(account.value.id, updates, { debtByCurrency });
  if (success) {
    showEditAccountModal.value = false;
  }
}
```
3. Строки 579–584:
```vue
    <!-- Edit Account Drawer -->
    <EditAccountDrawer
      v-model="showEditAccountModal"
      :account="account"
      :is-updating="isUpdatingAccount"
      @confirm="handleUpdateAccount"
    />
```

В `frontend/src/pages/accounts/model/useAccountsPage.ts` строки 133–140:
```ts
  async function handleUpdateAccount(
    updates: Partial<Account>,
    debtByCurrency?: Record<string, number>,
  ) {
    if (!selectedAccount.value) return false;
    const success = await updateAccountFn(selectedAccount.value.id, updates, { debtByCurrency });
    if (success) {
      showEditAccountModal.value = false;
    }
    return success;
  }
```

В `frontend/src/pages/accounts/desktop/AccountsDesktopPage.vue`:
1. Строка 7:
```ts
import { EditAccountDrawer, DeleteAccountModal } from '@/features/edit-account';
```
2. Строки 170–176:
```vue
  <!-- Edit Account Drawer -->
  <EditAccountDrawer
    v-model="showEditAccountModal"
    :account="selectedAccount"
    :is-updating="isUpdatingAccount"
    @confirm="handleUpdateAccount"
  />
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && bun run test -- src/features/edit-account src/pages/accounts
```
Ожидание: все спеки `features/edit-account` и `pages/accounts` зелёные, `EditAccountModal.spec.ts` больше не существует.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/features/edit-account frontend/src/pages/accounts && git commit -m "feat(accounts): редактирование счёта переехало в шторку с предпросмотром и конвертацией"
```

---

## Task 9: Кредитка в демо-данных

**Files:**
- Modify: `frontend/src/features/demo-mode/model/demoDataGenerator.ts` (строки 282–298 — массив `accounts`)
- Create: `frontend/src/features/demo-mode/demoDataGenerator.spec.ts`
- Modify: `backend/src/modules/identity/application/services/demo-initialization.service.ts` (строки 216–231 — `accountsData`)
- Modify: `backend/src/i18n/ru/demo.json` (блок `accounts`), `backend/src/i18n/en/demo.json` (блок `accounts`)
- Test: `backend/src/modules/identity/application/services/demo-initialization.service.spec.ts` (строки 14–17 — `RU_TRANSLATIONS`; тест на строках ~125–130)

**Interfaces:**

Consumes:
- `DemoAccountData` из `frontend/src/features/demo-mode/model/demoDataGenerator.ts` — уже содержит опциональные `creditLimit`, `gracePeriodDays`, `billingDay`, `monthlyPayment`.
- `AccountTypeFields` из `backend/src/modules/accounting/domain/aggregates/account` — `{ creditLimit?, gracePeriodDays?, billingDay?, totalAmount?, interestRate?, monthlyPayment?, startDate?, endDate?, maturityDate?, isReplenishable?, isWithdrawable? }`.
- `Account.create(id, userId, name, icon, color, type, order, initialBalances, typeFields?)` — уже так вызывается в цикле сервиса.
- `this.t(key, lang)` внутри сервиса → `I18nService.translate(key, { lang })`.

Produces: третий демо-счёт — `name = demo.accounts.creditCard`, `icon: 'credit_card'`, `color: '#f97316'`, `type: 'credit_card'`, баланс `UZS −2 350 000`, `creditLimit: 10 000 000`, `monthlyPayment: 500 000`, `gracePeriodDays: 55`, `billingDay: 5`. Демо-транзакции ссылаются на счета по `accountIndex` 0 и 1 — третий счёт остаётся без транзакций.

- [ ] **Step 1: Write the failing test**

Создать `frontend/src/features/demo-mode/demoDataGenerator.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateDemoData } from './model/demoDataGenerator';

describe('generateDemoData — кредитная карта', () => {
  it('добавляет третий счёт — кредитку', () => {
    const { accounts } = generateDemoData();
    expect(accounts).toHaveLength(3);
    const card = accounts[2];
    expect(card.type).toBe('credit_card');
    expect(card.name).toBe('Кредитная карта');
    expect(card.icon).toBe('credit_card');
    expect(card.color).toBe('#f97316');
  });

  it('кредитка идёт с долгом и параметрами', () => {
    const card = generateDemoData().accounts[2];
    expect(card.balances).toEqual([{ currency: 'UZS', balance: -2_350_000 }]);
    expect(card.creditLimit).toBe(10_000_000);
    expect(card.monthlyPayment).toBe(500_000);
    expect(card.gracePeriodDays).toBe(55);
    expect(card.billingDay).toBe(5);
  });

  it('демо-транзакции не вешаются на кредитку', () => {
    const { transactions } = generateDemoData();
    expect(transactions.every((t) => t.accountIndex < 2)).toBe(true);
  });
});
```

В `backend/src/modules/identity/application/services/demo-initialization.service.spec.ts`:
- в `RU_TRANSLATIONS` после `'demo.accounts.savings'` добавить `'demo.accounts.creditCard': 'Кредитная карта',`
- заменить тест на строках ~125–130 на:

```ts
  it('should call i18n.translate for all three demo account names', async () => {
    await service.initializeDemoData(mockProfile);

    expect(mockI18n.translate).toHaveBeenCalledWith('demo.accounts.main', { lang: 'ru' });
    expect(mockI18n.translate).toHaveBeenCalledWith('demo.accounts.savings', { lang: 'ru' });
    expect(mockI18n.translate).toHaveBeenCalledWith('demo.accounts.creditCard', { lang: 'ru' });
  });

  it('creates the demo credit card with its limit and payment fields', async () => {
    await service.initializeDemoData(mockProfile);

    const saved = mockAccountRepo.save.mock.calls.map(([a]: [AnyObject]) => a);
    const card = saved.find((a: AnyObject) => a.type?.value === 'credit_card' || a.type === 'credit_card');
    expect(card).toBeDefined();
    expect(card.creditLimit).toBe(10_000_000);
    expect(card.monthlyPayment).toBe(500_000);
    expect(card.gracePeriodDays).toBe(55);
    expect(card.billingDay).toBe(5);
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && bun run test -- src/features/demo-mode/demoDataGenerator.spec.ts
cd ../backend && bun run test -- demo-initialization.service.spec.ts
```
Ожидание: фронт падает на `expected [ …2 items ] to have a length of 3`; бэкенд падает на `demo.accounts.creditCard` (`translate` не вызывался) и на отсутствующей кредитке среди сохранённых счетов.

- [ ] **Step 3: Write minimal implementation**

В `frontend/src/features/demo-mode/model/demoDataGenerator.ts` в массив `accounts` третьим элементом добавить:

```ts
      {
        name: 'Кредитная карта',
        icon: 'credit_card',
        color: '#f97316',
        type: 'credit_card',
        balances: [{ currency: 'UZS', balance: -2350000 }],
        creditLimit: 10000000,
        monthlyPayment: 500000,
        gracePeriodDays: 55,
        billingDay: 5,
      },
```

В `backend/src/i18n/ru/demo.json` блок `accounts`:
```json
  "accounts": {
    "main": "Основной",
    "savings": "Накопительный",
    "creditCard": "Кредитная карта"
  },
```

В `backend/src/i18n/en/demo.json` блок `accounts`:
```json
  "accounts": {
    "main": "Main",
    "savings": "Savings",
    "creditCard": "Credit card"
  },
```

В `backend/src/modules/identity/application/services/demo-initialization.service.ts` в `accountsData` третьим элементом добавить:

```ts
      {
        name: this.t('demo.accounts.creditCard', lang),
        icon: 'credit_card',
        color: '#f97316',
        type: 'credit_card',
        balances: [{ currency: 'UZS', balance: -2350000 }],
        typeFields: {
          creditLimit: 10000000,
          monthlyPayment: 500000,
          gracePeriodDays: 55,
          billingDay: 5,
        },
      },
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && bun run test -- src/features/demo-mode
cd ../backend && bun run test -- demo-initialization.service.spec.ts
```
Ожидание: обе спеки зелёные.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/demo-mode/model/demoDataGenerator.ts frontend/src/features/demo-mode/demoDataGenerator.spec.ts backend/src/i18n/ru/demo.json backend/src/i18n/en/demo.json backend/src/modules/identity/application/services/demo-initialization.service.ts backend/src/modules/identity/application/services/demo-initialization.service.spec.ts && git commit -m "feat(demo): третий демо-счёт — кредитная карта с лимитом и минимальным платежом"
```

---

## Task 10: Changelog 1.0.86 и финальная проверка

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts` (строка 1 — `CURRENT_VERSION`; строка 29 — начало `CHANGELOG_ENTRIES`)
- Test: `frontend/src/features/changelog/useChangelog.spec.ts`

**Interfaces:**

Consumes:
```ts
export const CURRENT_VERSION: string;
export interface ChangelogItem { type: 'feature' | 'fix' | 'improvement'; text: string }
export interface ChangelogEntry { version: string; date: string; title: string; items: ChangelogItem[] }
export const CHANGELOG_ENTRIES: ChangelogEntry[]; // новая запись — первым элементом
```
`useChangelog.spec.ts` уже проверяет `latestEntry.value?.version === CURRENT_VERSION` и `latestEntry.value === CHANGELOG_ENTRIES[0]` — новая запись обязана быть сверху.

- [ ] **Step 1: Write the failing test**

В `frontend/src/features/changelog/useChangelog.spec.ts` в describe про `latestEntry` добавить:

```ts
    it('точка входа релиза — 1.0.86 с записью про кредитную карту', () => {
      expect(CURRENT_VERSION).toBe('1.0.86');
      expect(CHANGELOG_ENTRIES[0].version).toBe('1.0.86');
      expect(CHANGELOG_ENTRIES[0].date).toBe('2026-09-04');
      expect(CHANGELOG_ENTRIES[0].items[0].type).toBe('feature');
      expect(CHANGELOG_ENTRIES[0].items[0].text).toContain('Кредитная карта');
    });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && bun run test -- src/features/changelog/useChangelog.spec.ts
```
Ожидание: `expected '1.0.85' to be '1.0.86'`.

- [ ] **Step 3: Write minimal implementation**

В `frontend/src/features/changelog/model/changelogData.ts` строка 1:

```ts
export const CURRENT_VERSION = '1.0.86';
```

и первым элементом `CHANGELOG_ENTRIES`:

```ts
  {
    version: '1.0.86',
    date: '2026-09-04',
    title: 'Кредитная карта',
    items: [
      {
        type: 'feature',
        text: 'Кредитная карта: лимит, долг и доступный остаток; обычный счёт можно превратить в кредитку; редактирование счёта — в шторке.',
      },
    ],
  },
```

- [ ] **Step 4: Run test to verify it passes**

Полный прогон обеих половин репозитория:

```bash
cd frontend && bun run test
cd ../backend && bun run test
cd ../frontend && bun run lint
cd ../backend && bun run lint
cd ../frontend && bun run build && bun run check:bundle && bun run check:cache
cd ../backend && bun run build
```
Ожидание: vitest и jest зелёные, `eslint --fix` без ошибок, `vue-tsc -b && vite build` и `nest build` проходят, сторожи бандла и рантайм-кэша не ругаются.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/changelog/model/changelogData.ts frontend/src/features/changelog/useChangelog.spec.ts && git commit -m "chore(changelog): 1.0.86 — кредитная карта"
```

---

## Проверка покрытия спеки

| Пункт спеки | Задача |
|---|---|
| §2 соглашение о балансе, лимит в первой валюте | Task 1 (`getCreditCardState`), Task 4 (первая валюта + остальные строкой) |
| §2 `monthly_payment` как «Минимальный платёж» | Task 3, Task 4 |
| §2 чистый итог | Task 6 |
| §2 конвертация через корректировку, порядок PATCH → adjust | Task 7 |
| §2 шторка вместо `UModal` | Task 8 |
| §3 `model/creditCard.ts`, `VISIBLE_ACCOUNT_TYPES`, `ACCOUNT_TYPE_ICONS` | Task 1 |
| §4.1 `CreditCardSummary` | Task 4 |
| §4.2 `AccountCard` | Task 5 |
| §4.3 итог на странице счетов | Task 6 |
| §4.4 `AccountTypeSelector` | Task 2 |
| §4.5 поля кредитки | Task 3 |
| §4.6 `EditAccountDrawer` | Task 8 |
| §4.7 `useEditAccountForm` / `useEditAccount` | Task 7 |
| §4.8 форма создания через селектор | Task 2 |
| §5 аналитика | Task 6 |
| §5 демо (фронт + бэк + локали) | Task 9 |
| §6 тесты | по одному в каждой задаче |
| §7 changelog 1.0.86 | Task 10 |
