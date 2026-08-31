# TMA-импорт: улучшения UX экрана подтверждения — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пять UX-улучшений флоу подтверждения Telegram-импорта: тосты сверху, отсутствие моргания между импортами, рабочая кнопка «назад» + Telegram BackButton, погашение существующего долга из импорта, лента балансов со сверкой.

**Architecture:** Только frontend. Позиция тостов — через route meta. Моргание убирается точечным обновлением кэша Vue Query вместо инвалидации. BackButton — расширение ленивого Telegram SDK-обёртки + новый композабл. Погашение долга переиспользует `makePartialPayment` (двумя малыми расширениями options). Лента балансов — новый презентационный компонент + чистые функции сверки.

**Tech Stack:** Vue 3 `<script setup>`, TanStack Vue Query, vaul-vue (шторка), reka-ui (тосты), Tailwind v4 semantic-токены, Vitest (+ msw для composable-тестов).

**Спека:** `docs/superpowers/specs/2026-07-17-tma-import-ux-improvements-design.md`

## Global Constraints

- Все пользовательские строки — на русском.
- Только семантические токены дизайн-системы (`bg-card-light dark:bg-card-dark` и т.п.), не сырые цвета Tailwind.
- Иконки — `<UIcon name="...">`; новые имена добавлять в `frontend/src/shared/ui/icon/iconMap.ts`.
- Тесты: `cd frontend && bunx vitest run <путь>`; полный прогон `cd frontend && bun run test`. Запускать через сабагент `test-runner` (Sonnet), билды — через `output-summarizer`.
- Финальная верификация перед коммитом задачи: `cd frontend && bun run build` (vue-tsc + vite).
- Коммиты: сообщение `feat(telegram-import): ...` / `fix(...)`, БЕЗ трейлера `Co-Authored-By`. Пуш только по явной просьбе пользователя и только в `origin` (GitHub).
- Backend не трогаем.

---

### Task 1: Позиция тостов из route meta (top на импорт-страницах)

**Files:**
- Create: `frontend/src/shared/ui/primitives/toast/useToastPosition.ts`
- Modify: `frontend/src/shared/ui/primitives/toast/ToastViewport.vue`
- Modify: `frontend/src/shared/ui/primitives/toast/Toast.vue`
- Modify: `frontend/src/shared/ui/primitives/toast/Toaster.vue`
- Modify: `frontend/src/app/router/index.ts` (роуты `scan-receipt`, `import-inbox`, `import-inbox/:id`)

**Interfaces:**
- Produces: `useToastPosition(): ComputedRef<'top' | 'bottom'>`; проп `position?: 'top' | 'bottom'` у `ToastViewport.vue` и `Toast.vue` (default `'bottom'`). Route meta поле `toastPosition?: 'top'`.
- Consumes: ничего из других задач.

- [ ] **Step 1: Композабл позиции**

Создать `frontend/src/shared/ui/primitives/toast/useToastPosition.ts`:

```ts
import { computed } from 'vue';
import { useRoute } from 'vue-router';

export type ToastPosition = 'top' | 'bottom';

/**
 * Позиция тостов задаётся через route meta { toastPosition: 'top' } —
 * фуллскрин-флоу с кнопкой действия внизу (импорт, скан чека) показывают
 * тосты сверху, чтобы не перекрывать кнопку.
 */
export function useToastPosition() {
  const route = useRoute();
  return computed<ToastPosition>(() =>
    (route.meta as { toastPosition?: ToastPosition }).toastPosition === 'top' ? 'top' : 'bottom',
  );
}
```

- [ ] **Step 2: Route meta**

В `frontend/src/app/router/index.ts` добавить meta трём роутам (сейчас `scan-receipt` уже имеет `meta: { requiresAuth: true }` — дополнить его):

```ts
{
  path: 'scan-receipt',
  name: ROUTE_NAMES.SCAN_RECEIPT,
  component: () => import('@/pages/scan-receipt/ScanReceiptPage.vue'),
  meta: { requiresAuth: true, toastPosition: 'top' },
},
{
  path: 'import-inbox',
  name: ROUTE_NAMES.IMPORT_INBOX,
  component: () => import('@/pages/import-inbox/ImportInboxPage.vue'),
  meta: { toastPosition: 'top' },
},
{
  path: 'import-inbox/:id',
  name: ROUTE_NAMES.IMPORT_CONFIRM,
  component: () => import('@/pages/import-inbox/confirm/ImportConfirmPage.vue'),
  meta: { toastPosition: 'top' },
},
```

- [ ] **Step 3: ToastViewport — проп position**

Заменить содержимое `frontend/src/shared/ui/primitives/toast/ToastViewport.vue`:

```vue
<script setup lang="ts">
import type { ToastViewportProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { computed } from 'vue';
import { ToastViewport } from 'reka-ui';
import { cn } from '@/shared/lib/utils';
import type { ToastPosition } from './useToastPosition';

const props = withDefaults(
  defineProps<ToastViewportProps & { class?: HTMLAttributes['class']; position?: ToastPosition }>(),
  { position: 'bottom' },
);

const delegatedProps = computed(() => {
  const { class: _, position: __, ...rest } = props;
  return rest;
});

// bottom: стек растёт вверх от нижнего края (col-reverse), отступ под BottomNav.
// top: стек растёт вниз от верхнего края, отступ под safe-area (шапка Telegram).
const positionClasses = computed(() =>
  props.position === 'top'
    ? 'top-0 flex-col pt-[calc(env(safe-area-inset-top,0px)+16px)]'
    : 'bottom-0 flex-col-reverse pb-[calc(env(safe-area-inset-bottom,0px)+88px)]',
);
</script>

<template>
  <ToastViewport
    :class="
      cn(
        'fixed left-1/2 -translate-x-1/2 z-[100] flex max-h-screen w-full p-4 items-center pointer-events-none md:max-w-[420px]',
        positionClasses,
        props.class,
      )
    "
    v-bind="delegatedProps"
  >
    <slot />
  </ToastViewport>
</template>
```

- [ ] **Step 4: Toast — направление slide-анимации**

В `frontend/src/shared/ui/primitives/toast/Toast.vue`:

1. В props добавить `position`:

```ts
const props = withDefaults(
  defineProps<
    ToastRootProps & {
      class?: HTMLAttributes['class'];
      variant?: ToastVariants['variant'];
      position?: 'top' | 'bottom';
    }
  >(),
  { position: 'bottom' },
);
```

2. Из базовой строки `toastVariants` (cva) удалить два класса: `data-[state=closed]:slide-out-to-bottom-full` и `data-[state=open]:slide-in-from-bottom-full`.

3. Добавить computed и включить его в `cn`:

```ts
const slideClasses = computed(() =>
  props.position === 'top'
    ? 'data-[state=open]:slide-in-from-top-full data-[state=closed]:slide-out-to-top-full'
    : 'data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full',
);
```

```html
<ToastRoot v-bind="forwarded" :class="cn(toastVariants({ variant }), slideClasses, props.class)">
```

4. В `delegatedProps` дополнительно исключить `position`:

```ts
const delegatedProps = computed(() => {
  const { class: _, variant: __, position: ___, ...rest } = props;
  return rest;
});
```

- [ ] **Step 5: Toaster — прокинуть позицию (включая transaction-success)**

В `frontend/src/shared/ui/primitives/toast/Toaster.vue`:

1. В `<script setup>` добавить:

```ts
import { useToastPosition } from './useToastPosition';

const position = useToastPosition();
```

2. `<ToastViewport>` → `<ToastViewport :position="position">`.
3. `<Toast ...>` → добавить `:position="position"`.
4. Ветка transaction-success (кастомный `<div>`): заменить `:class="toast.open ? 'transaction-toast-enter' : 'transaction-toast-leave'"` на:

```html
:class="
  toast.open
    ? position === 'top'
      ? 'transaction-toast-enter-top'
      : 'transaction-toast-enter'
    : position === 'top'
      ? 'transaction-toast-leave-top'
      : 'transaction-toast-leave'
"
```

5. В `<style>` добавить top-варианты keyframes (рядом с существующими):

```css
.transaction-toast-enter-top {
  animation: tx-toast-in-top 0.35s cubic-bezier(0.21, 1.02, 0.73, 1);
}

.transaction-toast-leave-top {
  animation: tx-toast-out-top 0.2s ease-in forwards;
}

@keyframes tx-toast-in-top {
  from {
    opacity: 0;
    transform: translateY(-100%) scale(0.92);
  }
}

@keyframes tx-toast-out-top {
  to {
    opacity: 0;
    transform: translateY(-20%) scale(0.95);
  }
}
```

И дополнить существующий `@media (prefers-reduced-motion: reduce)` блок новыми классами:

```css
@media (prefers-reduced-motion: reduce) {
  .transaction-toast-enter,
  .transaction-toast-leave,
  .transaction-toast-enter-top,
  .transaction-toast-leave-top {
    animation-duration: 0.01ms;
  }
}
```

- [ ] **Step 6: Верификация**

Run: `cd frontend && bun run build`
Expected: успешная сборка без ошибок vue-tsc.

Ручная проверка (dev-сервер `bun run dev`): на `/import-inbox/:id` вызвать тост (например, отклонить при оффлайне) — тост сверху; на дашборде — снизу, как раньше.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/shared/ui/primitives/toast frontend/src/app/router/index.ts
git commit -m "fix(telegram-import): тосты сверху на импорт-страницах — не перекрывают кнопку подтверждения"
```

---

### Task 2: Убрать моргание — точечное обновление кэша вместо инвалидации

**Files:**
- Modify: `frontend/src/entities/imported-transaction/api/useImportedTransactions.ts`
- Modify: `frontend/src/entities/imported-transaction/api/useImportedTransactions.spec.ts`
- Modify: `frontend/src/pages/import-inbox/confirm/ImportConfirmPage.vue:146-162` (`goNextOrBack`) и его вызовы

**Interfaces:**
- Produces: `useImportedTransactions` — прежняя сигнатура; `confirmImported`/`dismissImported` после успеха синхронно удаляют элемент из кэша инбокса (без инвалидации `all`). В `ImportConfirmPage` — `computeNext(): ImportedTransaction | null` и `goTo(next: ImportedTransaction | null): void` вместо `goNextOrBack()`.
- Consumes: `importedTransactionQueryKeys` (существующий).

- [ ] **Step 1: Failing test**

В `frontend/src/entities/imported-transaction/api/useImportedTransactions.spec.ts` добавить тест (внутри существующего `describe`, msw-харнесс уже настроен):

```ts
it('confirm удаляет элемент из кэша инбокса без полного рефетча', async () => {
  let inboxCalls = 0;
  server.use(
    http.get('*/api/telegram-import/inbox', () => {
      inboxCalls += 1;
      return HttpResponse.json(INBOX_RESPONSE);
    }),
    http.post('*/api/telegram-import/inbox/imp-1/confirm', () =>
      HttpResponse.json({ success: true, counterpartId: null }),
    ),
  );
  const result = mountComposable();
  await flushPromises();
  expect(result.items.value).toHaveLength(1);

  await result.confirmImported('imp-1', { transactionId: 'tx-9', accountId: 'acc-1' });
  await flushPromises();

  // Элемент убран из кэша синхронно, повторного GET инбокса не было
  expect(result.items.value).toHaveLength(0);
  expect(result.pendingCount.value).toBe(0);
  expect(inboxCalls).toBe(1);
});

it('dismiss удаляет элемент из кэша инбокса', async () => {
  server.use(
    http.get('*/api/telegram-import/inbox', () => HttpResponse.json(INBOX_RESPONSE)),
    http.post('*/api/telegram-import/inbox/imp-1/dismiss', () =>
      HttpResponse.json({ success: true }),
    ),
  );
  const result = mountComposable();
  await flushPromises();
  await result.dismissImported('imp-1');
  await flushPromises();
  expect(result.items.value).toHaveLength(0);
});
```

Примечание: существующий тест «confirm отправляет payload и инвалидирует инбокс» переименовать в «confirm отправляет payload» (инвалидации больше нет, проверка тела запроса остаётся).

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `cd frontend && bunx vitest run src/entities/imported-transaction/api/useImportedTransactions.spec.ts`
Expected: FAIL — новые тесты: `items.value` не пуст (сейчас происходит инвалидация + рефетч, `inboxCalls` = 2).

- [ ] **Step 3: Реализация в composable**

В `frontend/src/entities/imported-transaction/api/useImportedTransactions.ts` заменить блок `invalidate` + мутации (строки 25-42) на:

```ts
import type { ImportedTransaction } from '../model/types';
```

```ts
  // Точечное удаление из кэша вместо инвалидации: полный рефетч инбокса
  // перерисовывал страницу подтверждения («моргание» между импортами).
  const removeFromInbox = (id: string) => {
    queryClient.setQueryData<{ items: ImportedTransaction[]; count: number }>(
      queryKey.value,
      (old) =>
        old
          ? { items: old.items.filter((i) => i.id !== id), count: Math.max(0, old.count - 1) }
          : old,
    );
  };

  const confirmMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { transactionId: string; accountId: string; toAccountId?: string };
    }) => importedTransactionsApi.confirm(id, payload),
    onSuccess: (_res, { id }) => {
      removeFromInbox(id);
      // confirm мог обновить маппинг карта→счёт — точечно освежаем только его.
      queryClient.invalidateQueries({
        queryKey: importedTransactionQueryKeys.cards(toValue(userId) ?? ''),
      });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => importedTransactionsApi.dismiss(id),
    onSuccess: (_res, id) => removeFromInbox(id),
  });
```

- [ ] **Step 4: Тесты зелёные**

Run: `cd frontend && bunx vitest run src/entities/imported-transaction/api/useImportedTransactions.spec.ts`
Expected: PASS (все тесты файла).

- [ ] **Step 5: ImportConfirmPage — вычислять «следующий» до подтверждения**

Теперь после `await confirmImported(...)` текущего элемента уже нет в `items` — прежний `goNextOrBack()` терял позицию. Заменить функцию `goNextOrBack` (строки 150-162) на две:

```ts
function computeNext(): ImportedTransaction | null {
  const ordered = sortItems(items.value);
  const currentIndex = ordered.findIndex((i) => i.id === item.value?.id);
  const remaining = ordered.filter((i) => i.id !== item.value?.id);
  // Продолжаем с текущей позиции в выбранном порядке; wrap на начало,
  // когда текущий был последним.
  return remaining[Math.max(currentIndex, 0)] ?? remaining[0] ?? null;
}

function goTo(next: ImportedTransaction | null) {
  if (next) {
    router.replace({ name: ROUTE_NAMES.IMPORT_CONFIRM, params: { id: next.id } });
  } else {
    router.replace({ name: ROUTE_NAMES.IMPORT_INBOX });
  }
}
```

Обновить все три вызова — «следующий» фиксируется ДО мутации:

1. `handleSubmit`: в начале блока создания транзакции (сразу после валидаций, перед `let transactionId = ...`) добавить `const next = computeNext();`, а в конце заменить `goNextOrBack();` на `goTo(next);`.
2. `onDebtSubmitted`:

```ts
async function onDebtSubmitted() {
  const current = item.value;
  const next = computeNext();
  if (!current) {
    goTo(next);
    return;
  }
  try {
    await dismissImported(current.id);
  } catch {
    /* non-fatal: the debt is already created, inbox will refetch later */
  }
  toast({
    title: 'Долг создан',
    description: 'Импорт обработан.',
    variant: 'success',
  });
  goTo(next);
}
```

3. `handleDismiss`:

```ts
async function handleDismiss() {
  const current = item.value;
  showDismissConfirm.value = false;
  if (!current) return;
  const next = computeNext();
  await dismissImported(current.id);
  goTo(next);
}
```

- [ ] **Step 6: Верификация**

Run: `cd frontend && bunx vitest run src/entities/imported-transaction src/pages/import-inbox`
Expected: PASS.

Run: `cd frontend && bun run build`
Expected: успех.

Ручная проверка: подтвердить 2-3 импорта подряд — следующий экран появляется мгновенно, без мелькания загрузки/пустого состояния.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/entities/imported-transaction frontend/src/pages/import-inbox
git commit -m "fix(telegram-import): точечное обновление кэша инбокса — убрано моргание между импортами"
```

---

### Task 3: Явный «назад» + нативный Telegram BackButton

**Files:**
- Modify: `frontend/src/app/router/index.ts` (новый helper + учёт в transition-guard)
- Modify: `frontend/src/shared/lib/telegram/loadTelegramWebApp.ts`
- Create: `frontend/src/shared/lib/telegram/useTelegramBackButton.ts`
- Modify: `frontend/src/pages/import-inbox/confirm/ImportConfirmPage.vue`

**Interfaces:**
- Produces: `navigateBackTo(to: RouteLocationRaw): void` (export из `@/app/router`); `useTelegramBackButton(handler: () => void): void` (export из `@/shared/lib/telegram/useTelegramBackButton`); расширенный интерфейс `TelegramWebApp` с полем `BackButton`.
- Consumes: `ROUTE_NAMES.IMPORT_INBOX`.

- [ ] **Step 1: Router — navigateBackTo со slide-back-анимацией**

В `frontend/src/app/router/index.ts`:

1. Импорт типа: `import type { RouteLocationRaw } from 'vue-router';` (дополнить существующий импорт из vue-router).
2. Рядом с `navigateBack` (строка ~393) добавить:

```ts
// Явный переход «назад» на конкретный роут (replace) — для экранов, куда
// могли попасть без истории (TMA открывает инбокс через replace).
let forcedTransition: typeof transitionName.value | null = null;

export function navigateBackTo(to: RouteLocationRaw) {
  forcedTransition = 'slide-back';
  router.replace(to);
}
```

3. Во втором `router.beforeEach` (transition-guard, строка ~361) — первым делом после проверки `!from.name`:

```ts
  if (forcedTransition) {
    transitionName.value = forcedTransition;
    forcedTransition = null;
    return;
  }
```

- [ ] **Step 2: Telegram SDK — типы BackButton**

В `frontend/src/shared/lib/telegram/loadTelegramWebApp.ts` расширить интерфейс:

```ts
export interface TelegramWebApp {
  /** Сырая строка initData для серверной валидации; пустая вне Telegram */
  initData: string;
  colorScheme: 'light' | 'dark';
  BackButton: {
    isVisible: boolean;
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  ready(): void;
  expand(): void;
  openLink(url: string): void;
}
```

- [ ] **Step 3: Композабл useTelegramBackButton**

Создать `frontend/src/shared/lib/telegram/useTelegramBackButton.ts`:

```ts
import { onMounted, onUnmounted } from 'vue';

/**
 * Нативная стрелка «назад» Telegram Mini App. Вне Telegram (обычный веб,
 * SDK не загружен или initData пуст) — no-op. SDK уже загружен точкой входа
 * /tma, поэтому здесь только window.Telegram, без ленивой подгрузки скрипта.
 */
export function useTelegramBackButton(handler: () => void) {
  const webApp = () => window.Telegram?.WebApp;

  onMounted(() => {
    const wa = webApp();
    if (!wa?.initData) return;
    wa.BackButton.onClick(handler);
    wa.BackButton.show();
  });

  onUnmounted(() => {
    const wa = webApp();
    if (!wa?.initData) return;
    wa.BackButton.offClick(handler);
    wa.BackButton.hide();
  });
}
```

- [ ] **Step 4: Подключение на экране подтверждения**

В `frontend/src/pages/import-inbox/confirm/ImportConfirmPage.vue`:

1. Импорты: заменить `import { navigateBack } from '@/app/router';` на `import { navigateBackTo } from '@/app/router';` и добавить `import { useTelegramBackButton } from '@/shared/lib/telegram/useTelegramBackButton';`.
2. В `<script setup>`:

```ts
function goToInbox() {
  navigateBackTo({ name: ROUTE_NAMES.IMPORT_INBOX });
}

useTelegramBackButton(goToInbox);
```

3. В шаблоне: `@back="navigateBack"` (мобильная шапка) → `@back="goToInbox"`, и `@click="navigateBack"` (десктопная кнопка «Закрыть») → `@click="goToInbox"`.

`ImportInboxPage.vue` не трогаем: его «назад» (`navigateBack`) корректен в вебе, а стрелка Telegram на инбоксе и не должна показываться (верхний уровень TMA) — она скрывается при unmount экрана подтверждения.

- [ ] **Step 5: Верификация**

Run: `cd frontend && bun run build`
Expected: успех.

Ручная проверка: в вебе «назад» с экрана подтверждения всегда ведёт в инбокс (в т.ч. после прямого открытия по URL). В TMA — появляется нативная стрелка Telegram, ведёт в инбокс; на инбоксе стрелки нет.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/router/index.ts frontend/src/shared/lib/telegram frontend/src/pages/import-inbox
git commit -m "feat(telegram-import): рабочий «назад» на экране подтверждения + нативный Telegram BackButton"
```

---

### Task 4: Логика подбора долгов для погашения (чистые функции + тесты)

**Files:**
- Create: `frontend/src/pages/import-inbox/model/debtRepayment.ts`
- Create: `frontend/src/pages/import-inbox/model/debtRepayment.spec.ts`

**Interfaces:**
- Produces:
  - `eligibleDebtsForImport(debts: Debt[], item: Pick<ImportedTransaction, 'type' | 'amount' | 'currency'>): Debt[]`
  - `findExactRepaymentMatch(debts: Debt[], item: Pick<ImportedTransaction, 'type' | 'amount' | 'currency'>): Debt | null`
- Consumes: типы `Debt` (`@/shared/api/database.types`), `ImportedTransaction` (`@/entities/imported-transaction`).

- [ ] **Step 1: Failing tests**

Создать `frontend/src/pages/import-inbox/model/debtRepayment.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Debt } from '@/shared/api/database.types';
import { eligibleDebtsForImport, findExactRepaymentMatch } from './debtRepayment';

function makeDebt(overrides: Partial<Debt>): Debt {
  return {
    id: 'debt-1',
    user_id: 'user-1',
    name: 'Долг',
    total_amount: 100_000,
    remaining_amount: 100_000,
    monthly_payment: null,
    next_payment_date: null,
    created_at: '2026-07-01T00:00:00.000Z',
    debt_type: 'given',
    person_name: 'Алишер',
    account_id: null,
    transaction_id: null,
    close_transaction_id: null,
    is_closed: false,
    currency: 'UZS',
    source_transaction_id: null,
    description: null,
    closed_at: null,
    forgiven_amount: 0,
    is_private: false,
    ...overrides,
  };
}

const incomeImport = { type: 'income' as const, amount: 100_000, currency: 'UZS' };

describe('eligibleDebtsForImport', () => {
  it('income-импорт → открытые долги given той же валюты', () => {
    const debts = [
      makeDebt({ id: 'd1', debt_type: 'given' }),
      makeDebt({ id: 'd2', debt_type: 'taken' }),
      makeDebt({ id: 'd3', debt_type: 'given', is_closed: true }),
      makeDebt({ id: 'd4', debt_type: 'given', currency: 'USD' }),
    ];
    expect(eligibleDebtsForImport(debts, incomeImport).map((d) => d.id)).toEqual(['d1']);
  });

  it('expense-импорт → долги taken', () => {
    const debts = [
      makeDebt({ id: 'd1', debt_type: 'given' }),
      makeDebt({ id: 'd2', debt_type: 'taken' }),
    ];
    const result = eligibleDebtsForImport(debts, {
      type: 'expense',
      amount: 50_000,
      currency: 'UZS',
    });
    expect(result.map((d) => d.id)).toEqual(['d2']);
  });

  it('исключает долги с остатком меньше суммы импорта (переплата — вне v1)', () => {
    const debts = [
      makeDebt({ id: 'd1', remaining_amount: 30_000 }),
      makeDebt({ id: 'd2', remaining_amount: 100_000 }),
    ];
    expect(eligibleDebtsForImport(debts, incomeImport).map((d) => d.id)).toEqual(['d2']);
  });

  it('balance_change и нулевая/отсутствующая сумма → пусто', () => {
    const debts = [makeDebt({})];
    expect(
      eligibleDebtsForImport(debts, { type: 'balance_change', amount: -100_000, currency: 'UZS' }),
    ).toEqual([]);
    expect(eligibleDebtsForImport(debts, { type: 'income', amount: null, currency: 'UZS' })).toEqual(
      [],
    );
    expect(eligibleDebtsForImport(debts, { type: 'income', amount: 0, currency: 'UZS' })).toEqual(
      [],
    );
  });
});

describe('findExactRepaymentMatch', () => {
  it('единственный долг с остатком, равным сумме → матч', () => {
    const debts = [
      makeDebt({ id: 'd1', remaining_amount: 100_000 }),
      makeDebt({ id: 'd2', remaining_amount: 200_000 }),
    ];
    expect(findExactRepaymentMatch(debts, incomeImport)?.id).toBe('d1');
  });

  it('несколько долгов с одинаковым остатком → нет матча (неоднозначно)', () => {
    const debts = [
      makeDebt({ id: 'd1', remaining_amount: 100_000 }),
      makeDebt({ id: 'd2', remaining_amount: 100_000 }),
    ];
    expect(findExactRepaymentMatch(debts, incomeImport)).toBeNull();
  });

  it('нет точного совпадения → null', () => {
    const debts = [makeDebt({ id: 'd1', remaining_amount: 150_000 })];
    expect(findExactRepaymentMatch(debts, incomeImport)).toBeNull();
  });
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `cd frontend && bunx vitest run src/pages/import-inbox/model/debtRepayment.spec.ts`
Expected: FAIL — модуль `./debtRepayment` не существует.

- [ ] **Step 3: Реализация**

Создать `frontend/src/pages/import-inbox/model/debtRepayment.ts`:

```ts
import type { Debt } from '@/shared/api/database.types';
import type { ImportedTransaction } from '@/entities/imported-transaction';

type RepaymentImport = Pick<ImportedTransaction, 'type' | 'amount' | 'currency'>;

/**
 * Долги, которые можно погасить этим импортом: направление по типу операции
 * (income → «мне вернули» = given; expense → «я вернул» = taken), та же валюта,
 * остаток не меньше суммы (переплата в v1 не поддерживается — makePartialPayment
 * потребовал бы категорию для excess).
 */
export function eligibleDebtsForImport(debts: Debt[], item: RepaymentImport): Debt[] {
  if (item.type !== 'income' && item.type !== 'expense') return [];
  const amount = Math.abs(item.amount ?? 0);
  if (amount <= 0) return [];
  const debtType = item.type === 'income' ? 'given' : 'taken';
  return debts.filter(
    (d) =>
      !d.is_closed &&
      d.debt_type === debtType &&
      d.currency === item.currency &&
      d.remaining_amount >= amount,
  );
}

/**
 * Автоподсказка «похоже, это возврат долга»: ровно один подходящий долг,
 * остаток которого в точности равен сумме импорта.
 */
export function findExactRepaymentMatch(debts: Debt[], item: RepaymentImport): Debt | null {
  const amount = Math.abs(item.amount ?? 0);
  if (amount <= 0) return null;
  const matches = eligibleDebtsForImport(debts, item).filter(
    (d) => d.remaining_amount === amount,
  );
  return matches.length === 1 ? matches[0] : null;
}
```

- [ ] **Step 4: Тесты зелёные**

Run: `cd frontend && bunx vitest run src/pages/import-inbox/model/debtRepayment.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/import-inbox/model/debtRepayment.ts frontend/src/pages/import-inbox/model/debtRepayment.spec.ts
git commit -m "feat(telegram-import): логика подбора долгов для погашения из импорта"
```

---

### Task 5: usePartialPayment — дата транзакции и id созданной транзакции

**Files:**
- Modify: `frontend/src/features/partial-payment/model/usePartialPayment.ts`

**Interfaces:**
- Produces: `PartialPaymentOptions` дополняется полями `transactionDate?: string` (ISO; дата всех создаваемых транзакций вместо `new Date()`) и `onTransactionCreated?: (transactionId: string) => void` (вызывается сразу после создания основной payment-транзакции). Сигнатура `makePartialPayment` не меняется — существующие вызовы не затронуты.
- Consumes: ничего нового.

- [ ] **Step 1: Расширить options**

В `frontend/src/features/partial-payment/model/usePartialPayment.ts`:

1. Интерфейс:

```ts
interface PartialPaymentOptions {
  skipInvalidation?: boolean;
  skipToast?: boolean;
  forgiveRemainder?: boolean;
  excessCategoryId?: string;
  /** ISO-дата создаваемых транзакций (по умолчанию — сейчас). Для импорта — occurred_at. */
  transactionDate?: string;
  /** Отдаёт id основной payment-транзакции (нужен confirm'у импорта). */
  onTransactionCreated?: (transactionId: string) => void;
}
```

2. В начале `try`-блока (перед шагом 1) завести константу:

```ts
      const txDate = options?.transactionDate ?? new Date().toISOString();
```

3. Во всех трёх вызовах `transactionsApi.create` внутри функции заменить `date: new Date().toISOString(),` на `date: txDate,`.
4. В шаге 1, сразу после `closeTransactionId = transaction.id;` добавить:

```ts
        options?.onTransactionCreated?.(transaction.id);
```

- [ ] **Step 2: Верификация**

Run: `cd frontend && bunx vitest run src/features/partial-payment src/entities/debt`
Expected: PASS (существующие тесты не сломаны; у фичи может не быть своих тестов — тогда прогон пуст, `passWithNoTests` разрешает).

Run: `cd frontend && bun run build`
Expected: успех.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/partial-payment/model/usePartialPayment.ts
git commit -m "feat(partial-payment): опции transactionDate и onTransactionCreated"
```

---

### Task 6: Шторка выбора долга + интеграция погашения в ImportConfirmPage

**Files:**
- Create: `frontend/src/pages/import-inbox/confirm/DebtRepaymentSheet.vue`
- Modify: `frontend/src/pages/import-inbox/confirm/ImportConfirmPage.vue`
- Modify (при необходимости): `frontend/src/shared/ui/icon/iconMap.ts`

**Interfaces:**
- Consumes: `eligibleDebtsForImport`/`findExactRepaymentMatch` (Task 4), options `usePartialPayment` (Task 5), `computeNext`/`goTo` (Task 2), `useDebts`, `getDebtDisplayName` (`@/entities/debt`), `formatCurrency` (`@/shared/lib/format/currency` — реэкспорт из `@/shared/lib/format`).
- Produces: компонент `DebtRepaymentSheet` — props `{ open: boolean; debts: Debt[] }`, emits `update:open(value: boolean)`, `select(debt: Debt)`.

- [ ] **Step 1: Иконка**

Проверить `frontend/src/shared/ui/icon/iconMap.ts` на наличие ключа `handshake`. Если нет — добавить маппинг на Lucide `Handshake` по образцу соседних записей (импорт иконки + строка в объекте маппинга).

- [ ] **Step 2: DebtRepaymentSheet**

Создать `frontend/src/pages/import-inbox/confirm/DebtRepaymentSheet.vue` (по образцу `entities/category/ui/CategoryPickerSheet.vue`, без поиска и футера):

```vue
<script setup lang="ts">
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UIcon, InitialAvatar } from '@/shared/ui';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { formatCurrency } from '@/shared/lib/format';
import { getDebtDisplayName } from '@/entities/debt';
import type { Debt } from '@/shared/api/database.types';

defineProps<{
  open: boolean;
  debts: Debt[];
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  select: [debt: Debt];
}>();

const isDesktop = useIsDesktop();
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

        <div class="flex items-center justify-between px-5 pb-3" :class="{ 'pt-4': isDesktop }">
          <DrawerTitle
            class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
          >
            Погашение долга
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

        <div
          class="flex-1 overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] overscroll-contain"
          data-vaul-no-drag
        >
          <p
            v-if="debts.length === 0"
            class="py-8 text-center text-sm text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            Нет подходящих открытых долгов
          </p>
          <button
            v-for="debt in debts"
            :key="debt.id"
            type="button"
            class="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-surface-light dark:hover:bg-surface-dark transition-colors text-left"
            @click="emit('select', debt)"
          >
            <InitialAvatar :name="getDebtDisplayName(debt)" />
            <div class="flex-1 min-w-0">
              <p
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate"
              >
                {{ getDebtDisplayName(debt) }}
              </p>
              <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
                Остаток: {{ formatCurrency(debt.remaining_amount, debt.currency) }}
              </p>
            </div>
            <UIcon
              name="chevron_right"
              size="sm"
              class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
            />
          </button>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
```

Примечание: проверить props `InitialAvatar` (компонент из `shared/ui`) — если требует другие пропсы, передать по его сигнатуре; при сложностях заменить аватар на `IconBadge` с иконкой `handshake`.

- [ ] **Step 3: Интеграция в ImportConfirmPage — состояние и действия**

В `frontend/src/pages/import-inbox/confirm/ImportConfirmPage.vue` добавить в `<script setup>`:

Импорты:

```ts
import { useDebts, getDebtDisplayName } from '@/entities/debt';
import { usePartialPayment } from '@/features/partial-payment';
import type { Debt } from '@/shared/api/database.types';
import { eligibleDebtsForImport, findExactRepaymentMatch } from '../model/debtRepayment';
import DebtRepaymentSheet from './DebtRepaymentSheet.vue';
```

(Если `usePartialPayment` не экспортируется из `@/features/partial-payment/index.ts` — добавить экспорт в public API фичи.)

Состояние (после блока `useSplitExpense`):

```ts
// --- Погашение существующего долга -------------------------------------------
const { debts } = useDebts(userId);
const { makePartialPayment, isPaying } = usePartialPayment();
const showRepaymentSheet = ref(false);
const repaymentSuggestionDismissed = ref(false);
// Retry-bookkeeping отдельно от createdTransactionId (обычного сабмита):
// платёж прошёл, confirm упал → повтор не должен создать второй платёж.
const repaymentTransactionId = ref<string | null>(null);

const eligibleDebts = computed(() =>
  item.value ? eligibleDebtsForImport(debts.value, item.value) : [],
);
const repaymentMatch = computed(() =>
  item.value && !repaymentSuggestionDismissed.value
    ? findExactRepaymentMatch(debts.value, item.value)
    : null,
);
const repaymentMatchText = computed(() => {
  const match = repaymentMatch.value;
  if (!match) return '';
  return match.debt_type === 'given'
    ? `Похоже, это возврат долга от ${getDebtDisplayName(match)}`
    : `Похоже, это возврат вашего долга: ${getDebtDisplayName(match)}`;
});

async function repayDebt(debt: Debt) {
  if (isPaying.value || isSubmitting.value) return;
  const current = item.value;
  if (!current || !userId.value) return;
  showRepaymentSheet.value = false;
  validationError.value = null;

  if (!formData.value.accountId) {
    validationError.value = 'Выберите счёт для транзакции';
    return;
  }

  const next = computeNext();
  const amount = Math.abs(current.amount ?? 0);

  let transactionId = repaymentTransactionId.value;
  if (!transactionId) {
    let created: string | null = null;
    const ok = await makePartialPayment(
      debt,
      amount,
      formData.value.accountId,
      userId.value,
      {
        transactionDate: current.occurred_at ?? undefined,
        onTransactionCreated: (id) => {
          created = id;
        },
      },
    );
    // Ошибка уже показана тостом внутри usePartialPayment.
    if (!ok || !created) return;
    transactionId = created;
    repaymentTransactionId.value = created;
  }

  try {
    await confirmImported(current.id, {
      transactionId,
      accountId: formData.value.accountId,
    });
  } catch {
    toast({
      title: 'Платёж проведён',
      description: 'Но не удалось отметить импорт подтверждённым. Проверьте инбокс.',
      variant: 'warning',
    });
    return;
  }

  repaymentTransactionId.value = null;
  goTo(next);
}
```

В prefill-watch (блок `watch(item, ...)`, рядом со сбросом `createdTransactionId`) добавить сброс:

```ts
    repaymentSuggestionDismissed.value = false;
    repaymentTransactionId.value = null;
```

- [ ] **Step 4: Интеграция в шаблон**

1. Баннер автоподсказки — сразу ПЕРЕД `<TransactionForm ...>`:

```html
        <!-- Автоподсказка: сумма точно совпадает с остатком одного долга -->
        <section
          v-if="repaymentMatch"
          class="rounded-2xl border border-primary/30 bg-primary-light flex items-center gap-3 px-3.5 py-2.5 animate-fadeInUp"
        >
          <UIcon name="handshake" size="sm" class="text-primary shrink-0" />
          <p class="flex-1 text-sm text-text-primary-light dark:text-text-primary-dark leading-snug">
            {{ repaymentMatchText }}
          </p>
          <UButton size="sm" :disabled="isPaying || isSubmitting" @click="repayDebt(repaymentMatch)">
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
```

2. Кнопка открытия шторки — над существующим грид-блоком «Скан чека / Отклонить» (внутри `<!-- Secondary actions -->`, сделать обёртку `space-y-2` или добавить кнопку перед гридом):

```html
        <UButton
          v-if="eligibleDebts.length > 0"
          variant="outline"
          size="md"
          full-width
          :disabled="isPaying || isSubmitting"
          @click="showRepaymentSheet = true"
        >
          <UIcon name="handshake" size="sm" class="mr-1.5" />
          Погашение долга
        </UButton>
```

3. Шторка — в конец шаблона, рядом с `<ConfirmDeleteModal>`:

```html
    <DebtRepaymentSheet
      v-model:open="showRepaymentSheet"
      :debts="eligibleDebts"
      @select="repayDebt"
    />
```

- [ ] **Step 5: Верификация**

Run: `cd frontend && bunx vitest run src/pages/import-inbox`
Expected: PASS.

Run: `cd frontend && bun run build`
Expected: успех.

Ручная проверка (dev): импорт income при открытом долге given той же валюты → видна кнопка «Погашение долга»; выбор долга создаёт транзакцию `Закрытие долга: <имя>` / `Частичный платёж: <имя>`, долг уменьшается/закрывается, импорт уходит из инбокса (status `confirmed`), происходит переход к следующему. При точном совпадении суммы — баннер, «Применить» делает то же в один тап. Зеркальный кейс: expense + долг taken.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/import-inbox frontend/src/features/partial-payment frontend/src/shared/ui/icon/iconMap.ts
git commit -m "feat(telegram-import): погашение существующего долга с экрана подтверждения импорта"
```

---

### Task 7: Сверка баланса — чистая функция + тесты

**Files:**
- Create: `frontend/src/pages/import-inbox/model/balanceCheck.ts`
- Create: `frontend/src/pages/import-inbox/model/balanceCheck.spec.ts`

**Interfaces:**
- Produces: `checkBalanceAfter(appBalance: number, item: Pick<ImportedTransaction, 'type' | 'amount' | 'balance_after'>): { expected: number; matches: boolean } | null`
- Consumes: тип `ImportedTransaction`.

- [ ] **Step 1: Failing tests**

Создать `frontend/src/pages/import-inbox/model/balanceCheck.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { checkBalanceAfter } from './balanceCheck';

describe('checkBalanceAfter', () => {
  it('expense: баланс в приложении минус сумма == balance_after → совпадает', () => {
    const result = checkBalanceAfter(100_000, {
      type: 'expense',
      amount: 45_000,
      balance_after: 55_000,
    });
    expect(result).toEqual({ expected: 55_000, matches: true });
  });

  it('income: баланс плюс сумма', () => {
    const result = checkBalanceAfter(100_000, {
      type: 'income',
      amount: 45_000,
      balance_after: 145_000,
    });
    expect(result).toEqual({ expected: 145_000, matches: true });
  });

  it('balance_change: подписанная дельта', () => {
    const result = checkBalanceAfter(100_000, {
      type: 'balance_change',
      amount: -30_000,
      balance_after: 70_000,
    });
    expect(result).toEqual({ expected: 70_000, matches: true });
  });

  it('расхождение → matches: false, expected показывает ожидаемое', () => {
    const result = checkBalanceAfter(90_000, {
      type: 'expense',
      amount: 45_000,
      balance_after: 55_000,
    });
    expect(result).toEqual({ expected: 45_000, matches: false });
  });

  it('дробные копейки не дают ложного расхождения', () => {
    const result = checkBalanceAfter(100.1, {
      type: 'expense',
      amount: 0.2,
      balance_after: 99.9,
    });
    expect(result?.matches).toBe(true);
  });

  it('нет balance_after или суммы → null', () => {
    expect(
      checkBalanceAfter(100, { type: 'expense', amount: 45, balance_after: null }),
    ).toBeNull();
    expect(
      checkBalanceAfter(100, { type: 'balance_change', amount: null, balance_after: 55 }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `cd frontend && bunx vitest run src/pages/import-inbox/model/balanceCheck.spec.ts`
Expected: FAIL — модуль не существует.

- [ ] **Step 3: Реализация**

Создать `frontend/src/pages/import-inbox/model/balanceCheck.ts`:

```ts
import type { ImportedTransaction } from '@/entities/imported-transaction';

export interface BalanceCheck {
  /** Каким станет баланс в приложении после подтверждения этого импорта */
  expected: number;
  /** Совпадает ли ожидаемый баланс с balance_after из банковского уведомления */
  matches: boolean;
}

/**
 * Сверка с банком до подтверждения: если (баланс_в_приложении ± сумма) равен
 * balance_after из уведомления — после подтверждения балансы сойдутся.
 */
export function checkBalanceAfter(
  appBalance: number,
  item: Pick<ImportedTransaction, 'type' | 'amount' | 'balance_after'>,
): BalanceCheck | null {
  if (item.balance_after === null || item.amount === null) return null;
  const signed =
    item.type === 'income'
      ? Math.abs(item.amount)
      : item.type === 'expense'
        ? -Math.abs(item.amount)
        : item.amount; // balance_change: дельта уже подписана
  const expected = appBalance + signed;
  // Допуск на плавающую точку (суммы в минорных единицах не хранятся)
  return { expected, matches: Math.abs(expected - item.balance_after) < 0.005 };
}
```

- [ ] **Step 4: Тесты зелёные**

Run: `cd frontend && bunx vitest run src/pages/import-inbox/model/balanceCheck.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/import-inbox/model/balanceCheck.ts frontend/src/pages/import-inbox/model/balanceCheck.spec.ts
git commit -m "feat(telegram-import): сверка баланса приложения с balance_after уведомления"
```

---

### Task 8: Лента балансов на экране подтверждения

**Files:**
- Create: `frontend/src/pages/import-inbox/confirm/AccountBalancesStrip.vue`
- Modify: `frontend/src/pages/import-inbox/confirm/ImportConfirmPage.vue`

**Interfaces:**
- Consumes: `checkBalanceAfter` (Task 7), `AccountWithBalances` (`@/shared/api/database.types`), `formatCurrency`, `useProfile` (`@/shared/api/composables/useProfile`), `VISIBLE_ACCOUNT_TYPES` (`@/entities/account` — проверить точное имя/путь экспорта в `entities/account/model/constants.ts`).
- Produces: компонент `AccountBalancesStrip` — props `{ accounts: AccountWithBalances[]; hiddenAccountIds: Set<string>; item: ImportedTransaction }`, без emits.

- [ ] **Step 1: Компонент**

Создать `frontend/src/pages/import-inbox/confirm/AccountBalancesStrip.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format';
import { VISIBLE_ACCOUNT_TYPES } from '@/entities/account';
import type { AccountWithBalances } from '@/shared/api/database.types';
import type { ImportedTransaction } from '@/entities/imported-transaction';
import { checkBalanceAfter } from '../model/balanceCheck';

const props = defineProps<{
  accounts: AccountWithBalances[];
  hiddenAccountIds: Set<string>;
  item: ImportedTransaction;
}>();

// Нескрытые (dashboard_settings.hidden_account_ids) видимые типы счетов.
const visibleAccounts = computed(() =>
  props.accounts.filter(
    (a) =>
      !props.hiddenAccountIds.has(a.id) &&
      (VISIBLE_ACCOUNT_TYPES as readonly string[]).includes(a.type),
  ),
);

// Баланс счёта в валюте импорта; если её нет — первый доступный.
function displayBalance(account: AccountWithBalances) {
  return (
    account.balances.find((b) => b.currency === props.item.currency) ?? account.balances[0] ?? null
  );
}

const highlightedId = computed(() => props.item.suggested_account_id);

// Сверка с банком — только для счёта, привязанного к карте, и только если у него
// есть баланс в валюте импорта.
const balanceCheck = computed(() => {
  const account = visibleAccounts.value.find((a) => a.id === highlightedId.value);
  const balance = account?.balances.find((b) => b.currency === props.item.currency);
  if (!balance) return null;
  return checkBalanceAfter(balance.balance, props.item);
});
</script>

<template>
  <section v-if="visibleAccounts.length > 0" class="space-y-1.5 animate-fadeInUp">
    <div class="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
      <div
        v-for="account in visibleAccounts"
        :key="account.id"
        class="shrink-0 rounded-xl border px-3 py-1.5"
        :class="
          account.id === highlightedId
            ? 'border-primary/40 bg-primary-light'
            : 'border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark'
        "
      >
        <p class="text-[0.6875rem] text-text-tertiary-light dark:text-text-tertiary-dark truncate max-w-[8rem]">
          {{ account.name }}
        </p>
        <p class="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">
          {{
            displayBalance(account)
              ? formatCurrency(displayBalance(account)!.balance, displayBalance(account)!.currency)
              : '—'
          }}
        </p>
      </div>
    </div>

    <!-- Сверка с балансом из банковского уведомления -->
    <p
      v-if="item.balance_after !== null && balanceCheck"
      class="flex items-center gap-1.5 text-xs px-0.5"
      :class="balanceCheck.matches ? 'text-success' : 'text-warning'"
    >
      <UIcon :name="balanceCheck.matches ? 'check_circle' : 'warning'" size="xs" />
      <span>
        Банк после операции: {{ formatCurrency(item.balance_after, item.currency) }}
        <template v-if="!balanceCheck.matches">
          · в приложении будет {{ formatCurrency(balanceCheck.expected, item.currency) }}
        </template>
      </span>
    </p>
  </section>
</template>
```

Примечание: если `VISIBLE_ACCOUNT_TYPES` не экспортируется из `@/entities/account` public API — импортировать из фактического места (`entities/account/model/constants.ts` или добавить реэкспорт). Если у `Account` поле типа называется иначе, чем `type` — поправить по `database.types.ts`.

- [ ] **Step 2: Интеграция в ImportConfirmPage**

В `frontend/src/pages/import-inbox/confirm/ImportConfirmPage.vue`:

1. Импорты:

```ts
import { useProfile } from '@/shared/api/composables/useProfile';
import AccountBalancesStrip from './AccountBalancesStrip.vue';
```

2. В `<script setup>` (рядом с `useAccounts`):

```ts
const { profile } = useProfile(userId);
const hiddenAccountIds = computed<Set<string>>(
  () => new Set(profile.value?.dashboard_settings?.hidden_account_ids ?? []),
);
```

3. В шаблоне — первым блоком внутри `v-else-if="item"`-контейнера (ПЕРЕД provenance-карточкой):

```html
        <AccountBalancesStrip
          :accounts="accounts"
          :hidden-account-ids="hiddenAccountIds"
          :item="item"
        />
```

- [ ] **Step 3: Верификация**

Run: `cd frontend && bunx vitest run src/pages/import-inbox`
Expected: PASS.

Run: `cd frontend && bun run build`
Expected: успех.

Ручная проверка: на экране подтверждения видна лента нескрытых счетов с балансами; счёт карты подсвечен; при `balance_after` в уведомлении — строка сверки (✓ при совпадении, ⚠ и ожидаемое значение при расхождении). Скрытый на дашборде счёт в ленте не показывается.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/import-inbox frontend/src/entities/account
git commit -m "feat(telegram-import): лента балансов счетов со сверкой на экране подтверждения"
```

---

### Task 9: Changelog + финальная верификация

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

**Interfaces:**
- Consumes: результаты всех задач.

- [ ] **Step 1: Changelog**

В `frontend/src/features/changelog/model/changelogData.ts`: поднять патч-версию (посмотреть текущую верхнюю запись, например `1.0.X` → `1.0.X+1`) и добавить запись В НАЧАЛО массива `CHANGELOG_ENTRIES` по образцу соседних записей:

```ts
  {
    version: '<новая версия>',
    date: '<сегодняшняя дата в формате существующих записей>',
    changes: [
      {
        type: 'improvement',
        description: 'Импорт из Telegram стал удобнее: уведомления не перекрывают кнопку, переход к следующей операции без мигания, работает кнопка «назад»',
      },
      {
        type: 'feature',
        description: 'Входящий или исходящий перевод теперь можно отметить как возврат долга — долг закроется автоматически',
      },
      {
        type: 'feature',
        description: 'На экране подтверждения импорта видны балансы счетов и сверка с балансом из банковского уведомления',
      },
    ],
  },
```

(Точную структуру записи взять из существующих элементов массива — поля могут отличаться; сохранить их формат.)

- [ ] **Step 2: Полный прогон тестов**

Run: `cd frontend && bun run test`
Expected: PASS (все тесты).

- [ ] **Step 3: Полная сборка**

Run: `cd frontend && bun run build`
Expected: успех без ошибок vue-tsc.

- [ ] **Step 4: Ручной чек-лист в TMA (прод-подобная среда или dev)**

1. Тост при подтверждении — сверху, кнопка «Подтвердить» кликабельна сразу.
2. Цепочка из 3+ подтверждений — без моргания.
3. «Назад» (своя кнопка и стрелка Telegram) — в инбокс.
4. Погашение долга: income→given и expense→taken; баннер при точном совпадении суммы.
5. Лента балансов: скрытые счета отсутствуют, сверка ✓/⚠ корректна.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/changelog/model/changelogData.ts
git commit -m "chore(changelog): улучшения Telegram-импорта"
```
