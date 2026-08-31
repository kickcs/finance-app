# Чеклист-редизайн ImportConfirmPage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить форму создания транзакции на странице подтверждения импорта компактной сводкой-чеклистом (~520px, один экран TMA), редактирование полей — по тапу через шторки.

**Architecture:** Логика страницы (prefill, retry-bookkeeping, submit, split, погашение долгов) не меняется — переписывается только представление. Новые презентационные компоненты: `ReviewFieldRow`, `TypeSheet`, `CommentSheet` (локальные для страницы) и `AccountPickerSheet` (entities/account). Для типа «Перевод» встраивается существующий `TransferPanel` целиком. Спека: `docs/superpowers/specs/2026-07-19-import-confirm-checklist-redesign-design.md`.

**Tech Stack:** Vue 3 `<script setup>` + TS, Tailwind v4 (семантические токены), vaul-vue шторки, vitest.

## Global Constraints

- **НЕ делать git-коммиты** — пользователь коммитит сам (правило: no commits without explicit request).
- Рабочая директория фронтенда: `frontend/` (все команды `bun run ...` — из неё).
- Только семантические токены (`bg-card-light dark:bg-card-dark` и т.п.), не сырые цвета Tailwind.
- Иконки — `<UIcon name="...">`; если имени нет в `src/shared/ui/icon/iconMap.ts`, добавить маппинг на Lucide.
- Тексты UI — на русском, sentence case.
- Существующие тесты (`debtRepayment.spec.ts`, `useScrollableTabs`, `useDrawerKeyboard.spec.ts`) должны остаться зелёными.
- Проверка после изменений: `bun run build` (vue-tsc + vite) и `bunx vitest run <файлы>`.

---

### Task 1: Модель видимости строк `reviewRows`

**Files:**
- Create: `frontend/src/pages/import-inbox/model/reviewRows.ts`
- Test: `frontend/src/pages/import-inbox/model/reviewRows.spec.ts`

**Interfaces:**
- Produces: `reviewRows(type: TransactionFormData['type']): ReviewRowsVisibility`, где `ReviewRowsVisibility = { account: boolean; category: boolean; transferPanel: boolean; split: boolean }`. Используется в Task 5.

- [ ] **Step 1: Написать падающий тест**

```ts
// frontend/src/pages/import-inbox/model/reviewRows.spec.ts
import { describe, it, expect } from 'vitest';
import { reviewRows } from './reviewRows';

describe('reviewRows', () => {
  it('expense → счёт+категория+split, без TransferPanel', () => {
    expect(reviewRows('expense')).toEqual({
      account: true,
      category: true,
      transferPanel: false,
      split: true,
    });
  });

  it('income → счёт+категория, без split и TransferPanel', () => {
    expect(reviewRows('income')).toEqual({
      account: true,
      category: true,
      transferPanel: false,
      split: false,
    });
  });

  it('transfer → только TransferPanel', () => {
    expect(reviewRows('transfer')).toEqual({
      account: false,
      category: false,
      transferPanel: true,
      split: false,
    });
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `cd frontend && bunx vitest run src/pages/import-inbox/model/reviewRows.spec.ts`
Expected: FAIL — модуль `./reviewRows` не найден.

- [ ] **Step 3: Минимальная реализация**

```ts
// frontend/src/pages/import-inbox/model/reviewRows.ts
import type { TransactionFormData } from '@/features/add-transaction';

export interface ReviewRowsVisibility {
  /** Строка «Счёт» (расход/доход; у перевода счета внутри TransferPanel). */
  account: boolean;
  /** Строка «Категория» (у перевода категория фиксированная). */
  category: boolean;
  /** Вместо HeroAmount и строк счёта/категории — TransferPanel целиком. */
  transferPanel: boolean;
  /** Чип «Разделить» — только для расхода. */
  split: boolean;
}

/** Какие строки чеклиста показывать для данного типа операции. */
export function reviewRows(type: TransactionFormData['type']): ReviewRowsVisibility {
  const transfer = type === 'transfer';
  return {
    account: !transfer,
    category: !transfer,
    transferPanel: transfer,
    split: type === 'expense',
  };
}
```

- [ ] **Step 4: Тест зелёный**

Run: `cd frontend && bunx vitest run src/pages/import-inbox/model/reviewRows.spec.ts`
Expected: PASS (3 теста).

---

### Task 2: Экспорт внутренностей add-transaction для страницы

**Files:**
- Modify: `frontend/src/features/add-transaction/index.ts`

**Interfaces:**
- Produces: публичные экспорты `HeroAmount`, `TransferPanel`, `usePanelState`, `useHashtagSuggestions` из `@/features/add-transaction`. Используются в Task 4 и Task 5.

- [ ] **Step 1: Добавить экспорты**

К текущему содержимому `frontend/src/features/add-transaction/index.ts` добавить:

```ts
export { default as HeroAmount } from './ui/HeroAmount.vue';
export { default as TransferPanel } from './ui/TransferPanel.vue';
export { usePanelState } from './model/usePanelState';
export { useHashtagSuggestions } from './model/useHashtagSuggestions';
```

- [ ] **Step 2: Проверка типов**

Run: `cd frontend && bun run build`
Expected: сборка проходит без ошибок.

---

### Task 3: `AccountPickerSheet` (entities/account)

**Files:**
- Create: `frontend/src/entities/account/ui/AccountPickerSheet.vue`
- Modify: `frontend/src/entities/account/index.ts` (экспорт)

**Interfaces:**
- Consumes: `AccountWithBalances` из `entities/account`, `formatCurrency` из `shared/lib/format/currency`.
- Produces: компонент `AccountPickerSheet` с пропами `{ open: boolean; accounts: AccountWithBalances[]; selectedId: string | null; title?: string }` и эмитами `'update:open': [boolean]`, `select: [accountId: string]`. Используется в Task 5.

- [ ] **Step 1: Создать компонент**

Скелет шторки скопировать с `frontend/src/pages/import-inbox/confirm/DebtRepaymentSheet.vue` (та же структура DrawerRoot/Portal/Overlay/Content/Handle/Title, desktop → right, mobile → bottom, `max-h-[70dvh]`):

```vue
<!-- frontend/src/entities/account/ui/AccountPickerSheet.vue -->
<script setup lang="ts">
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UIcon } from '@/shared/ui';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { formatCurrency } from '@/shared/lib/format/currency';
import type { AccountWithBalances } from '../model/types';

withDefaults(
  defineProps<{
    open: boolean;
    accounts: AccountWithBalances[];
    selectedId: string | null;
    title?: string;
  }>(),
  { title: 'Выберите счёт' },
);

const emit = defineEmits<{
  'update:open': [value: boolean];
  select: [accountId: string];
}>();

const isDesktop = useIsDesktop();

function pick(accountId: string) {
  emit('select', accountId);
  emit('update:open', false);
}
</script>

<template>
  <DrawerRoot
    :open="open"
    :direction="isDesktop ? 'right' : 'bottom'"
    @update:open="emit('update:open', $event)"
  >
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-50 bg-black/40" />
      <DrawerContent
        class="fixed z-50 flex flex-col bg-card-light dark:bg-card-dark"
        :class="
          isDesktop
            ? 'top-0 right-0 bottom-0 w-[420px] rounded-l-2xl border-l border-border-light dark:border-border-dark'
            : 'bottom-0 left-0 right-0 rounded-t-2xl border-t border-border-light dark:border-border-dark max-h-[70dvh]'
        "
      >
        <div v-if="!isDesktop" class="flex justify-center pt-3 pb-1">
          <DrawerHandle class="w-10 h-1 rounded-full bg-border-light dark:bg-border-dark" />
        </div>

        <div class="px-5 pb-3" :class="{ 'pt-4': isDesktop }">
          <div class="flex items-center justify-between">
            <DrawerTitle
              class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
            >
              {{ title }}
            </DrawerTitle>
            <button
              type="button"
              aria-label="Закрыть"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
              @click="emit('update:open', false)"
            >
              <UIcon name="close" size="sm" />
            </button>
          </div>
        </div>

        <div
          class="flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] overscroll-contain"
          data-vaul-no-drag
        >
          <p
            v-if="accounts.length === 0"
            class="py-8 text-center text-sm text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            Нет доступных счетов
          </p>
          <button
            v-for="account in accounts"
            :key="account.id"
            type="button"
            class="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors text-left"
            :class="
              account.id === selectedId
                ? 'bg-primary/10'
                : 'hover:bg-surface-light dark:hover:bg-surface-dark'
            "
            @click="pick(account.id)"
          >
            <span
              class="w-3 h-3 rounded-full shrink-0"
              :style="{ backgroundColor: account.color }"
            />
            <div class="flex-1 min-w-0">
              <p
                class="text-sm font-medium truncate"
                :class="
                  account.id === selectedId
                    ? 'text-primary'
                    : 'text-text-primary-light dark:text-text-primary-dark'
                "
              >
                {{ account.name }}
              </p>
            </div>
            <span class="text-xs tabular-nums text-text-tertiary-light dark:text-text-tertiary-dark">
              {{
                formatCurrency(
                  account.balances[0]?.balance ?? 0,
                  account.balances[0]?.currency ?? '',
                )
              }}
              <template v-if="account.balances.length > 1">
                +{{ account.balances.length - 1 }}
              </template>
            </span>
          </button>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
```

- [ ] **Step 2: Экспорт**

В `frontend/src/entities/account/index.ts` добавить строку:

```ts
export { default as AccountPickerSheet } from './ui/AccountPickerSheet.vue';
```

- [ ] **Step 3: Проверка типов**

Run: `cd frontend && bun run build`
Expected: сборка проходит.

---

### Task 4: Локальные компоненты страницы — `ReviewFieldRow`, `TypeSheet`, `CommentSheet`

**Files:**
- Create: `frontend/src/pages/import-inbox/confirm/ReviewFieldRow.vue`
- Create: `frontend/src/pages/import-inbox/confirm/TypeSheet.vue`
- Create: `frontend/src/pages/import-inbox/confirm/CommentSheet.vue`

**Interfaces:**
- Consumes: `useDrawerKeyboard` (`shared/lib/composables`), `useHashtagSuggestions` (Task 2), тип `Hashtag` из `@/entities/transaction`.
- Produces (используется в Task 5):
  - `ReviewFieldRow`: пропы `{ icon: string; label: string; value?: string | null; placeholder?: string }`, без эмитов (клик всплывает с корневой кнопки; attrs fallthrough — можно вешать `@click` и оборачивать в `PopoverTrigger as-child`).
  - `TypeSheet`: пропы `{ open: boolean; modelValue: 'expense' | 'income' | 'transfer' }`, эмиты `'update:open': [boolean]`, `'update:modelValue': ['expense' | 'income' | 'transfer']`.
  - `CommentSheet`: пропы `{ open: boolean; modelValue: string; hashtags: Hashtag[] }`, эмиты `'update:open': [boolean]`, `'update:modelValue': [string]` (эмитится по кнопке «Сохранить»).

- [ ] **Step 1: ReviewFieldRow**

```vue
<!-- frontend/src/pages/import-inbox/confirm/ReviewFieldRow.vue -->
<script setup lang="ts">
import { UIcon } from '@/shared/ui';

withDefaults(
  defineProps<{
    icon: string;
    label: string;
    value?: string | null;
    placeholder?: string;
  }>(),
  { value: null, placeholder: 'Выбрать' },
);
</script>

<template>
  <button
    type="button"
    class="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-surface-light dark:active:bg-surface-dark transition-colors"
  >
    <UIcon
      :name="icon"
      size="sm"
      class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
    />
    <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark shrink-0">
      {{ label }}
    </span>
    <span class="flex-1 min-w-0 text-right">
      <slot>
        <span
          class="text-sm truncate block"
          :class="
            value
              ? 'font-medium text-text-primary-light dark:text-text-primary-dark'
              : 'text-text-tertiary-light dark:text-text-tertiary-dark'
          "
        >
          {{ value || placeholder }}
        </span>
      </slot>
    </span>
    <UIcon
      name="chevron_right"
      size="sm"
      class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
    />
  </button>
</template>
```

- [ ] **Step 2: TypeSheet**

Иконки: проверить в `src/shared/ui/icon/iconMap.ts` наличие `trending_down`, `trending_up`, `swap_horiz` — при отсутствии добавить маппинги (Lucide: `TrendingDown`, `TrendingUp`, `ArrowLeftRight`).

```vue
<!-- frontend/src/pages/import-inbox/confirm/TypeSheet.vue -->
<script setup lang="ts">
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UIcon, IconBadge } from '@/shared/ui';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';

type ReviewType = 'expense' | 'income' | 'transfer';

defineProps<{
  open: boolean;
  modelValue: ReviewType;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  'update:modelValue': [value: ReviewType];
}>();

const isDesktop = useIsDesktop();

const OPTIONS: { type: ReviewType; label: string; icon: string; color: string }[] = [
  { type: 'expense', label: 'Расход', icon: 'trending_down', color: '#ef4444' },
  { type: 'income', label: 'Доход', icon: 'trending_up', color: '#22c55e' },
  { type: 'transfer', label: 'Перевод', icon: 'swap_horiz', color: '#4f46e5' },
];

function pick(type: ReviewType) {
  emit('update:modelValue', type);
  emit('update:open', false);
}
</script>

<template>
  <DrawerRoot
    :open="open"
    :direction="isDesktop ? 'right' : 'bottom'"
    @update:open="emit('update:open', $event)"
  >
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-50 bg-black/40" />
      <DrawerContent
        class="fixed z-50 flex flex-col bg-card-light dark:bg-card-dark"
        :class="
          isDesktop
            ? 'top-0 right-0 bottom-0 w-[420px] rounded-l-2xl border-l border-border-light dark:border-border-dark'
            : 'bottom-0 left-0 right-0 rounded-t-2xl border-t border-border-light dark:border-border-dark'
        "
      >
        <div v-if="!isDesktop" class="flex justify-center pt-3 pb-1">
          <DrawerHandle class="w-10 h-1 rounded-full bg-border-light dark:bg-border-dark" />
        </div>

        <div class="px-5 pb-2" :class="{ 'pt-4': isDesktop }">
          <DrawerTitle
            class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
          >
            Тип операции
          </DrawerTitle>
        </div>

        <div class="px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            v-for="option in OPTIONS"
            :key="option.type"
            type="button"
            class="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors text-left"
            :class="
              option.type === modelValue
                ? 'bg-primary/10'
                : 'hover:bg-surface-light dark:hover:bg-surface-dark'
            "
            @click="pick(option.type)"
          >
            <IconBadge :icon="option.icon" :color="option.color" />
            <span
              class="flex-1 text-sm font-medium"
              :class="
                option.type === modelValue
                  ? 'text-primary'
                  : 'text-text-primary-light dark:text-text-primary-dark'
              "
            >
              {{ option.label }}
            </span>
            <UIcon v-if="option.type === modelValue" name="check" size="sm" class="text-primary" />
          </button>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
```

- [ ] **Step 3: CommentSheet**

Перед написанием прочитать `frontend/src/entities/category/ui/CategoryPickerSheet.vue` — как там подключён `useDrawerKeyboard` (refs + setup/cleanup) — и повторить тот же паттерн.

```vue
<!-- frontend/src/pages/import-inbox/confirm/CommentSheet.vue -->
<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UInput, UButton, UIcon } from '@/shared/ui';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { useDrawerKeyboard } from '@/shared/lib/composables/useDrawerKeyboard';
import { useHashtagSuggestions } from '@/features/add-transaction';
import type { Hashtag } from '@/entities/transaction';

const props = defineProps<{
  open: boolean;
  modelValue: string;
  hashtags: Hashtag[];
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  'update:modelValue': [value: string];
}>();

const isDesktop = useIsDesktop();

// Черновик: применяется только по «Сохранить», закрытие свайпом не портит значение.
const draft = ref(props.modelValue);

const inputWrapRef = ref<HTMLDivElement | null>(null);

const { filtered, buildInsertedDescription } = useHashtagSuggestions(
  () => draft.value,
  () => props.hashtags,
);

function insertHashtag(tag: string) {
  draft.value = buildInsertedDescription(tag);
}

function save() {
  emit('update:modelValue', draft.value.trim());
  emit('update:open', false);
}

const drawerContentRef = ref<{ $el?: HTMLElement } | null>(null);
const footerRef = ref<HTMLDivElement | null>(null);
const scrollRef = ref<HTMLDivElement | null>(null);
const { setupKeyboardListener, cleanupKeyboardListener } = useDrawerKeyboard(
  drawerContentRef,
  footerRef,
  scrollRef,
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      draft.value = props.modelValue;
      nextTick(() => {
        setupKeyboardListener();
        inputWrapRef.value?.querySelector('input')?.focus();
      });
    } else {
      cleanupKeyboardListener();
    }
  },
);
</script>

<template>
  <DrawerRoot
    :open="open"
    :direction="isDesktop ? 'right' : 'bottom'"
    @update:open="emit('update:open', $event)"
  >
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-50 bg-black/40" />
      <DrawerContent
        ref="drawerContentRef"
        class="fixed z-50 flex flex-col bg-card-light dark:bg-card-dark"
        :class="
          isDesktop
            ? 'top-0 right-0 bottom-0 w-[420px] rounded-l-2xl border-l border-border-light dark:border-border-dark'
            : 'bottom-0 left-0 right-0 rounded-t-2xl border-t border-border-light dark:border-border-dark'
        "
      >
        <div v-if="!isDesktop" class="flex justify-center pt-3 pb-1">
          <DrawerHandle class="w-10 h-1 rounded-full bg-border-light dark:bg-border-dark" />
        </div>

        <div class="px-5 pb-2" :class="{ 'pt-4': isDesktop }">
          <div class="flex items-center justify-between">
            <DrawerTitle
              class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
            >
              Комментарий
            </DrawerTitle>
            <button
              type="button"
              aria-label="Закрыть"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
              @click="emit('update:open', false)"
            >
              <UIcon name="close" size="sm" />
            </button>
          </div>
        </div>

        <div ref="scrollRef" class="px-5 space-y-3" data-vaul-no-drag>
          <div ref="inputWrapRef">
            <UInput
              :model-value="draft"
              placeholder="#продукты, #кафе, #такси..."
              @update:model-value="draft = $event as string"
              @keydown.enter.prevent="save"
            />
          </div>

          <div v-if="filtered.length > 0" class="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button
              v-for="h in filtered"
              :key="h.tag"
              type="button"
              class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark active:scale-95 transition-all"
              @mousedown.prevent="insertHashtag(h.tag)"
            >
              {{ h.tag }}
            </button>
          </div>
        </div>

        <div ref="footerRef" class="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <UButton variant="primary" size="md" full-width @click="save">Сохранить</UButton>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
```

Примечание: `DrawerContent` — компонент, поэтому ref типизирован как `{ $el?: HTMLElement }` (так же, как в существующих шторках с `useDrawerKeyboard`).

- [ ] **Step 4: Проверка типов**

Run: `cd frontend && bun run build`
Expected: сборка проходит (компоненты ещё не используются — допустимы предупреждения об unused, ошибок быть не должно).

---

### Task 5: Переписать `ImportConfirmPage.vue`

**Files:**
- Modify: `frontend/src/pages/import-inbox/confirm/ImportConfirmPage.vue`

**Interfaces:**
- Consumes: всё из Task 1–4 + существующие `HeroAmount`, `TransferPanel`, `usePanelState`, `CategoryPickerSheet` (`@/entities/category`), `SplitExpenseDrawer` (`@/features/split-expense/ui/SplitExpenseDrawer.vue` — импортировать так же, как в `ExpensePanel.vue`: `defineAsyncComponent`), `Popover/PopoverTrigger/PopoverContent` + `Calendar` (как в `TransactionForm.vue`), `useHashtags` из `@/entities/transaction`.
- Produces: конечная страница. **Вся существующая логика `<script setup>` сохраняется** (prefill-watch'и, `handleSubmit`, `repayGroup`, `computeNext`/`goTo`, retry-bookkeeping, `toScanReceipt`, `handleDismiss`) — меняются импорты, добавляются UI-стейты и заменяется `<template>`.

- [ ] **Step 1: Обновить импорты и добавить UI-стейт в `<script setup>`**

Удалить импорты: `TransactionForm` (из `@/features/add-transaction` остаются `useTransactionForm`, `useSubmitTransaction`), `IconBadge` (если больше не используется в шаблоне).

Добавить импорты:

```ts
import { defineAsyncComponent } from 'vue'; // добавить к существующему import from 'vue'
import {
  useTransactionForm,
  useSubmitTransaction,
  HeroAmount,
  TransferPanel,
  usePanelState,
} from '@/features/add-transaction';
import type { TransactionFormData } from '@/features/add-transaction';
import { CategoryPickerSheet, CATEGORY_IDS } from '@/entities/category';
import { AccountPickerSheet } from '@/entities/account';
import { useHashtags } from '@/entities/transaction';
import { formatDate } from '@/shared/lib/format/date';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { Calendar } from '@/shared/ui/primitives/calendar';
import { CalendarDate, type DateValue } from '@internationalized/date';
import { reviewRows } from '../model/reviewRows';
import ReviewFieldRow from './ReviewFieldRow.vue';
import TypeSheet from './TypeSheet.vue';
import CommentSheet from './CommentSheet.vue';

const SplitExpenseDrawer = defineAsyncComponent(
  () => import('@/features/split-expense/ui/SplitExpenseDrawer.vue'),
);
```

Проверить фактические имена экспортов: `CategoryPickerSheet` — в `frontend/src/entities/category/index.ts` (если не экспортирован — добавить экспорт по аналогии с `CategoryPicker`); `CATEGORY_IDS` — там же; `useHashtags` — в `frontend/src/entities/transaction/index.ts`.

Добавить в `<script setup>` (после существующего блока «Погашение существующего долга»):

```ts
// --- Чеклист-ревью: UI-стейт шторок и производные значения -------------------
const typeSheetOpen = ref(false);
const accountSheetOpen = ref(false);
const categorySheetOpen = ref(false);
const commentSheetOpen = ref(false);
const splitDrawerOpen = ref(false);
const calendarOpen = ref(false);

const rows = computed(() => reviewRows(formData.value.type));

// Состояние счёта/валюты/баланса для HeroAmount — тот же usePanelState, что в панелях.
const {
  selectedAccount,
  availableCurrencies,
  isMultiCurrency,
  currencySymbol,
  currentBalance,
  hasSufficientFunds,
  updateField: updatePanelField,
  handleAccountChange,
} = usePanelState(
  {
    get formData() {
      return formData.value;
    },
    get accounts() {
      return accounts.value;
    },
  },
  (_event, value) => {
    formData.value = value;
  },
);

const { hashtags } = useHashtags(userId);

const categoriesPool = computed(() =>
  formData.value.type === 'income' ? incomeCategories.value : expenseCategories.value,
);
const selectedCategory = computed(
  () => categoriesPool.value.find((c) => c.id === formData.value.categoryId) ?? null,
);

const displayDate = computed(() => formatDate(formData.value.date, { format: 'short' }));
const calendarValue = computed(() => {
  const d = new Date(formData.value.date);
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
});

function onCalendarSelect(value: DateValue | undefined) {
  if (!value) return;
  const date = new Date(value.year, value.month - 1, value.day);
  updateField('date', date.getTime());
  calendarOpen.value = false;
}

const typeLabel = computed(() => {
  if (formData.value.type === 'income') return 'Доход';
  if (formData.value.type === 'transfer') return 'Перевод';
  return 'Расход';
});

// Смена типа: сброс категории/целевого счёта — как applyTypeChange в TransactionForm;
// настроенное разделение применимо только к расходу, сбрасываем явно.
function applyType(newType: 'expense' | 'income' | 'transfer') {
  if (newType === formData.value.type) return;
  if (formData.value.type === 'expense' && splitData.value.enabled) {
    setSplitEnabled(false);
  }
  formData.value = {
    ...formData.value,
    type: newType,
    categoryId: newType === 'transfer' ? CATEGORY_IDS.TRANSFER : '',
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
  };
}

const hasSplit = computed(
  () => !!splitData.value.enabled && splitData.value.participants.length > 0,
);
const splitChipLabel = computed(() =>
  hasSplit.value
    ? `Разделено на ${splitData.value.participants.length + (splitData.value.isIncluded ? 1 : 0)}`
    : 'Разделить',
);
```

Примечания:
- `updateField` уже возвращается из `useTransactionForm()` — коллизии нет; из `usePanelState` функция переименована в `updatePanelField` (используется для HeroAmount: `@update:amount="updatePanelField('amount', $event)"`, `@update:currency="updatePanelField('currency', $event)"`).
- Для `TransferPanel` нужен обработчик `@update:form-data="formData = $event"`.
- `provenanceTitle`: заменить текущее inline-выражение из шаблона на computed:

```ts
const provenanceTitle = computed(
  () =>
    item.value?.merchant ||
    (isBalanceChange.value ? 'Изменение баланса' : 'Операция по карте'),
);
```

- [ ] **Step 2: Заменить `<template>` целиком**

```vue
<template>
  <div class="h-full flex flex-col min-w-0 relative">
    <!-- Mobile Header -->
    <div class="md:hidden shrink-0">
      <AppHeader title="Подтверждение" show-back blur @back="goToInbox" />
    </div>

    <!-- Desktop Header -->
    <div class="hidden md:flex items-center justify-between px-8 py-6 shrink-0">
      <h1 class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
        Подтверждение импорта
      </h1>
      <button
        type="button"
        aria-label="Закрыть"
        class="w-10 h-10 rounded-full flex items-center justify-center bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors cursor-pointer text-text-secondary-light dark:text-text-secondary-dark"
        @click="goToInbox"
      >
        <UIcon name="close" size="sm" />
      </button>
    </div>

    <!-- Content -->
    <main class="flex-1 overflow-y-auto px-4 md:px-8 pt-2 md:pt-4 pb-4">
      <!-- Not found -->
      <NotFoundState
        v-if="!isLoading && !item"
        icon="inbox"
        message="Импорт не найден"
        action-label="К инбоксу"
        :action-route="ROUTE_NAMES.IMPORT_INBOX"
      />

      <div
        v-else-if="item"
        class="md:max-w-xl md:mx-auto md:bg-card-light md:dark:bg-card-dark md:rounded-3xl md:shadow-sm md:border md:border-border-light md:dark:border-border-dark md:p-6 md:mt-2 space-y-3"
      >
        <!-- Хиро-зона: происхождение + сумма + тип -->
        <section
          class="rounded-2xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark px-3.5 pt-2.5 pb-3 animate-fadeInUp"
        >
          <div
            class="flex items-center justify-center gap-1.5 text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            <span class="truncate font-medium text-text-secondary-light dark:text-text-secondary-dark">
              {{ provenanceTitle }}
            </span>
            <span aria-hidden="true">·</span>
            <span class="shrink-0">{{ item.card_mask }}</span>
            <template v-if="relativeDate">
              <span aria-hidden="true">·</span>
              <span class="shrink-0">{{ relativeDate }}</span>
            </template>
            <span aria-hidden="true">·</span>
            <span class="shrink-0 text-primary font-medium">Telegram</span>
          </div>

          <HeroAmount
            v-if="!rows.transferPanel"
            class="mt-1"
            :amount="formData.amount"
            :currency="formData.currency"
            :currency-symbol="currencySymbol"
            :available-currencies="availableCurrencies"
            :is-multi-currency="isMultiCurrency"
            :show-insufficient-funds="!hasSufficientFunds"
            :current-balance="selectedAccount ? currentBalance : undefined"
            :autofocus="needsManualAmount"
            @update:amount="updatePanelField('amount', $event)"
            @update:currency="updatePanelField('currency', $event)"
          />

          <div class="flex justify-center" :class="rows.transferPanel ? 'mt-2' : ''">
            <button
              type="button"
              class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-medium bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark hover:bg-primary-light transition-colors"
              @click="typeSheetOpen = true"
            >
              {{ typeLabel }}
              <UIcon
                name="expand_more"
                size="xs"
                class="text-text-tertiary-light dark:text-text-tertiary-dark"
              />
            </button>
          </div>

          <!-- Balance-change explainer -->
          <div
            v-if="isBalanceChange"
            class="mt-2.5 flex items-start gap-2 rounded-xl bg-info-light px-3 py-2"
          >
            <UIcon name="info" size="xs" class="text-info mt-0.5 shrink-0" />
            <p class="text-xs text-info leading-snug">
              Баланс карты изменился.
              <template v-if="needsManualAmount">
                Сумма не распознана — укажите её вручную.
              </template>
              <template v-else>Проверьте тип и сумму операции перед сохранением.</template>
            </p>
          </div>
        </section>

        <!-- Автоподсказка: сумма точно совпадает с остатком долгов одного человека -->
        <section
          v-if="repaymentMatch"
          class="rounded-2xl border border-primary/30 bg-primary-light flex items-center gap-3 px-3.5 py-2.5 animate-fadeInUp"
        >
          <UIcon name="handshake" size="sm" class="text-primary shrink-0" />
          <p class="flex-1 text-sm text-text-primary-light dark:text-text-primary-dark leading-snug">
            {{ repaymentMatchText }}
          </p>
          <UButton
            size="sm"
            :disabled="isClosing || isSubmitting"
            @click="repayGroup(repaymentMatch)"
          >
            Применить
          </UButton>
          <button
            type="button"
            aria-label="Скрыть подсказку"
            class="w-7 h-7 rounded-lg flex items-center justify-center text-text-tertiary-light dark:text-text-tertiary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors shrink-0"
            @click="repaymentSuggestionDismissed = true"
          >
            <UIcon name="close" size="xs" />
          </button>
        </section>

        <!-- TransferPanel вместо чеклиста счёта/категории (только для перевода) -->
        <section v-if="rows.transferPanel" class="animate-fadeInUp">
          <TransferPanel
            :form-data="formData"
            :accounts="accounts"
            :user-currency="userCurrency"
            @update:form-data="formData = $event"
          />
        </section>

        <!-- Чеклист полей -->
        <section
          class="rounded-2xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden animate-fadeInUp divide-y divide-border-light dark:divide-border-dark"
        >
          <ReviewFieldRow
            v-if="rows.account"
            icon="account_balance_wallet"
            label="Счёт"
            :value="selectedAccount?.name ?? null"
            @click="accountSheetOpen = true"
          />

          <ReviewFieldRow
            v-if="rows.category"
            icon="sell"
            label="Категория"
            :value="selectedCategory?.name ?? null"
            @click="categorySheetOpen = true"
          />

          <Popover v-model:open="calendarOpen">
            <PopoverTrigger as-child>
              <ReviewFieldRow icon="calendar_today" label="Дата" :value="displayDate" />
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              :side-offset="8"
              :collision-padding="16"
              class="w-auto p-0"
            >
              <Calendar
                :model-value="calendarValue"
                locale="ru-RU"
                @update:model-value="onCalendarSelect"
              />
            </PopoverContent>
          </Popover>

          <ReviewFieldRow
            icon="edit_note"
            label="Комментарий"
            :value="formData.description || null"
            placeholder="Добавить"
            @click="commentSheetOpen = true"
          />
        </section>

        <!-- Ряд компакт-действий -->
        <div class="flex flex-wrap gap-1.5 animate-fadeInUp">
          <button
            v-if="eligibleGroups.length > 0 && !repaymentMatch"
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark active:scale-95 transition-all whitespace-nowrap"
            :disabled="isClosing || isSubmitting"
            @click="showRepaymentSheet = true"
          >
            <UIcon name="handshake" size="sm" />
            Возврат долга
          </button>

          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark active:scale-95 transition-all whitespace-nowrap"
            @click="toScanReceipt"
          >
            <UIcon name="document_scanner" size="sm" />
            Чек
          </button>

          <button
            v-if="rows.split"
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border active:scale-95 transition-all whitespace-nowrap"
            :class="
              hasSplit
                ? 'border-primary/30 bg-primary-light text-primary font-medium'
                : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark'
            "
            @click="splitDrawerOpen = true"
          >
            <UIcon name="group" size="sm" />
            {{ splitChipLabel }}
            <span
              v-if="hasSplit"
              role="button"
              aria-label="Сбросить разделение"
              class="-mr-1 p-0.5 rounded hover:bg-surface-light dark:hover:bg-surface-dark"
              @click.stop="setSplitEnabled(false)"
            >
              <UIcon name="close" size="xs" />
            </span>
          </button>
        </div>
      </div>
    </main>

    <!-- Sticky-бар: ошибка + Отклонить/Подтвердить -->
    <div
      v-if="item"
      class="shrink-0 border-t border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div class="md:max-w-xl md:mx-auto">
        <p v-if="validationError" data-testid="validation-error" class="mb-2 text-xs text-danger">
          {{ validationError }}
        </p>
        <div class="flex gap-2">
          <UButton
            variant="ghost"
            size="lg"
            class="text-danger shrink-0"
            @click="showDismissConfirm = true"
          >
            Отклонить
          </UButton>
          <UButton
            variant="primary"
            size="lg"
            class="flex-1"
            data-testid="submit-btn"
            :loading="isSubmitting"
            :disabled="!isValid || isClosing"
            @click="handleSubmit"
          >
            Подтвердить
          </UButton>
        </div>
      </div>
    </div>

    <!-- Dismiss confirmation -->
    <ConfirmDeleteModal
      v-model="showDismissConfirm"
      title="Отклонить импорт?"
      warning-text="Операция будет убрана из инбокса и не попадёт в историю."
      confirm-label="Отклонить"
      @confirm="handleDismiss"
    />

    <DebtRepaymentSheet
      v-model:open="showRepaymentSheet"
      :groups="eligibleGroups"
      :amount="Math.abs(item?.amount ?? 0)"
      :currency="item?.currency ?? userCurrency ?? 'USD'"
      @select="repayGroup"
    />

    <TypeSheet
      v-model:open="typeSheetOpen"
      :model-value="formData.type === 'income' || formData.type === 'transfer' ? formData.type : 'expense'"
      @update:model-value="applyType"
    />

    <AccountPickerSheet
      v-model:open="accountSheetOpen"
      :accounts="accounts"
      :selected-id="formData.accountId"
      @select="handleAccountChange"
    />

    <CategoryPickerSheet
      v-model:open="categorySheetOpen"
      :categories="categoriesPool"
      :selected-id="formData.categoryId"
      @select="(id: string) => updateField('categoryId', id)"
    />

    <CommentSheet
      v-model:open="commentSheetOpen"
      :model-value="formData.description"
      :hashtags="hashtags"
      @update:model-value="(v: string) => updateField('description', v)"
    />

    <SplitExpenseDrawer
      v-if="splitData"
      :open="splitDrawerOpen"
      :total-amount="formData.amount"
      :currency="formData.currency"
      :split-data="splitData"
      :validation-error="splitValidationError"
      @update:open="splitDrawerOpen = $event"
      @add-participant="
        (name: string, fromContacts: boolean, color?: string) =>
          addParticipant(name, fromContacts, color)
      "
      @remove-participant="removeParticipant"
      @update-participant-amount="(id, amount) => updateParticipantAmount(id, amount)"
      @set-method="setSplitMethod"
      @set-my-share="setMyShare"
      @set-is-included="setIsIncluded"
      @set-enabled="setSplitEnabled"
    />
  </div>
</template>
```

Сверить перед вставкой:
- точные пропы/эмиты `CategoryPickerSheet` (`v-model:open`? `select`?) — открыть файл и подстроить биндинги;
- точные эмиты `SplitExpenseDrawer` (скопировать биндинги из `ExpensePanel.vue` — там образец);
- иконки `account_balance_wallet`, `sell`, `edit_note`, `group`, `check` — наличие в `iconMap.ts`, недостающие добавить;
- `useHashtags(userId)` — форма возврата (`{ hashtags }`) как в `TransactionForm.vue`.

- [ ] **Step 3: Проверка сборки и тестов**

Run: `cd frontend && bun run build && bunx vitest run src/pages/import-inbox`
Expected: сборка проходит, тесты `reviewRows.spec.ts`, `debtRepayment.spec.ts`, `categoryPrefill` (если есть) — зелёные.

- [ ] **Step 4: Ручная проверка (dev-сервер)**

Run: `cd frontend && bun run dev`, открыть `/import` → любой элемент инбокса.
Проверить: хиро-зона с суммой и чипом типа; строки Счёт/Категория/Дата/Комментарий открывают свои шторки; смена типа на «Перевод» показывает TransferPanel; чипы действий работают; sticky-бар виден без скролла; «Подтвердить» создаёт транзакцию и уводит к следующему импорту.

---

### Task 6: Cleanup неиспользуемых пропов + changelog

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/TransactionForm.vue`
- Modify: `frontend/src/features/add-transaction/ui/ExpensePanel.vue`
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

**Interfaces:**
- Consumes: ничего нового.
- Produces: `TransactionForm` без пропа `hideDebtTab`, `ExpensePanel` без пропа `hideScanReceipt` (использовались только ImportConfirmPage; после Task 5 потребителей нет — проверить グrep'ом).

- [ ] **Step 1: Убедиться, что потребителей пропов не осталось**

Run: `cd frontend && grep -rn "hide-debt-tab\|hideDebtTab\|hide-scan-receipt\|hideScanReceipt" src --include='*.vue' --include='*.ts'`
Expected: совпадения только внутри `TransactionForm.vue` и `ExpensePanel.vue` (объявления). Если есть другие потребители — остановиться и не удалять.

- [ ] **Step 2: TransactionForm — удалить `hideDebtTab`**

В `frontend/src/features/add-transaction/ui/TransactionForm.vue`:
- удалить проп `hideDebtTab` из `defineProps` (вместе с JSDoc-комментарием);
- заменить вычисление `typeOrder`/`tabItems`:

```ts
// Было:
const typeOrder: readonly TransactionType[] = props.hideDebtTab
  ? TRANSACTION_TYPE_ORDER.filter((t) => t !== 'debt')
  : TRANSACTION_TYPE_ORDER;
const tabItems = ALL_TAB_ITEMS.filter((tab) => typeOrder.includes(tab.id as TransactionType));

// Станет:
const typeOrder = TRANSACTION_TYPE_ORDER;
const tabItems = ALL_TAB_ITEMS;
```

- проп `hideScanReceipt` в `TransactionForm` тоже удалить из `defineProps` и убрать `:hide-scan-receipt="hideScanReceipt"` из обоих мест использования `<ExpensePanel>` в шаблоне.
- `useScrollableTabs(type, applyTypeChange, typeOrder)` — вызов не менять (параметр `typeOrder` остаётся в API, покрыт тестами).

- [ ] **Step 3: ExpensePanel — удалить `hideScanReceipt`**

В `frontend/src/features/add-transaction/ui/ExpensePanel.vue`:
- удалить проп `hideScanReceipt` из `defineProps` (с JSDoc);
- в шаблоне заменить `v-if="!hideScanReceipt"` на кнопке скана чека — убрать условие (кнопка снова всегда видна).

- [ ] **Step 4: Changelog**

В `frontend/src/features/changelog/model/changelogData.ts`:
- `CURRENT_VERSION`: `1.0.60` → `1.0.61`;
- добавить запись В НАЧАЛО массива `CHANGELOG_ENTRIES` (формат скопировать с верхней существующей записи):

```ts
{
  version: '1.0.61',
  date: '2026-07-19',
  changes: [
    {
      type: 'improvement',
      description:
        'Экран подтверждения импорта из Telegram стал компактнее — всё помещается на один экран, поля редактируются по тапу',
    },
  ],
},
```

Точную форму объекта (`title`? `changes`? `items`?) сверить с существующими записями файла и повторить её.

- [ ] **Step 5: Полная проверка**

Run: `cd frontend && bun run build && bunx vitest run`
Expected: сборка и все тесты зелёные.

- [ ] **Step 6: Финальный grep мёртвых ссылок**

Run: `cd frontend && grep -rn "hideDebtTab\|hideScanReceipt" src`
Expected: 0 совпадений.

---

## Self-Review (выполнено)

- **Spec coverage:** хиро-зона (Task 5 Step 2), чеклист строк (Task 4+5), AccountPickerSheet (Task 3), CommentSheet+хештеги+клавиатура (Task 4), TransferPanel для перевода (Task 5), чипы действий + split-чип (Task 5), sticky-бар (Task 5), `reviewRows` + тест (Task 1), cleanup пропов (Task 6), changelog (Task 6). Баннер repaymentMatch и DebtRepaymentSheet — сохранены без изменений (Task 5 template).
- **Placeholders:** нет TBD; места «сверить с существующим файлом» — это указания на проверку фактических сигнатур соседнего кода, с готовым кодом по умолчанию.
- **Type consistency:** `ReviewRowsVisibility` из Task 1 используется в Task 5 (`rows.account/category/transferPanel/split`); эмиты шторок Task 3/4 совпадают с биндингами Task 5 (`v-model:open`, `select`/`update:modelValue`).
