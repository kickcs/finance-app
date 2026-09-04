# Кредитная карта: тип счёта, конвертация, шторка редактирования

**Дата:** 2026-09-04
**Бриф:** «продолжить реализацию кредитной карты, которая уже чуть-чуть заложена;
у человека уже может быть добавлен счёт, который был обычным и должен
соответствовать кредитному; полностью изменить дизайн редактирования счёта и
сделать его через Drawer». Объём согласован: базовое + минимальный платёж, без
расчёта срока грейса и кнопки «Погасить».

---

## 1. Что уже есть

Тип `credit_card` заведён насквозь и скрыт с февраля («после отладки»):

- Бэкенд: `AccountType` VO, агрегат `Account` с полями `creditLimit`,
  `gracePeriodDays`, `billingDay`, `monthlyPayment` и др.; колонки в `accounts`
  (миграция `1770891041300-AddAccountTypeFields`); DTO создания/обновления
  принимают все поля для любого типа. Корректировка баланса
  (`POST /transactions/adjust-balance`) принимает отрицательную цель.
- Фронтенд: `VISIBLE_ACCOUNT_TYPES = ['basic','savings','cash']` прячет тип;
  `AccountTypeFields` рисует лимит/грейс/день выписки; форма создания принимает
  долг положительным числом и хранит его со знаком минус
  (`useCreateAccount.ts`); блок «долг / доступно / лимит / прогресс» свёрстан
  дважды — в `AccountDetailPage.vue` и в `AccountDetailPanel.vue`.
- Итоги: дашборд, сайдбар и страница счетов суммируют сырые балансы (долг
  вычитается); аналитика считает `max(0, balance)` — расходится.
- В проде кредиток нет: 39 basic, 5 savings, 2 cash.

## 2. Решения

**Соглашение о балансе — как есть.** Баланс кредитки: отрицательный = задолженность,
положительный = собственные средства на карте, ноль = долга нет. `credit_limit` —
метаданные; «доступно» = лимит + баланс. Альтернатива «баланс = доступный остаток»
отвергнута: смена лимита банком меняла бы долг.

**Лимит — в первой валюте счёта.** У счёта один `credit_limit` на все валюты
(так уже в схеме). Метр и «доступно» показываются только для первой валюты;
остальные валюты — строкой «долг / свои средства» без метра.

**Минимальный платёж — колонка `monthly_payment`.** У кредита это «Ежемесячный
платёж», у карты — «Минимальный платёж». Миграции нет, бэкенд не меняется.

**Итог — чистый.** Долг по картам вычитается из «Общего баланса» везде;
аналитика приводится к тому же правилу. На странице счетов под итогом строка
«в т.ч. долг по картам −X», когда долг есть.

**Конвертация — через корректировку.** Существующий счёт переключается в
кредитку в шторке редактирования. Порядок: `PATCH /accounts/:id`, затем
`adjust-balance` до `−задолженность` по каждой валюте, где цель отличается от
текущего баланса. Корректировка — транзакция типа `adjustment` с описанием
«Перевод счёта в кредитную карту»; adjustment-ы в доходы/расходы не входят.
Порядок важен: если корректировка не дошла, у пользователя кредитка со старым
балансом и кнопка «Скорректировать баланс» на экране — видимо и починимо.
Обратный порядок оставил бы обычный счёт с минусом. Обратная конвертация
(кредитка → другой тип) баланс не трогает.

**Редактирование — шторка.** `EditAccountModal` (`UModal`) заменяется на
`EditAccountDrawer` (`UOverlay`, `desktop="panel"`), по образцу
`features/edit-debt/ui/EditDebtDrawer.vue` + `useEditDebt`.

## 3. Модель и хелперы (`entities/account`)

`model/creditCard.ts` — чистые функции, без Vue:

```ts
interface CreditCardState {
  debt: number;          // max(0, -balance)
  ownFunds: number;      // max(0, balance)
  limit: number | null;  // credit_limit
  available: number | null; // limit + balance, null без лимита
  utilization: number | null; // debt / limit в [0, 1], null без лимита или при limit = 0
}
getCreditCardState(account: Pick<Account,'credit_limit'>, balance: number): CreditCardState
isCreditCard(account: Pick<Account,'type'>): boolean
/** Предзаполнение долга при конвертации: лимит − баланс, если 0 < баланс < лимит, иначе 0. */
suggestDebtOnConversion(balance: number, limit: number | null): number
/** Сумма долга по всем кредиткам, по валютам. */
sumCreditCardDebtByCurrency(accounts: AccountWithBalances[]): Record<string, number>
```

`model/account-types.ts`: `VISIBLE_ACCOUNT_TYPES = ['basic','savings','cash','credit_card']`;
`ACCOUNT_TYPE_ICONS: Record<AccountType,string>` (`account_balance_wallet`,
`savings`, `payments`, `credit_card`, для loan/deposit — `account_balance`,
`diamond`).

## 4. UI

Направление — внутри существующей системы («фарфор + индиго», токены, `UCard`,
`UProgressBar`, `UOverlay`). Смелость тратится в одном месте на каждом экране;
остальное тихое.

### 4.1 `CreditCardSummary.vue` (`entities/account/ui`)

Один компонент вместо двух копий. Проп `account: AccountWithBalances`. Рендерит
блок на каждую валюту.

Первая валюта:

```
Задолженность                         ← подпись, secondary
2 350 000 сум                          ← герой, text-2xl, danger при долге > 0;
                                          «Долга нет» (primary text) при 0;
                                          при balance > 0: подпись «Свои средства», сумма success
[███████████░░░░░░░░░░░░░░░░░░]        ← метр использования лимита (UProgressBar):
                                          цвет — primary, danger при utilization > 0.8;
                                          только при limit > 0 и debt > 0
доступно 7 650 000        лимит 10 000 000   ← два конца дорожки, text-xs, tertiary
```

Без лимита: герой + тихая строка «Укажите лимит, чтобы видеть доступный остаток»
(без ссылки; редактирование рядом, в кнопке «Изменить»).

Параметры карты (ниже, только заданные) — сетка из трёх колонок, подпись над
значением, без разделителей-точек:

```
Мин. платёж        Грейс-период        День выписки
500 000 сум        55 дней             5-е число
```

Остальные валюты: строки как у обычного счёта (код валюты слева, сумма
справа), подпись под кодом — «долг» или «свои средства»; сумма долга — danger.

Используется в `AccountDetailPage.vue` (мобайл) и `AccountDetailPanel.vue`
(десктоп) вместо inline-блоков; карточка «Параметры кредитной карты» на
мобильной странице удаляется — параметры переезжают в summary.

### 4.2 `AccountCard.vue` (список)

Для кредитки правая колонка: первая строка — долг (`−2 350 000`, danger,
`COMPACT_FORMAT`) или `0` (tertiary), вторая строка — «доступно 7,65 млн»
(text-xs, tertiary) при лимите. Мультивалютный вид не меняется. Подпись типа
слева остаётся («Кредитная карта»).

### 4.3 Итог на странице счетов

Мобильный `AccountsPage.vue` и `desktop/AccountsDesktopPage.vue`: под «Общий
баланс» строка `в т.ч. долг по картам −X` (text-xs, danger), когда
`sumCreditCardDebtByCurrency` даёт ненулевой итог; X — сумма долгов в валюте
пользователя через `convert`. Логика в `useAccountsPage.ts` (`creditCardDebt`).

### 4.4 `AccountTypeSelector.vue` (`entities/account/ui`)

Общий выбор типа для формы создания и шторки: сетка 2×2, у каждого типа иконка
из `ACCOUNT_TYPE_ICONS` слева от подписи. Выбранный — `bg-primary text-white`,
остальные — `surface` + `border`. Пропы `modelValue`, `types?`
(по умолчанию `VISIBLE_ACCOUNT_TYPES`). `data-testid="account-type-{t}"`
сохраняется — на него опираются спеки.

### 4.5 `AccountTypeFields.vue` — кредитка

Порядок: «Кредитный лимит» (currency, на всю ширину) → сетка 2 колонки:
«Минимальный платёж» (currency, `monthlyPayment`) и «Грейс-период (дней)» →
«День выписки» (число 1–31). Loan/deposit — без изменений.

### 4.6 `EditAccountDrawer.vue` (`features/edit-account/ui`)

`UOverlay` с заголовком «Редактировать счёт», `desktop="panel"`. Подвал —
одна кнопка «Сохранить» (`size="xl"`, `full-width`, `:disabled="!isValid || !isDirty"`,
`:loading`). Отмена — крестик/свайп. Удаление остаётся на странице.

Содержимое сверху вниз (`space-y-5`):

1. **Живой предпросмотр** — памятный элемент шторки. Строка как в списке счетов:
   `IconBadge` в выбранном цвете с выбранной иконкой, имя (или «Без названия»
   tertiary), подпись типа. Обновляется по мере ввода — выбор цвета и иконки
   виден в контексте, а не по отдельности.
2. Название (`UInput`, ошибка как в создании: пробелы / <2 / >50).
3. Тип — `AccountTypeSelector`.
4. Поля типа — `AccountTypeFields`.
5. **Блок конвертации** — появляется только когда исходный тип ≠ `credit_card`,
   а выбранный = `credit_card`. Заголовок «Задолженность сейчас». На каждую валюту
   счёта — `UInput` (currency, суффикс валюты). Первая валюта предзаполняется
   `suggestDebtOnConversion(balance, limit)` и пересчитывается при смене лимита,
   пока пользователь не тронул поле сам; остальные — 0. Под полем одна строка
   `text-xs`: «На счёте 3 000 000 сум. Если это доступный остаток по карте,
   долг = лимит − остаток». Ниже — что произойдёт: «Баланс станет −2 000 000 сум,
   разница запишется корректировкой» (только если цель ≠ текущий баланс).
   Появление блока — короткий transition (motion в ответ на действие).
6. Иконка — `UIconSelector`; цвет — `UColorPicker`.

`isDirty` — сравнение с исходным счётом плюс непустая конвертация.

### 4.7 `useEditAccount.ts` / `useEditAccountForm.ts`

- `useEditAccountForm(account)` — состояние формы: `formData`, `isValid`,
  `isDirty`, `nameError`, `isConverting`, `debtByCurrency`, `updateField`,
  `setDebt`, `reset`, `buildUpdates(): Partial<Account>`.
- `useEditAccount(userId).update(accountId, updates, options?: { debtByCurrency })`
  — PATCH через `updateAccount`, затем для каждой валюты с
  `target = -debt ≠ текущий баланс` вызов `transactionsApi.adjustBalance`
  (`entities/transaction`, тот же, что в `useAdjustBalance`), затем
  `invalidateAccountRelated` + `invalidateTransactionRelated`. При падении
  корректировки — тост «Счёт переведён, но баланс не скорректирован» и `true`
  (счёт уже обновлён; пользователь чинит кнопкой на экране).

Вызовы в `AccountDetailPage.vue`, `useAccountsPage.ts`,
`AccountsDesktopPage.vue` переводятся с `EditAccountModal` на
`EditAccountDrawer`; `EditAccountModal.vue` и его спека удаляются.

### 4.8 Форма создания

`AccountForm.vue`: тип через `AccountTypeSelector`. Подпись баланса кредитки
«Текущая задолженность» / подсказка уже есть в локалях `features/create-account`;
новые строки, если появятся, — в `locales/{ru,en}.json` этого слайса. Прочие
затронутые слайсы (`edit-account`, `entities/account`, `pages/accounts`) не
локализованы — новые строки там остаются на русском, как у соседей.

## 5. Аналитика и демо

- `AnalyticsPage.vue`: `Math.max(0, b.balance)` → `b.balance`.
- `demoDataGenerator.ts` (фронт, анонимное демо) и
  `demo-initialization.service.ts` (бэкенд, демо-пользователь; имя — новый ключ
  `demo.accounts.creditCard` в бэкенд-локалях ru/en, спека сервиса
  проверяет вызовы `translate`): третий счёт
  «Кредитная карта» — `credit_card`, цвет `#f97316`, иконка `credit_card`,
  UZS `−2 350 000`, лимит `10 000 000`, мин. платёж `500 000`, грейс `55`,
  день выписки `5`. Демо-транзакции на него не вешаются.

## 6. Тесты (vitest, jsdom)

- `creditCard.spec.ts`: состояние (долг/свои/доступно/утилизация; без лимита;
  лимит 0), `suggestDebtOnConversion` (баланс в [0,limit) → limit−balance;
  отрицательный/выше лимита/без лимита → 0), сумма долгов по валютам.
- `AccountCard.spec.ts`: кредитка с долгом/без, «доступно» при лимите.
- `CreditCardSummary.spec.ts`: герой «Долга нет» / долг / свои средства, метр
  только при лимите и долге, danger > 80 %, параметры — только заданные.
- `EditAccountDrawer.spec.ts`: `vi.mock('vaul-vue', …vaulStub)`, поиск через
  `document.body`; блок конвертации появляется только при смене на кредитку с
  другого типа; предзаполнение и пересчёт при смене лимита; `Сохранить`
  выключена без изменений; `confirm` отдаёт `updates` + `debtByCurrency`.
- `useEditAccount.spec.ts`: порядок PATCH → adjust; adjust не зовётся при
  совпадении цели; падение adjust → `true` + тост.
- Правка существующих: `AccountForm.spec.ts` (видимые типы),
  `AccountDetailPage.spec.ts` (summary), `AccountsPage.spec.ts` (строка долга),
  `EditAccountModal.spec.ts` → удаляется.
- Ловушки: `renderWithProviders` создаёт свой QueryClient — оптимистичные
  правки singleton-а в тестах не видны; `UOverlay` телепортирует в `body`.

## 7. Выкатка

Ветка `feat/credit-card`. Changelog `1.0.86` (`feature`): «Кредитная карта:
лимит, долг и доступный остаток; обычный счёт можно превратить в кредитку;
редактирование счёта — в шторке». Затем `/code-review medium --fix`, PR в
`master` (`origin`), деплой по стандартному пайплайну.

## 8. Вне объёма

Срок беспроцентного периода («оплатить до»), кнопка «Погасить», напоминания,
типы `loan`/`deposit` (остаются скрытыми), проверка лимита при расходе
(банк сам откажет; приложение фиксирует факт), лимит на валюту.
