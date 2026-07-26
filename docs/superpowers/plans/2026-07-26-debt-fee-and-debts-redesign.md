# Комиссия при создании долга + редизайн страниц долгов — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать пользователю указать комиссию за перевод при создании долга (она становится отдельным расходом), и переделать список и деталь долгов в подачу «люди в фокусе».

**Architecture:** Транзакцию комиссии создаёт сервер атомарно — в `create-transaction.handler.ts` уже есть такая логика для переводов, её распространяем на расходы. Сам долг получает информационное поле `fee_amount`, чтобы деталь могла показать полную стоимость. На фронте список долгов перестаёт быть списком долгов: сервер по-прежнему отдаёт группы `(person_name, debt_type)`, а новая чистая функция `foldGroupsIntoPeople` сворачивает их в одну строку на человека с нетто-суммой.

**Tech Stack:** NestJS + CQRS + TypeORM + PostgreSQL (backend); Vue 3 + FSD + TanStack Query + Tailwind v4 + Reka UI (frontend); Jest (backend), Vitest + @vue/test-utils + MSW (frontend).

**Спека:** `docs/superpowers/specs/2026-07-26-debt-fee-and-debts-redesign-design.md`

**Статус: выполнено (2026-07-26).** Отклонения от плана по ходу работы:

- Меню «···» на детали долга сделано инлайн-раскрытием, а не `UModal`: модалка рендерится через `DialogPortal`, её содержимое оказывается вне дерева компонента и недоступно в тестах, а в Telegram Mini App лишний слой поверх экрана мешает.
- Строка «Погашено» в разборе суммы скрыта у закрытых долгов — там она дублирует сумму долга.
- `fee_amount` в `Debt` оказался обязательным полем, поэтому потребовалась правка `useDebts.ts` (оптимистичный кэш) и семи тестовых фикстур, не предусмотренных планом.

## Global Constraints

- **Не коммитить.** Правило пользователя: коммиты только по явной просьбе. Вместо шага «Commit» прогонять проверки задачи и переходить дальше.
- **Комиссия только для направления `given`** («дал в долг»). Для `taken` поле скрыто и значение принудительно `0`.
- **Семантика «сверху»**: сумма долга = то, что человек должен; комиссия дополнительно уменьшает баланс счёта. Долг НЕ уменьшается на комиссию.
- **API naming**: бэкенд camelCase, фронтенд snake_case, трансформация только внутри `entities/<name>/api/*Api.ts`.
- **Дизайн-токены**: только токены из `frontend/DESIGN_SYSTEM.md` (`bg-surface-light dark:bg-surface-dark`, `text-debt-given`, `text-debt-received`), никаких сырых Tailwind-цветов. Каждый динамический class-string через `cn()`.
- **Иконки**: `<UIcon name="material_symbol_name" />`; новой иконке нужен маппинг в `frontend/src/shared/ui/icon/iconMap.ts`.
- **TypeORM**: `synchronize: false`, любое изменение схемы — через миграцию.
- **Тексты интерфейса — на русском.**
- **UI-задачи (6, 7, 8) выполнять со скиллом `frontend-design`.**
- Проверки: `cd backend && bun run build`, `cd frontend && bun run build`, `bun run lint`.

---

## File Structure

**Backend**
- `backend/src/modules/accounting/application/commands/create-transaction/create-transaction.handler.ts` — комиссия переезжает из ветки transfer в общий путь (расход + перевод).
- `backend/src/database/migrations/1785081700000-AddDebtFeeAmount.ts` — новая колонка `debts.fee_amount`.
- `backend/src/modules/debt/**` — проброс `feeAmount` через агрегат, мапперы, DTO, команду, контроллер.

**Frontend — данные**
- `frontend/src/shared/api/database.types.ts` — `fee_amount` в `debts.Row/Insert/Update`.
- `frontend/src/entities/debt/api/debtsApi.ts` — трансформация `feeAmount` ↔ `fee_amount`.
- `frontend/src/features/add-transaction/model/useDebtForm.ts` — поле `fee` в форме и в payload.
- `frontend/src/entities/debt/lib/foldGroupsIntoPeople.ts` — **новый**, сворачивание групп в людей с нетто.

**Frontend — UI**
- `frontend/src/features/add-transaction/ui/DebtPanel.vue` — инпут комиссии.
- `frontend/src/entities/debt/ui/DebtsSummaryCard.vue` — **новый**, сводка одной карточкой.
- `frontend/src/entities/debt/ui/PersonDebtRow.vue` — **новый**, плоская строка человека.
- `frontend/src/entities/debt/ui/DebtHero.vue` — **новый**, шапка детали долга.
- `frontend/src/entities/debt/ui/DebtAmountBreakdown.vue` — **новый**, разбор суммы с комиссией.
- `frontend/src/pages/debts/list/DebtsListPage.vue` — переписывается на новые компоненты.
- `frontend/src/entities/debt/ui/DebtDetailContent.vue` — переписывается: hero → действия → разбор → таймлайн → детали.

---

## Task 1: Backend — комиссия для расходных транзакций

**Files:**
- Modify: `backend/src/modules/accounting/application/commands/create-transaction/create-transaction.handler.ts:30-238`
- Test: `backend/src/modules/accounting/application/commands/create-transaction/create-transaction.handler.spec.ts`

**Interfaces:**
- Consumes: `CreateTransactionCommand.feeAmount?: number` (уже существует, `create-transaction.command.ts:18`).
- Produces: `create-transaction` API принимает `feeAmount` для `type: 'expense'` — создаёт вторую транзакцию категории `commission` и дебетует счёт на её сумму в той же БД-транзакции. Для `type: 'income'` и для `isInformational` — `BadRequestException`.

- [ ] **Step 1: Написать падающие тесты**

Добавить в `create-transaction.handler.spec.ts` новый describe-блок (рядом с существующими, стиль моков уже задан в файле — `mockAccountRepository`, `mockTransactionRepository`, `createMockAccount`):

```typescript
describe('expense with fee', () => {
  it('should create a commission transaction and debit the account twice', async () => {
    const account = createMockAccount('acc-1', 'user-1', [{ currency: 'UZS', balance: 2_000_000 }]);
    mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

    const command = new CreateTransactionCommand(
      'user-1',
      'acc-1',
      'debt_given',
      1_000_000,
      'UZS',
      'expense',
      now,
      'Дал в долг: Азиз',
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      5_000,
    );

    await handler.execute(command);

    expect(mockTransactionRepository.save).toHaveBeenCalledTimes(2);
    const savedFee = mockTransactionRepository.save.mock.calls[1][0];
    expect(savedFee.categoryId).toBe('commission');
    expect(savedFee.amountValue).toBe(5_000);
    expect(savedFee.type).toBe('expense');
    expect(savedFee.isDebtRelated).toBe(false);

    // 2 000 000 − 1 000 000 − 5 000
    expect(account.getBalance('UZS')).toBe(995_000);
  });

  it('should reject a fee on income transactions', async () => {
    const account = createMockAccount('acc-1', 'user-1', [{ currency: 'UZS', balance: 1_000 }]);
    mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

    const command = new CreateTransactionCommand(
      'user-1',
      'acc-1',
      'salary',
      1_000,
      'UZS',
      'income',
      now,
      undefined,
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      500,
    );

    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
  });
});
```

Порядок аргументов `CreateTransactionCommand` и имена геттеров (`amountValue`, `getBalance`) сверить с `create-transaction.command.ts` и `Account`/`Transaction` агрегатами — если отличаются, поправить тест под реальные сигнатуры, а не наоборот.

- [ ] **Step 2: Прогнать тесты — убедиться, что падают**

Run: `cd backend && bun run test -- create-transaction.handler.spec`
Expected: FAIL — комиссия для expense не создаётся (`save` вызван 1 раз), income с fee не бросает исключение.

- [ ] **Step 3: Вынести создание комиссии в приватный метод**

В `create-transaction.handler.ts` добавить в класс приватный метод (после `execute`):

```typescript
  /**
   * Комиссия — всегда отдельный расход категории `commission` по тому же счёту
   * и в той же валюте. Обычный расход, не долговой: с debtId она попала бы в
   * таймлайн платежей долга и исказила бы расчёт погашенного.
   */
  private createFeeTransaction(
    userId: string,
    account: Account,
    feeAmount: number,
    currency: string,
    date: Date,
  ): Transaction {
    const feeTransaction = Transaction.createExpense(
      crypto.randomUUID(),
      userId,
      account.id,
      'commission',
      feeAmount,
      currency,
      date,
      'Комиссия за перевод',
      false,
      undefined,
    );
    account.debit(feeAmount, currency);
    return feeTransaction;
  }
```

Импорт `Account` из `'../../../domain/aggregates/account'` добавить, если его ещё нет.

- [ ] **Step 4: Добавить валидацию комиссии**

В `execute`, сразу после блока проверок `isInformational` (после строки 70), вставить:

```typescript
    if (feeAmount && feeAmount > 0) {
      if (type === 'income') {
        throw new BadRequestException('Fee is not supported for income transactions');
      }
      if (isInformational) {
        throw new BadRequestException('Informational transactions cannot have a fee');
      }
    }
```

- [ ] **Step 5: Переключить transfer-ветку на новый метод**

Заменить блок строк 128-145 (`// Create commission expense if fee specified` … `account.debit(feeAmount, currency);`) на:

```typescript
      const feeTransaction =
        feeAmount && feeAmount > 0
          ? this.createFeeTransaction(userId, account, feeAmount, currency, date)
          : null;
```

Остальная часть transfer-ветки (persist, публикация событий) уже умеет работать с `feeTransaction` — не трогать.

- [ ] **Step 6: Добавить комиссию в expense-ветку**

В `else`-ветке (income/expense), после создания `transaction` и списания/зачисления по счёту (после строки 213 `}`), добавить:

```typescript
      const feeTransaction =
        feeAmount && feeAmount > 0
          ? this.createFeeTransaction(userId, account, feeAmount, currency, date)
          : null;
```

Затем в `persist` добавить сохранение комиссии:

```typescript
      const persist = async (manager: EntityManager) => {
        if (!isInformational) {
          await this.accountRepository.save(account, manager);
        }
        await this.transactionRepository.save(transaction, manager);
        if (feeTransaction) {
          await this.transactionRepository.save(feeTransaction, manager);
        }
      };
```

И в публикацию событий после коммита:

```typescript
      await this.eventPublisher.publishEvents(transaction);
      if (feeTransaction) {
        await this.eventPublisher.publishEvents(feeTransaction);
      }
```

- [ ] **Step 7: Прогнать тесты**

Run: `cd backend && bun run test -- create-transaction.handler.spec`
Expected: PASS, включая уже существовавшие тесты переводов с комиссией.

- [ ] **Step 8: Проверить сборку**

Run: `cd backend && bun run build`
Expected: без ошибок TypeScript.

---

## Task 2: Backend — поле `fee_amount` у долга

**Files:**
- Create: `backend/src/database/migrations/1785081700000-AddDebtFeeAmount.ts`
- Modify: `backend/src/modules/debt/infrastructure/persistence/typeorm/debt.orm-entity.ts`
- Modify: `backend/src/modules/debt/domain/aggregates/debt/debt.aggregate.ts`
- Modify: `backend/src/modules/debt/infrastructure/persistence/mappers/debt.mapper.ts`
- Modify: `backend/src/modules/debt/application/mappers/debt-response.mapper.ts`
- Modify: `backend/src/modules/debt/presentation/dto/create-debt.dto.ts`
- Modify: `backend/src/modules/debt/application/commands/create-debt/create-debt.command.ts`
- Modify: `backend/src/modules/debt/application/commands/create-debt/create-debt.handler.ts`
- Modify: `backend/src/modules/debt/presentation/controllers/debts.controller.ts:59-79`
- Test: `backend/src/modules/debt/application/commands/create-debt/create-debt.handler.spec.ts`

**Interfaces:**
- Produces: `POST /api/debts` принимает `feeAmount?: number` (≥ 0, по умолчанию 0) и возвращает его в `DebtResponseDto.feeAmount`. Агрегат: геттер `debt.feeAmount: number`, `Debt.create({ ..., feeAmount? })`, `debt.update({ feeAmount })`.

- [ ] **Step 1: Написать падающий тест**

Добавить в `create-debt.handler.spec.ts`:

```typescript
  it('should persist the transfer fee on the debt', async () => {
    const command = new CreateDebtCommand(
      'user-1',
      'Долг от Азиза',
      1_000_000,
      1_000_000,
      'given',
      'UZS',
      'Азиз',
      'acc-1',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      5_000,
    );

    const result = await handler.execute(command);

    expect(result.feeAmount).toBe(5_000);
  });
```

Сверить существующий порядок аргументов `CreateDebtCommand` в файле команды — `feeAmount` добавляется последним параметром, после `isPrivate`.

- [ ] **Step 2: Прогнать тест — убедиться, что падает**

Run: `cd backend && bun run test -- create-debt.handler.spec`
Expected: FAIL — `result.feeAmount` равен `undefined`, а конструктор команды не принимает 16-й аргумент.

- [ ] **Step 3: Написать миграцию**

`backend/src/database/migrations/1785081700000-AddDebtFeeAmount.ts`:

```typescript
import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddDebtFeeAmount1785081700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "debts" ADD COLUMN "fee_amount" decimal(18,2) NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "debts" DROP COLUMN "fee_amount"`);
  }
}
```

- [ ] **Step 4: Добавить колонку в ORM-сущность**

В `debt.orm-entity.ts`, после `forgivenAmount` (строка 71):

```typescript
  @Column({ name: 'fee_amount', type: 'decimal', precision: 18, scale: 2, default: 0 })
  feeAmount: number;
```

- [ ] **Step 5: Провести поле через агрегат**

В `debt.aggregate.ts`:

1. `DebtProps` — добавить `feeAmount: number;` после `isPrivate: boolean;`
2. `CreateDebtProps` — добавить `feeAmount?: number;`
3. Приватное поле: `private _feeAmount: number;`
4. В конструкторе: `this._feeAmount = props.feeAmount;`
5. В `static create` — деструктурировать `feeAmount` из props и передать в объект: `feeAmount: feeAmount ?? 0,`
6. Геттер:

```typescript
  get feeAmount(): number {
    return this._feeAmount;
  }
```

7. В `update(data)` — добавить в тип параметра `feeAmount?: number;` и в тело:

```typescript
    if (data.feeAmount !== undefined) this._feeAmount = data.feeAmount;
```

- [ ] **Step 6: Прокинуть через мапперы**

В `debt.mapper.ts` → `toDomain` добавить `feeAmount: Number(ormEntity.feeAmount),`; в `toOrm` — `ormEntity.feeAmount = debt.feeAmount;`

В `debt-response.mapper.ts` — в интерфейс `DebtResponseDto` добавить `feeAmount: number;`, в `toResponse` — `feeAmount: debt.feeAmount,`.

- [ ] **Step 7: Прокинуть через DTO, команду, хендлер и контроллер**

`create-debt.dto.ts` — добавить после `isPrivate`:

```typescript
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000_000_000)
  feeAmount?: number;
```

`create-debt.command.ts` — добавить последним параметром конструктора:

```typescript
    public readonly feeAmount?: number,
```

`create-debt.handler.ts` — в объект `Debt.create({...})` добавить `feeAmount: command.feeAmount,`

`debts.controller.ts` — в `new CreateDebtCommand(...)` добавить последним аргументом `dto.feeAmount,` (после `dto.isPrivate`).

- [ ] **Step 8: Прогнать тесты долгов**

Run: `cd backend && bun run test -- debt`
Expected: PASS, включая существующие `debt.aggregate.spec.ts` и `create-debt.handler.spec.ts`.

- [ ] **Step 9: Применить миграцию и проверить сборку**

Run: `cd backend && bun run build && bun run migration:run`
Expected: сборка без ошибок, миграция применена, у существующих долгов `fee_amount = 0`.

---

## Task 3: Frontend — транспорт `fee_amount` и комиссия в модели формы

**Files:**
- Modify: `frontend/src/shared/api/database.types.ts:290-330` (блок `debts`)
- Modify: `frontend/src/entities/debt/api/debtsApi.ts:6-27,46-69,124-144`
- Modify: `frontend/src/features/add-transaction/model/useDebtForm.ts`
- Test: `frontend/src/features/add-transaction/model/useDebtForm.spec.ts`

**Interfaces:**
- Consumes: `POST /api/debts { feeAmount }` и `POST /api/transactions { feeAmount }` из задач 1-2.
- Produces: `DebtFormData.fee: number`; `Debt.fee_amount: number` во фронтовом типе; `useDebtForm()` возвращает всё то же, что и раньше.

- [ ] **Step 1: Написать падающие тесты**

Добавить в `useDebtForm.spec.ts` (хелпер `fillValidForm` и `mountComposable` уже есть в файле):

```typescript
  describe('комиссия за перевод', () => {
    it('отправляет комиссию в транзакцию и в долг при «дал в долг»', async () => {
      let txBody: Record<string, unknown> | null = null;
      let debtBody: Record<string, unknown> | null = null;

      server.use(
        http.post('*/transactions', async ({ request }) => {
          txBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(mockTransactionResponse({ id: 'tx-1' }));
        }),
        http.post('*/debts', async ({ request }) => {
          debtBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(buildMockDebtResponse({ id: 'debt-1' }));
        }),
      );

      const c = mountComposable();
      fillValidForm(c, { debt_type: 'given' });
      c.updateField('fee', 5000);

      await c.createDebt(USER_ID);
      await flushPromises();

      expect(txBody!.feeAmount).toBe(5000);
      expect(txBody!.amount).toBe(50000);
      expect(debtBody!.feeAmount).toBe(5000);
      expect(debtBody!.totalAmount).toBe(50000);
    });

    it('обнуляет комиссию при переключении на «взял в долг»', () => {
      const c = mountComposable();
      c.updateField('fee', 5000);
      c.updateField('debt_type', 'taken');

      expect(c.formData.value.fee).toBe(0);
    });

    it('обнуляет комиссию при включении «не списывать с баланса»', () => {
      const c = mountComposable();
      c.updateField('debt_type', 'given');
      c.updateField('fee', 5000);
      c.updateField('skip_transaction', true);

      expect(c.formData.value.fee).toBe(0);
    });

    it('не отправляет feeAmount, когда комиссия нулевая', async () => {
      let txBody: Record<string, unknown> | null = null;

      server.use(
        http.post('*/transactions', async ({ request }) => {
          txBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(mockTransactionResponse({ id: 'tx-1' }));
        }),
        http.post('*/debts', () => HttpResponse.json(buildMockDebtResponse({ id: 'debt-1' }))),
      );

      const c = mountComposable();
      fillValidForm(c, { debt_type: 'given' });

      await c.createDebt(USER_ID);
      await flushPromises();

      expect(txBody!.feeAmount).toBeUndefined();
    });
  });
```

- [ ] **Step 2: Прогнать тесты — убедиться, что падают**

Run: `cd frontend && bun run test -- useDebtForm`
Expected: FAIL — поля `fee` в `DebtFormData` нет, `updateField('fee', …)` не типизируется.

- [ ] **Step 3: Добавить `fee_amount` во фронтовый тип долга**

В `database.types.ts`, в блоке `debts`, добавить в `Row` (после `is_private: boolean;`):

```typescript
          fee_amount: number;
```

в `Insert`:

```typescript
          fee_amount?: number;
```

и в `Update` (если блок `Update` перечисляет поля явно) — так же с `?`.

- [ ] **Step 4: Прокинуть поле через `debtsApi`**

В `debtsApi.ts`:

1. В интерфейс `DebtResponse` добавить `feeAmount: number;`
2. В `transformDebt` добавить `fee_amount: debt.feeAmount ?? 0,`
3. В `create` в тело запроса добавить `feeAmount: debt.fee_amount ?? 0,`

- [ ] **Step 5: Добавить `fee` в модель формы**

В `useDebtForm.ts`:

1. В интерфейс `DebtFormData` добавить `fee: number;`
2. В `makeInitialFormData()` — `fee: 0,`
3. В `updateField` добавить сброс комиссии там, где она теряет смысл:

```typescript
  function updateField<K extends keyof DebtFormData>(field: K, value: DebtFormData[K]) {
    formData.value[field] = value;
    // Комиссию платит только тот, кто отправляет деньги, и только если
    // транзакция вообще создаётся.
    if (
      (field === 'debt_type' && value !== 'given') ||
      (field === 'skip_transaction' && value === true)
    ) {
      formData.value.fee = 0;
    }
  }
```

4. В `mutationFn`, в вызов `transactionsApi.create`, добавить последним полем:

```typescript
            fee_amount: formData.value.fee > 0 ? formData.value.fee : undefined,
```

5. В вызов `debtsApi.create` добавить:

```typescript
          fee_amount: formData.value.fee,
```

- [ ] **Step 6: Прогнать тесты**

Run: `cd frontend && bun run test -- useDebtForm`
Expected: PASS.

- [ ] **Step 7: Проверить типы**

Run: `cd frontend && bun run build`
Expected: без ошибок TypeScript.

---

## Task 4: Frontend — поле комиссии в форме создания долга

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/DebtPanel.vue`

**Interfaces:**
- Consumes: `DebtFormData.fee` и `updateField('fee', …)` из задачи 3.

- [ ] **Step 1: Добавить состояние и вычисляемые значения**

В `<script setup>` файла `DebtPanel.vue`, после `const currencySymbol = …`:

```typescript
import { sanitizeCurrencyInput, formatCurrency } from '@/shared/lib/format/currency';

const rawFeeValue = ref('');

// Комиссию платит отправитель — при «взял в долг» её нет. При отключённой
// транзакции списывать нечего, поэтому поле тоже прячем.
const showFeeInput = computed(
  () => formData.value.debt_type === 'given' && !formData.value.skip_transaction,
);

const totalDebited = computed(() => formData.value.amount + formData.value.fee);

function handleFeeInput(raw: string) {
  const sanitized = sanitizeCurrencyInput(raw);
  rawFeeValue.value = sanitized;
  const num = parseFloat(sanitized);
  updateField('fee', Number.isNaN(num) ? 0 : num);
}

// Модель обнуляет комиссию при смене направления или включении skip —
// сырое значение инпута должно поехать следом, иначе в поле останется цифра.
watch(
  () => formData.value.fee,
  (fee) => {
    if (fee === 0 && rawFeeValue.value !== '') rawFeeValue.value = '';
  },
);
```

Импорт `sanitizeCurrencyInput` добавляется к уже импортируемому `getCurrencySymbol` из того же модуля.

- [ ] **Step 2: Добавить разметку поля**

В `<template>`, между блоком `AccountSelector` и `<div class="grid grid-cols-2 gap-2">` (даты), вставить:

```vue
    <div v-if="showFeeInput" class="space-y-1.5">
      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        Комиссия за перевод (необязательно)
      </label>
      <div
        class="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark"
      >
        <UIcon
          name="receipt_long"
          size="sm"
          class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
        />
        <input
          type="text"
          inputmode="decimal"
          :value="rawFeeValue"
          placeholder="0"
          aria-label="Комиссия за перевод"
          data-testid="debt-fee-input"
          class="flex-1 min-w-0 bg-transparent text-sm text-right text-text-primary-light dark:text-text-primary-dark outline-none tabular-nums"
          @input="handleFeeInput(($event.target as HTMLInputElement).value)"
        />
        <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark shrink-0">
          {{ formData.currency }}
        </span>
      </div>
      <p
        v-if="formData.fee > 0"
        class="px-1 text-xs text-text-tertiary-light dark:text-text-tertiary-dark tabular-nums"
      >
        Со счёта спишется {{ formatCurrency(totalDebited, formData.currency) }} — долг
        {{ formatCurrency(formData.amount, formData.currency) }} + комиссия
        {{ formatCurrency(formData.fee, formData.currency) }}
      </p>
    </div>
```

- [ ] **Step 3: Обновить информационный текст внизу формы**

`infoText` сейчас говорит только про сумму. Заменить его вычисление на:

```typescript
const infoText = computed(() => {
  const isGiven = formData.value.debt_type === 'given';
  const sum = formData.value.amount > 0
    ? formatCurrency(isGiven ? totalDebited.value : formData.value.amount, formData.value.currency)
    : '';
  return isGiven
    ? `Сумма ${sum} будет списана с выбранного счёта`
    : `Сумма ${sum} будет добавлена на выбранный счёт`;
});
```

- [ ] **Step 4: Проверить руками**

Run: `bun run dev`, открыть создание долга → «Дал в долг».
Expected: поле комиссии видно; при вводе 5000 подпись показывает разбор; переключение на «Взял в долг» прячет поле и очищает значение; включение «Не списывать с баланса» прячет поле.

- [ ] **Step 5: Проверить сборку и линт**

Run: `cd frontend && bun run build && bun run lint`
Expected: без ошибок.

---

## Task 5: Frontend — сворачивание групп в людей (`foldGroupsIntoPeople`)

**Files:**
- Create: `frontend/src/entities/debt/lib/foldGroupsIntoPeople.ts`
- Create: `frontend/src/entities/debt/lib/foldGroupsIntoPeople.spec.ts`
- Modify: `frontend/src/entities/debt/index.ts` (публичный экспорт)

**Interfaces:**
- Consumes: `DebtGroupResponse` из `entities/debt/model/types.ts`, `convert(amount, currency)` из `useExchangeRates`.
- Produces:

```typescript
export interface PersonDebtSummary {
  personName: string;
  /** Нетто в валюте пользователя: > 0 — вам должны, < 0 — вы должны. */
  net: number;
  /** Направление по знаку нетто: given = вам должны. */
  direction: DebtDirection;
  debts: Debt[];
  debtCount: number;
  /** Ближайшая дата возврата среди долгов человека, ISO-строка. */
  nearestDueDate: string | null;
  /** Сколько дней просрочки у самого просроченного долга, иначе null. */
  overdueDays: number | null;
  hasPrivate: boolean;
}

export function foldGroupsIntoPeople(
  groups: DebtGroupResponse[],
  convert: (amount: number, fromCurrency: string) => number,
): PersonDebtSummary[];
```

- [ ] **Step 1: Написать падающие тесты**

`frontend/src/entities/debt/lib/foldGroupsIntoPeople.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { foldGroupsIntoPeople } from './foldGroupsIntoPeople';
import type { DebtGroupResponse, Debt } from '../model/types';

const identity = (amount: number) => amount;

function makeDebt(over: Partial<Debt> = {}): Debt {
  return {
    id: 'd1',
    user_id: 'u1',
    name: 'Долг',
    total_amount: 1000,
    remaining_amount: 1000,
    monthly_payment: null,
    next_payment_date: null,
    created_at: '2026-07-01T00:00:00.000Z',
    debt_type: 'given',
    person_name: 'Азиз',
    account_id: 'acc-1',
    transaction_id: null,
    close_transaction_id: null,
    is_closed: false,
    currency: 'UZS',
    source_transaction_id: null,
    description: null,
    closed_at: null,
    forgiven_amount: 0,
    is_private: false,
    fee_amount: 0,
    ...over,
  } as Debt;
}

function group(personName: string, debtType: 'given' | 'taken', debts: Debt[]): DebtGroupResponse {
  return { person_name: personName, debt_type: debtType, debts };
}

describe('foldGroupsIntoPeople', () => {
  it('сворачивает встречные долги одного человека в нетто', () => {
    const result = foldGroupsIntoPeople(
      [
        group('Азиз', 'given', [makeDebt({ id: 'a', remaining_amount: 3000 })]),
        group('Азиз', 'taken', [makeDebt({ id: 'b', remaining_amount: 500, debt_type: 'taken' })]),
      ],
      identity,
    );

    expect(result).toHaveLength(1);
    expect(result[0].personName).toBe('Азиз');
    expect(result[0].net).toBe(2500);
    expect(result[0].direction).toBe('given');
    expect(result[0].debtCount).toBe(2);
  });

  it('даёт отрицательный нетто и направление taken, когда должен пользователь', () => {
    const result = foldGroupsIntoPeople(
      [group('Мадина', 'taken', [makeDebt({ debt_type: 'taken', remaining_amount: 1750 })])],
      identity,
    );

    expect(result[0].net).toBe(-1750);
    expect(result[0].direction).toBe('taken');
  });

  it('конвертирует валюты через переданный convert', () => {
    const convert = (amount: number, currency: string) => (currency === 'USD' ? amount * 12000 : amount);
    const result = foldGroupsIntoPeople(
      [group('Жасур', 'given', [makeDebt({ currency: 'USD', remaining_amount: 100 })])],
      convert,
    );

    expect(result[0].net).toBe(1_200_000);
  });

  it('считает дни просрочки по самому раннему просроченному долгу', () => {
    const past = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = foldGroupsIntoPeople(
      [group('Мадина', 'given', [makeDebt({ next_payment_date: past })])],
      identity,
    );

    expect(result[0].overdueDays).toBe(4);
    expect(result[0].nearestDueDate).toBe(past);
  });

  it('поднимает просроченных наверх, остальных сортирует по убыванию суммы', () => {
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = foldGroupsIntoPeople(
      [
        group('Богатый', 'given', [makeDebt({ id: 'x', remaining_amount: 9000 })]),
        group('Просрочивший', 'given', [makeDebt({ id: 'y', remaining_amount: 100, next_payment_date: past })]),
        group('Средний', 'given', [makeDebt({ id: 'z', remaining_amount: 5000 })]),
      ],
      identity,
    );

    expect(result.map((p) => p.personName)).toEqual(['Просрочивший', 'Богатый', 'Средний']);
  });

  it('помечает человека приватным, если хотя бы один долг скрыт', () => {
    const result = foldGroupsIntoPeople(
      [
        group('Азиз', 'given', [
          makeDebt({ id: 'a' }),
          makeDebt({ id: 'b', is_private: true }),
        ]),
      ],
      identity,
    );

    expect(result[0].hasPrivate).toBe(true);
  });

  it('не падает на пустом списке групп', () => {
    expect(foldGroupsIntoPeople([], identity)).toEqual([]);
  });
});
```

- [ ] **Step 2: Прогнать тесты — убедиться, что падают**

Run: `cd frontend && bun run test -- foldGroupsIntoPeople`
Expected: FAIL — модуль не существует.

- [ ] **Step 3: Реализовать функцию**

`frontend/src/entities/debt/lib/foldGroupsIntoPeople.ts`:

```typescript
import { isPastDate, daysBetween } from '@/shared/lib/date';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import type { Debt, DebtDirection, DebtGroupResponse } from '../model/types';

export interface PersonDebtSummary {
  personName: string;
  /** Нетто в валюте пользователя: > 0 — вам должны, < 0 — вы должны. */
  net: number;
  direction: DebtDirection;
  debts: Debt[];
  debtCount: number;
  nearestDueDate: string | null;
  overdueDays: number | null;
  hasPrivate: boolean;
}

/**
 * Сервер отдаёт группы по паре (человек, направление), поэтому встречные долги
 * одного человека приезжают двумя группами. Список показывает человека одной
 * строкой, значит группы надо сложить со знаком: «дал» плюсом, «взял» минусом.
 */
export function foldGroupsIntoPeople(
  groups: DebtGroupResponse[],
  convert: (amount: number, fromCurrency: string) => number,
): PersonDebtSummary[] {
  const byPerson = new Map<string, PersonDebtSummary>();

  for (const group of groups) {
    let person = byPerson.get(group.person_name);
    if (!person) {
      person = {
        personName: group.person_name,
        net: 0,
        direction: 'given',
        debts: [],
        debtCount: 0,
        nearestDueDate: null,
        overdueDays: null,
        hasPrivate: false,
      };
      byPerson.set(group.person_name, person);
    }

    for (const debt of group.debts) {
      const amount = convert(debt.remaining_amount, debt.currency || DEFAULT_CURRENCY);
      person.net += debt.debt_type === 'given' ? amount : -amount;
      person.debts.push(debt);
      person.debtCount += 1;
      if (debt.is_private) person.hasPrivate = true;

      if (debt.next_payment_date) {
        if (!person.nearestDueDate || debt.next_payment_date < person.nearestDueDate) {
          person.nearestDueDate = debt.next_payment_date;
        }
        if (isPastDate(debt.next_payment_date)) {
          const days = daysBetween(debt.next_payment_date, new Date().toISOString());
          person.overdueDays = Math.max(person.overdueDays ?? 0, days);
        }
      }
    }
  }

  const people = Array.from(byPerson.values());
  for (const person of people) {
    person.net = Math.round(person.net * 100) / 100;
    person.direction = person.net >= 0 ? 'given' : 'taken';
  }

  // Просроченные — вверх, дальше по величине долга: и то и другое про то,
  // о чём пользователю стоит подумать в первую очередь.
  return people.sort((a, b) => {
    if (a.overdueDays !== null && b.overdueDays === null) return -1;
    if (a.overdueDays === null && b.overdueDays !== null) return 1;
    if (a.overdueDays !== null && b.overdueDays !== null && a.overdueDays !== b.overdueDays) {
      return b.overdueDays - a.overdueDays;
    }
    return Math.abs(b.net) - Math.abs(a.net);
  });
}
```

Если в `@/shared/lib/date` нет `daysBetween` — посмотреть, какая функция считает разницу дат (`diffInDays`, `getDaysDiff`), и использовать её; если такой нет, посчитать инлайн: `Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000)`.

- [ ] **Step 4: Прогнать тесты**

Run: `cd frontend && bun run test -- foldGroupsIntoPeople`
Expected: PASS (7 тестов).

- [ ] **Step 5: Экспортировать из публичного API entity**

В `frontend/src/entities/debt/index.ts` добавить рядом с экспортом `groupDebtsByPerson`:

```typescript
export { foldGroupsIntoPeople, type PersonDebtSummary } from './lib/foldGroupsIntoPeople';
```

---

## Task 6: Frontend — компоненты списка (`DebtsSummaryCard`, `PersonDebtRow`)

**ВЫПОЛНЯТЬ СО СКИЛЛОМ `frontend-design`.**

**Files:**
- Create: `frontend/src/entities/debt/ui/DebtsSummaryCard.vue`
- Create: `frontend/src/entities/debt/ui/PersonDebtRow.vue`
- Modify: `frontend/src/entities/debt/index.ts`

**Interfaces:**
- Consumes: `PersonDebtSummary` из задачи 5; `formatCurrency`, `formatMasked` из `@/shared/lib/format/currency`; `getInitial` из `@/shared/lib/format/text`; `pluralize` из `@/shared/lib/format/pluralize`.
- Produces:
  - `<DebtsSummaryCard :total-given="number" :total-taken="number" :currency="string" />`
  - `<PersonDebtRow :person="PersonDebtSummary" :currency="string" :selected="boolean" @click />`

- [ ] **Step 1: Прочитать дизайн-систему**

Прочитать `frontend/DESIGN_SYSTEM.md` (разделы Color Palette, Typography, Border Radius) и `frontend/src/entities/debt/ui/DebtCard.vue` — чтобы новые компоненты попадали в существующий язык.

- [ ] **Step 2: Реализовать `DebtsSummaryCard.vue`**

Одна карточка вместо двух плиток. Требования:
- Заголовок-лейбл «Итог по всем» — `text-caption`, uppercase, `text-text-tertiary-*`.
- Нетто-число (`totalGiven - totalTaken`) — крупно (`text-h1`/`text-display`, `font-bold`, `tracking-tight`, `tabular-nums`), со знаком `+`/`−` и цветом `text-debt-given` при ≥ 0, `text-debt-received` при < 0.
- Под ним в две колонки: «Вам должны» / «Вы должны» с цветной точкой (`bg-debt-given` / `bg-debt-received`), значение `text-body-sm font-semibold`.
- Скруглять `rounded-2xl`, фон `bg-card-light dark:bg-card-dark`, рамка `border-border-light dark:border-border-dark`.
- Props: `totalGiven: number`, `totalTaken: number`, `currency: string`. Без эмитов.
- `data-testid="debts-summary"`, у нетто-числа `data-testid="debts-summary-net"`.

- [ ] **Step 3: Реализовать `PersonDebtRow.vue`**

Плоская строка человека — НЕ карточка. Требования:
- Корень — `<button type="button" class="w-full text-left ...">`, без собственной рамки; разделитель рисует родитель.
- Слева аватар 40×40 `rounded-full` с инициалом (`getInitial(person.personName)`), фон `bg-debt-given-light` / `bg-debt-received-light` и текст `text-debt-given` / `text-debt-received` по `person.direction`.
- Центр: имя (`text-body font-semibold`, `truncate`) и мета-строка (`text-caption text-text-tertiary-*`) по приоритету:
  1. `person.overdueDays !== null` → `просрочено ${overdueDays} ${pluralize(overdueDays, 'день', 'дня', 'дней')}` классом `text-danger`;
  2. `person.nearestDueDate` → `до ${formatDate(nearestDueDate, { format: 'short' })}`;
  3. `person.debtCount > 1` → `${debtCount} ${pluralize(debtCount, 'долг', 'долга', 'долгов')}`;
  4. иначе `без срока`.
- Справа: сумма `formatMasked(Math.abs(person.net), currency, person.hasPrivate)` — `text-body font-bold tabular-nums`, цвет по направлению; под ней подпись `должен вам` / `вы должны` (`text-caption-sm text-text-tertiary-*`).
- Состояния: `hover:bg-surface-light dark:hover:bg-surface-dark`, `active:scale-[0.99]`, `focus-visible:ring-2 focus-visible:ring-primary`.
- Проп `selected` добавляет `bg-surface-light dark:bg-surface-dark` (подсветка выбранного в master-detail на десктопе).
- `aria-label`: `${personName}, ${direction === 'given' ? 'должен вам' : 'вы должны'} ${сумма}`; при `hasPrivate` — без суммы.
- `data-testid="person-debt-row"`.

- [ ] **Step 4: Экспортировать компоненты**

В `frontend/src/entities/debt/index.ts` добавить экспорт `DebtsSummaryCard` и `PersonDebtRow` рядом с `DebtCard`.

- [ ] **Step 5: Проверить сборку и линт**

Run: `cd frontend && bun run build && bun run lint`
Expected: без ошибок.

---

## Task 7: Frontend — переработка списка долгов

**ВЫПОЛНЯТЬ СО СКИЛЛОМ `frontend-design`.**

**Files:**
- Modify: `frontend/src/pages/debts/list/useDebtsPageState.ts`
- Modify: `frontend/src/pages/debts/list/DebtsListPage.vue`
- Test: `frontend/src/pages/debts/list/DebtsListPage.spec.ts`

**Interfaces:**
- Consumes: `foldGroupsIntoPeople` (задача 5), `DebtsSummaryCard`, `PersonDebtRow` (задача 6).
- Produces: `useDebtsPageState()` дополнительно возвращает `people: ComputedRef<PersonDebtSummary[]>` и `handlePersonClick(person: PersonDebtSummary): void`.

- [ ] **Step 1: Прочитать существующие тесты страницы**

Прочитать `DebtsListPage.spec.ts` целиком — какие `data-testid` и тексты он ждёт. Тесты, проверяющие вложенные collapsible-группы, будут переписаны; тесты пустых состояний, фильтра валют и табов должны продолжать проходить.

- [ ] **Step 2: Добавить людей в состояние страницы**

В `useDebtsPageState.ts`:

```typescript
import { foldGroupsIntoPeople, type PersonDebtSummary } from '@/entities/debt';

  const people = computed(() => foldGroupsIntoPeople(filteredGroups.value, convert));

  /**
   * Один долг — открываем его сразу, иначе показываем долги человека через
   * серверный фильтр по имени: так исчезают вложенные раскрывашки в списке.
   */
  function handlePersonClick(person: PersonDebtSummary) {
    if (person.debts.length === 1) {
      handleDebtClick(person.debts[0]);
      return;
    }
    personFilter.value = person.personName;
    router.replace({ path: '/debts', query: { person: person.personName } });
  }
```

Добавить `people` и `handlePersonClick` в возвращаемый объект.

- [ ] **Step 3: Переписать разметку активной вкладки**

В `DebtsListPage.vue` заменить блок «Summary Cards» (строки 181-216) на:

```vue
              <DebtsSummaryCard
                v-if="allDebtsFromGroups.length > 0"
                :total-given="totalGivenDebts"
                :total-taken="totalTakenDebts"
                :currency="currency"
              />
```

Заменить блок «Groups by Person» (строки 253-353, включая `CollapsibleRoot`/`CollapsibleTrigger`/`CollapsibleContent`) на два взаимоисключающих режима:

```vue
                <!-- Без фильтра — по человеку на строку -->
                <div
                  v-if="!personFilter && people.length > 0"
                  class="divide-y divide-border-light dark:divide-border-dark rounded-2xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark overflow-hidden"
                >
                  <PersonDebtRow
                    v-for="person in people"
                    :key="person.personName"
                    :person="person"
                    :currency="currency"
                    :selected="isDesktop && person.debts.some((d) => d.id === selectedDebtId)"
                    @click="handlePersonClick(person)"
                  />
                </div>

                <!-- Фильтр по человеку — плоский список его долгов -->
                <div
                  v-else-if="personFilter && allDebtsFromGroups.length > 0"
                  class="space-y-2"
                >
                  <DebtCard
                    v-for="debt in allDebtsFromGroups"
                    :key="debt.id"
                    :debt="debt"
                    :class="
                      isDesktop &&
                      selectedDebtId === debt.id &&
                      'ring-2 ring-primary ring-offset-2 ring-offset-background-light dark:ring-offset-background-dark'
                    "
                    @click="(trigger('selection'), handleDebtClick(debt))"
                  />
                  <UButton
                    v-if="allDebtsFromGroups.length > 1"
                    variant="secondary"
                    size="md"
                    full-width
                    data-testid="close-all-btn"
                    @click="(trigger('selection'), openCloseAllForPerson(personFilter))"
                  >
                    <UIcon name="check_circle" size="sm" />
                    Закрыть все долги
                  </UButton>
                </div>
```

Условия пустых состояний ниже поменять с `groups.length === 0` на `people.length === 0`.

Заголовок секции (`SectionHeader`) оставить, но заменить `title` на `personFilter ? 'Долги: ' + personFilter : 'По людям'`.

- [ ] **Step 4: Убрать мёртвый код**

После замены удалить из `DebtsListPage.vue`:
- импорт `CollapsibleRoot, CollapsibleTrigger, CollapsibleContent` из `reka-ui`;
- импорты `DEBT_DIRECTION_DISPLAY`, `getInitial`, `pluralize`, `formatCurrency`, если они больше не используются в файле;
- блок `<style scoped>` с анимациями `CollapsibleContent` / `slideDown` / `slideUp`;
- старую кнопку «Закрыть все долги» для `personFilter` (строки 356-365) — её заменил блок из шага 3;
- `isGroupDefaultOpen` и `groupTotal` из деструктуризации `useDebtsPageState()`, а затем и из самого композабла, если больше нигде не нужны (проверить `grep -rn "groupTotal\|isGroupDefaultOpen" frontend/src`).

- [ ] **Step 5: Переписать вкладку закрытых долгов на плоский список**

Блок `statusFilter === 'closed'` оставить на `ClosedDebtCard`, но обернуть список в тот же контейнер с разделителями, что и люди:

```vue
                <div
                  class="divide-y divide-border-light dark:divide-border-dark rounded-2xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark overflow-hidden"
                >
```

и убрать у `ClosedDebtCard` собственную рамку через проп/класс, если она есть.

- [ ] **Step 6: Обновить тесты страницы**

В `DebtsListPage.spec.ts` заменить проверки collapsible-групп на проверки строк людей:

```typescript
  it('показывает одну строку на человека со свёрнутым нетто', async () => {
    // моки: Азиз given 3000 + Азиз taken 500
    const rows = wrapper.findAll('[data-testid="person-debt-row"]');
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain('Азиз');
    expect(rows[0].text()).toContain('2 500');
  });
```

Существующие проверки `data-testid="summary-given"` / `summary-taken` заменить на `data-testid="debts-summary-net"`.

- [ ] **Step 7: Прогнать тесты**

Run: `cd frontend && bun run test -- DebtsListPage`
Expected: PASS.

- [ ] **Step 8: Проверить руками**

Run: `bun run dev`, открыть `/debts`.
Expected: сводка одной карточкой; список — строки людей с разделителями; тап по человеку с одним долгом открывает долг, с несколькими — фильтр по человеку; кнопка сброса фильтра работает; на десктопе выбранная строка подсвечена и деталь открыта справа.

- [ ] **Step 9: Проверить сборку и линт**

Run: `cd frontend && bun run build && bun run lint`

---

## Task 8: Frontend — переработка детали долга

**ВЫПОЛНЯТЬ СО СКИЛЛОМ `frontend-design`.**

**Files:**
- Create: `frontend/src/entities/debt/ui/DebtHero.vue`
- Create: `frontend/src/entities/debt/ui/DebtAmountBreakdown.vue`
- Modify: `frontend/src/entities/debt/ui/DebtDetailContent.vue`
- Modify: `frontend/src/entities/debt/index.ts`
- Test: `frontend/src/pages/debts/detail/DebtDetailPage.spec.ts`

**Interfaces:**
- Consumes: `Debt` (уже с `fee_amount` из задачи 3), `getDebtProgress`, `getDebtDisplayName`, `DEBT_DIRECTION_LABELS` из `entities/debt/model/types`.
- Produces:
  - `<DebtHero :debt="Debt" />` — презентационный, без эмитов.
  - `<DebtAmountBreakdown :debt="Debt" />` — презентационный, без эмитов.
  - `DebtDetailContent` сохраняет текущий контракт: props `debt`, `transactions`, `accounts`, `transactionsLoading`; эмиты `payment`, `edit`, `delete`, `toggle-private`.

- [ ] **Step 1: Реализовать `DebtHero.vue`**

Требования:
- Аватар-инициал 56×56 `rounded-full`, цвета по направлению (`bg-debt-given-light` + `text-debt-given` / `bg-debt-received-light` + `text-debt-received`).
- Имя человека — `text-h2 font-bold`, под ним `DEBT_DIRECTION_LABELS[debt.debt_type]` — `text-body-sm text-text-secondary-*`.
- Остаток — крупно (`text-display`, `font-bold`, `tabular-nums`), через `formatMasked(debt.remaining_amount, debt.currency, debt.is_private)`.
- Бейдж справа сверху: `<UBadge variant="success">Погашен</UBadge>` при `is_closed`; `<UBadge variant="danger">Просрочено</UBadge>` при просрочке (`!is_closed && next_payment_date && isPastDate(next_payment_date)`).
- `UProgressBar` под суммой только если `!is_closed && remaining_amount < total_amount`, цвет `DEBT_DIRECTION_COLORS[debt.debt_type]`, подпись `Погашено N%`.
- Никакого тумблера приватности внутри hero.
- `data-testid="debt-hero"`.

- [ ] **Step 2: Реализовать `DebtAmountBreakdown.vue`**

Строки «лейбл — значение», `text-body-sm`, значения `tabular-nums font-medium`:
1. `Сумма долга` → `formatMasked(debt.total_amount, debt.currency, debt.is_private)`
2. `Комиссия за перевод` → `formatMasked(debt.fee_amount, …)` — **только если `debt.fee_amount > 0`**, значение `text-danger`
3. `Обошёлся в` → `formatMasked(debt.total_amount + debt.fee_amount, …)` — только если `debt.fee_amount > 0`, отделено верхней границей `border-t border-border-light dark:border-border-dark pt-2`
4. `Погашено` → `formatMasked(debt.total_amount - debt.remaining_amount, …)`, `text-success` — только если `remaining_amount < total_amount`
5. `Осталось` → `formatMasked(debt.remaining_amount, …)` — только если `!debt.is_closed`

Обёртка — `UCard variant="bordered" class="p-5 space-y-3"`. `data-testid="debt-breakdown"`, у строки комиссии `data-testid="debt-fee-row"`.

- [ ] **Step 3: Пересобрать `DebtDetailContent.vue`**

Новый порядок блоков в шаблоне:

```vue
<template>
  <div class="space-y-4">
    <DebtHero :debt="debt" />

    <!-- Действия сразу под hero: главное действие не должно ждать прокрутки -->
    <div v-if="!debt.is_closed" class="flex items-center gap-2">
      <UButton variant="primary" size="lg" class="flex-1" data-testid="payment-btn" @click="handlePayment">
        <UIcon name="payments" size="sm" class="mr-1.5" />
        Внести платёж
      </UButton>
      <UButton variant="secondary" size="lg" @click="handleEdit">
        <UIcon name="edit" size="sm" />
      </UButton>
      <UButton variant="ghost" size="lg" aria-label="Ещё" data-testid="debt-more-btn" @click="isMenuOpen = true">
        <UIcon name="more_horiz" size="sm" />
      </UButton>
    </div>

    <DebtAmountBreakdown :debt="debt" />

    <div v-if="debt.description" class="p-4 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl">
      <p class="text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark mb-1.5">Комментарий</p>
      <p class="text-sm text-text-primary-light dark:text-text-primary-dark">{{ debt.description }}</p>
    </div>

    <DebtPaymentTimeline :debt="debt" :transactions="transactions" :is-loading="transactionsLoading" />

    <!-- Технические детали — вторичны, поэтому внизу и мельче -->
    <UCard variant="bordered" class="p-5 space-y-3">
      <!-- Валюта, тип долга, счёт, дата возврата, дата создания — как в текущей
           реализации (строки 198-249), но лейблы text-caption text-text-tertiary-*
           и значения text-body-sm -->
    </UCard>

    <UButton v-if="debt.is_closed" variant="ghost" size="lg" full-width class="text-danger" @click="handleDelete">
      <UIcon name="delete" size="sm" class="mr-2" />
      Удалить долг
    </UButton>
  </div>
</template>
```

Меню «···» — `UModal`/`UDrawer` (взять тот компонент, который уже используется в проекте для action-sheet; посмотреть `frontend/src/shared/ui/index.ts`) с двумя пунктами:
- `Скрыть сумму` — `UToggle`, `:model-value="debt.is_private"`, `@update:model-value="handleTogglePrivate"` (тумблер переезжает сюда из главной карточки);
- `Удалить долг` — `text-danger`, `@click="handleDelete"`, `data-testid="delete-debt-btn"` (testid сохранить — на него смотрят тесты).

Состояние: `const isMenuOpen = ref(false);`

Из файла удалить: старую «Main Card» (строки 75-164), блок privacy-тумблера внутри неё, старый блок «Actions» (строки 252-288), неиспользуемые импорты (`IconBadge`, `UProgressBar`, `getDebtProgress`, `DEBT_DIRECTION_COLORS`, `formatMasked` — если после переноса они не нужны).

- [ ] **Step 4: Экспортировать новые компоненты**

В `frontend/src/entities/debt/index.ts` добавить `DebtHero` и `DebtAmountBreakdown`.

- [ ] **Step 5: Обновить тесты детали**

В `DebtDetailPage.spec.ts` добавить проверку комиссии:

```typescript
  it('показывает комиссию за перевод, когда она есть', async () => {
    // мок долга с fee_amount: 5000
    expect(wrapper.find('[data-testid="debt-fee-row"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="debt-breakdown"]').text()).toContain('5 000');
  });

  it('не показывает строку комиссии при нулевой комиссии', async () => {
    expect(wrapper.find('[data-testid="debt-fee-row"]').exists()).toBe(false);
  });
```

Существующие тесты, ищущие удаление через `data-testid="delete-debt-btn"`, поправить: сначала открыть меню кликом по `[data-testid="debt-more-btn"]`.

- [ ] **Step 6: Прогнать тесты**

Run: `cd frontend && bun run test -- DebtDetailPage`
Expected: PASS.

- [ ] **Step 7: Проверить руками**

Run: `bun run dev`, открыть долг с комиссией.
Expected: hero с именем и остатком; кнопки под ним; в разборе видно «Комиссия за перевод» и «Обошёлся в»; меню «···» скрывает сумму и удаляет долг.

- [ ] **Step 8: Проверить сборку и линт**

Run: `cd frontend && bun run build && bun run lint`

---

## Task 9: Changelog и финальная проверка

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

- [ ] **Step 1: Добавить запись в changelog**

Поднять `CURRENT_VERSION` с `1.0.63` на `1.0.64` и добавить запись **первой** в массив `CHANGELOG_ENTRIES`:

```typescript
  {
    version: '1.0.64',
    date: '2026-07-26',
    title: 'Комиссия за перевод и новый вид долгов',
    items: [
      {
        type: 'feature',
        text: 'При выдаче долга можно указать комиссию за перевод — она записывается отдельным расходом, а сумма долга остаётся прежней',
      },
      {
        type: 'improvement',
        text: 'Страница долгов перестроена вокруг людей: один человек — одна строка с общим итогом, вместо вложенных списков',
      },
      {
        type: 'improvement',
        text: 'На странице долга сверху главное — кто и сколько, а действия больше не надо искать внизу',
      },
    ],
  },
```

Формат записи сверить с соседними элементами массива.

- [ ] **Step 2: Прогнать все тесты**

Run: `cd backend && bun run test` и `cd frontend && bun run test`
Expected: PASS.

- [ ] **Step 3: Прогнать сборки**

Run: `cd backend && bun run build` и `cd frontend && bun run build`
Expected: без ошибок.

- [ ] **Step 4: Линт**

Run: `cd frontend && bun run lint` и `cd backend && bun run lint`
Expected: без ошибок.

- [ ] **Step 5: Ручной сквозной сценарий**

1. Создать долг «дал в долг» 1 000 000 UZS с комиссией 5 000.
2. Проверить: баланс счёта уменьшился на 1 005 000.
3. В истории транзакций — «Дал в долг» на 1 000 000 и «Комиссия за перевод» на 5 000.
4. В детали долга — «Комиссия за перевод 5 000», «Обошёлся в 1 005 000», остаток 1 000 000.
5. В списке долгов человек показан одной строкой.

---

## Self-Review

**Покрытие спеки:**
- Семантика «сверху» → Task 3 (payload) + Task 4 (подпись формы) + Task 8 (разбор суммы).
- Только `given` → Task 3 (сброс в модели) + Task 4 (`showFeeInput`).
- Серверная атомарная комиссия → Task 1.
- `debts.fee_amount` + миграция → Task 2.
- Транзакция комиссии не долговая (`isDebtRelated = false`, без `debtId`) → Task 1, Step 3.
- Список «люди в фокусе», нетто, сортировка, приватность → Task 5 + 6 + 7.
- Тап по человеку (1 долг → деталь, N → фильтр) → Task 7, Step 2.
- Деталь: hero → действия → разбор → таймлайн → детали, приватность в меню → Task 8.
- Changelog → Task 9.
- `UpdateDebtDto` не получает `feeAmount` — в плане нигде не добавляется, соответствует спеке.

**Типы согласованы:** `PersonDebtSummary` определён в Task 5 и потребляется в Task 6-7 с теми же полями (`personName`, `net`, `direction`, `debts`, `debtCount`, `nearestDueDate`, `overdueDays`, `hasPrivate`). `DebtFormData.fee` определён в Task 3, используется в Task 4. `debt.fee_amount` появляется в Task 3 и потребляется в Task 8.

**Риски, о которых должен знать исполнитель:**
- `daysBetween` в `@/shared/lib/date` может называться иначе — Task 5, Step 3 содержит фолбэк.
- Порядок аргументов у `CreateTransactionCommand`/`CreateDebtCommand` позиционный и длинный: перед написанием тестов сверять с файлом команды.
- Пары given/taken одного человека могут разъехаться по страницам курсора — до подгрузки человек покажется двумя строками. Это принятое поведение, не баг.
