# Scan-Receipt Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Редизайн визарда сканирования чеков: HEIC, мульти-фото, ручной режим, понятные сборы/деление, упрощённые участники, «Платил не я», черновик, публичный шаринг ссылкой с OG-превью.

**Architecture:** Frontend — FSD-фича `features/scan-receipt` (Vue 3 + composables-шаги), новая фича `view-shared-receipt` + entity `payment-method`. Backend — расширение модуля `receipt` (мульти-OCR, shared_receipts, OG) + `payment_methods` в identity. Спека: `docs/superpowers/specs/2026-07-09-scan-receipt-redesign-design.md` — читать перед каждой задачей.

**Tech Stack:** Vue 3, TanStack Vue Query, Tailwind v4 (семантические токены), Reka UI/shared-ui, NestJS 11, TypeORM, sharp, heic-to, nanoid.

## Global Constraints

- Только семантические токены дизайн-системы (`bg-surface-light dark:bg-surface-dark` и т.п.), компоненты из `shared/ui`, хаптика `useHaptics`, reduced-motion уважать (см. существующие transition-стили фичи).
- Вся пользовательская копия — на русском, в тоне текущей фичи.
- TypeORM: новые ORM-сущности регистрировать в `backend/src/config/data-source.ts` И `app.module.ts`; только миграции, без synchronize.
- API-поля: backend camelCase → frontend snake_case трансформ в `*Api.ts` (для новых публичных эндпоинтов чека фронт использует camelCase payload как есть — это снапшот, не entity; но entity `payment-method` следует стандартному паттерну).
- Не коммитить ничего без явной просьбы пользователя (правило пользователя). Чекпоинты фиксировать галочками в этом файле.
- Тесты фронта: `cd frontend && bun run test -- --run <паттерн>` (vitest). Бэкенда: `cd backend && bun run test -- --testPathPattern=<pattern>`. Запуск тестов — через test-runner-субагента.
- Верификация фазы: `bun run build` в затронутом проекте.

---

## Phase A — HEIC + ошибки OCR

### Task 1: HEIC-детект и конвертация

**Files:**
- Create: `frontend/src/features/scan-receipt/model/imageFile.ts`
- Create: `frontend/src/features/scan-receipt/model/imageFile.spec.ts`
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step1PhotoCapture.vue` (processFile, toJpeg, валидация)
- Modify: `frontend/package.json` (deps: `heic-to`)

**Interfaces (Produces):**
```ts
// imageFile.ts
export function isHeicFile(file: File): boolean; // по type ИЛИ (пустой type + расширение .heic/.heif)
export function isAcceptableImage(file: File): boolean; // image/* ИЛИ isHeicFile
export async function ensureJpegDecodable(file: File): Promise<File>;
// ensureJpegDecodable: не-HEIC возвращает как есть; HEIC — пробует нативный decode
// (createImageBitmap → revoke), при ошибке лениво import('heic-to') → heicTo({blob, type:'image/jpeg', quality:0.9})
```

- [x] Тест на `isHeicFile`/`isAcceptableImage` (heic по type, heic по расширению с пустым type, jpeg, .txt) → red
- [x] Реализация `imageFile.ts` → green
- [x] `Step1PhotoCapture.processFile`: валидация через `isAcceptableImage` (сообщение об ошибке прежнее), перед `toJpeg` вызвать `ensureJpegDecodable`
- [x] `bun add heic-to` в frontend; проверить, что чанк ленивый (dynamic import)

### Task 2: Человечный оверлей ошибки OCR

**Files:**
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step1PhotoCapture.vue` (блок `ocrError`)
- Modify: `frontend/src/features/scan-receipt/model/usePhotoStep.ts` (разделить message/details)

**Interfaces (Produces):** `usePhotoStep` возвращает `ocrError: Ref<{ message: string; details: string } | null>` вместо строки; проп Step1 меняется соответственно (обновить ScanReceiptPage.vue передачу пропа).

- [x] `usePhotoStep`: ocrError = `{ message: 'Не получилось прочитать чек', details: '<msg> [type, KB]' }`
- [x] Оверлей: заголовок «Не получилось прочитать чек», подсказка «Попробуйте ярче свет или переснимите ближе», details — маленький toggle «Подробности» (нативный `<details>` стилизованный, text-caption white/40)
- [x] Прогнать существующий `useReceiptWizard.spec.ts` (ocrError используется?) и поправить типы

## Phase B — Шаг 2

### Task 3: Сверка суммы с итогом чека

**Files:**
- Modify: `frontend/src/features/scan-receipt/model/useItemsStep.ts` (ocrTotalAmount, mismatch, addDiffItem)
- Modify: `frontend/src/features/scan-receipt/model/useReceiptWizard.ts` (handleOcrResult сохраняет totalAmount; прокинуть в OcrResult из usePhotoStep — поле уже есть в ScanReceiptResponse)
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step2EditItems.vue` + `ScanReceiptPage.vue` (пропсы)
- Test: `frontend/src/features/scan-receipt/useReceiptWizard.spec.ts`

**Interfaces (Produces):**
```ts
// useItemsStep дополнительно возвращает:
ocrTotalAmount: Ref<number | null>;
totalMismatch: ComputedRef<{ diff: number } | null>; // null если |Δ|/ocr ≤ 0.01, ocrTotalAmount null, или dismissed
dismissMismatch(): void;
addDiffAsItem(): void; // item «Прочее», qty 1, unitPrice = diff (только diff > 0), очищает mismatch
```

- [x] Тесты: mismatch появляется при расхождении >1%, скрывается dismissMismatch, addDiffAsItem добавляет «Прочее» и обнуляет mismatch, отсутствие ocrTotalAmount → null → red → green
- [x] Warning-баннер в Step2 над TotalFooter (стиль как unassigned-warning шага 3: bg-warning/[0.08] border-warning/20), кнопки «Добавить разницу строкой» (diff>0) и «Скрыть»

### Task 4: Блок «Сборы и чаевые» + упрощение футера

**Files:**
- Create: `frontend/src/features/scan-receipt/ui/ChargesSection.vue`
- Create: `frontend/src/features/scan-receipt/ui/AddChargeSheet.vue`
- Modify: `frontend/src/features/scan-receipt/ui/TotalFooter.vue` (убрать управление сборами, оставить итоги + CTA + validation error)
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step2EditItems.vue`, `ScanReceiptPage.vue`
- Modify: `frontend/src/features/scan-receipt/model/useItemsStep.ts` (addCharge принимает amount-вариант)

**Interfaces:**
- Consumes: `charges: ReceiptCharge[]`, существующие emits визарда `toggleCharge/removeCharge/updateChargePercent/updateChargeAmount`
- Produces: emit `addCharge: [charge: { label: string; type: 'percent'; percent: number } | { label: string; type: 'amount'; amount: number }]` (изменить сигнатуру в wizard: `addCharge(input)`), UI-блок ChargesSection (строки: label, значение-инлайн-инпут, UToggle, удаление свайпом или иконкой), AddChargeSheet (UModal): пресеты «Обслуживание 10 %», «Чаевые», «Доставка» + кастом: имя + сегмент [%|сумма] + число.

- [x] Обновить `useItemsStep.addCharge` (объект вместо label+percent) + тесты на amount-сбор
- [x] ChargesSection после списка позиций (рендер и в empty-state НЕ показывать)
- [x] TotalFooter: только subtotal/charges/total + кнопка «Далее»; UI добавления сборов удалить
- [x] AddChargeSheet: пресеты + кастом, haptics selection при добавлении

### Task 5: Карточка позиции + sheet-редактор

**Files:**
- Create: `frontend/src/features/scan-receipt/ui/ItemEditorSheet.vue`
- Modify: `frontend/src/features/scan-receipt/ui/ReceiptItemRow.vue` (display-карточка: без инлайн-инпутов; название, qty × цена, итог, точки участников по assignedParticipantIds — цвета из participants prop опционально; тап → emit `edit`)
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step2EditItems.vue` (открытие sheet, Enter-flow внутри sheet)

**Interfaces:**
- ReceiptItemRow emits: `edit: []`, `delete: []`, `split: []` (свайпы и desktop-кнопки остаются)
- ItemEditorSheet props: `open`, `item: ReceiptItem | null`, `currency`; emits `update:open`, `save: [updates: Partial<ReceiptItem>]`, `delete: []`, `split: []`. Внутри: крупное поле названия, степпер qty (кнопки 44px), цена за единицу, итог строки (правка итога → unitPrice = total/qty, ocrTotalPrice сброс), автофокус названия при пустом.

- [x] ItemEditorSheet + подключение; валидация Step2 (validateAndNext) открывает sheet невалидной позиции
- [x] ReceiptItemRow упрощена; удалить focusField/focus-next механику со Step2 (Enter-навигация теперь внутри sheet)
- [x] Проверить TransitionGroup-анимации не сломаны

### Task 6: Новый sheet деления позиции

**Files:**
- Modify: `frontend/src/features/scan-receipt/ui/SplitItemModal.vue` → переработать в sheet (имя оставить)
- Modify: `frontend/src/features/scan-receipt/model/useItemsStep.ts` (`splitItem(id, firstQty)` остаётся; добавить `explodeItem(id)` — qty N → N строк по 1)
- Test: `useReceiptWizard.spec.ts`

**Interfaces (Produces):** `explodeItem(id: string): void` (целые qty 2..10; распределение ocrTotalPrice: поровну, последней строке — остаток); SplitItemModal emits `confirm: [firstQty: number]` и `explode: []`.

- [x] Тесты explodeItem (3 шт 54000 → 3×18000; ocrTotalPrice с остатком 100/3) → red → green
- [x] UI: заголовок-контекст, кнопка «По 1 шт на строку» (qty целое ≥2), кастом-степпер с живым превью двух строк, подсказка про совместные блюда (text-caption)

### Task 7: Undo удаления позиции

**Files:**
- Modify: `frontend/src/features/scan-receipt/model/useItemsStep.ts` (`deleteItem` возвращает `{ item, index }`), `useReceiptWizard.ts` (обёртка deleteItem: тост с restore)
- Test: `useReceiptWizard.spec.ts`

- [x] Тест: deleteItem → restoreItem возвращает на прежний индекс с назначениями → red → green
- [x] Тост `toast({ title: 'Позиция удалена', action: { label: 'Вернуть', onClick: restore } })` в useReceiptWizard (useToast из shared/ui)

## Phase C — Шаг 3

### Task 8: Sheet «Участники» — единое управление

**Files:**
- Create: `frontend/src/features/scan-receipt/ui/ManageParticipantsSheet.vue` (замена AddParticipantModal; старый файл удалить)
- Modify: `frontend/src/features/scan-receipt/ui/ParticipantsBar.vue` (только кисть + кнопка «Изменить»; убрать remove/assign-all из чипов)
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step3AssignParticipants.vue`, `ScanReceiptPage.vue`
- Modify: `frontend/src/features/scan-receipt/model/useParticipantsStep.ts` (`setPaidBy(id, paidById | null)`)

**Interfaces:**
- Consumes: `usePeople(userId)` из `@/entities/person` — подсказки контактов (нужен `userId` prop до фичи: прокинуть из ScanReceiptPage).
- Produces: ManageParticipantsSheet props `{ open, participants, hasMe, people }`, emits `update:open`, `add: [name: string, isMe: boolean]`, `remove: [id]`, `setPaidBy: [id, paidById | null]`. Строка участника: InitialAvatar, имя, селектор «Платит: сам / [участник]» (нативный select стилизованный или Reka DropdownMenu — по образцу TransactionFormSection), delete-иконка с confirm при наличии назначений.

- [x] `setPaidBy` в useParticipantsStep + тест (смена и сброс)
- [x] ManageParticipantsSheet: список, добавление (чип «Я», чипы контактов ≤8 шт. не-добавленных, поле имени + Enter)
- [x] ParticipantsBar: чипы-кисти + «Изменить»; пустое состояние шага открывает sheet сразу
- [x] Удалить AddParticipantModal.vue, вычистить импорты

### Task 9: «Как в прошлый раз»

**Files:**
- Create: `frontend/src/features/scan-receipt/model/useLastParty.ts`
- Modify: `frontend/src/features/scan-receipt/model/useSubmitStep.ts` (после isSuccess сохранить состав), `Step3AssignParticipants.vue` (чип при пустом списке)
- Test: `useReceiptWizard.spec.ts`

**Interfaces (Produces):**
```ts
// useLastParty.ts — useLocalStorage('scan-receipt:last-party', null)
export interface LastParty { names: { name: string; isMe: boolean; paidByName: string | null }[]; savedAt: number }
export function useLastParty(): { lastParty: Ref<LastParty | null>; saveParty(participants: Participant[]): void; };
```
Восстановление: пересоздать участников через addParticipant в порядке сохранения, paidBy связать по имени после создания всех.

- [x] Тест: saveParty → структура с paidByName; восстановление в визарде создаёт участников с paidById по имени → red → green
- [x] Чип «Как в прошлый раз: Вы, Аня, Тимур» (имена ≤3 + «+N») в empty-state шага 3

### Task 10: Быстрые действия шага 3

**Files:**
- Modify: `frontend/src/features/scan-receipt/model/useParticipantsStep.ts` (`assignAllToEveryone()`, `assignRestToMe()`)
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step3AssignParticipants.vue` (ряд кнопок, фильтр неназначенных, тапабельный warning)
- Modify: `frontend/src/features/scan-receipt/ui/AssignableItemRow.vue` (мини-чип «все» — toggle через ALL_PARTICIPANTS_ID, уже поддержан в toggleItemParticipant)
- Test: `useReceiptWizard.spec.ts`

- [x] Тесты assignAllToEveryone / assignRestToMe (без isMe — no-op) → red → green
- [x] UI: кнопки «Поровну на всех», «Остальное — на меня» (виден при hasMe && unassigned>0), чип-фильтр «Без участника (N)» (локальный ref showUnassignedOnly), warning в футере → включает фильтр

## Phase D — Шаг 4

### Task 11: «Кто платил»

**Files:**
- Modify: `frontend/src/features/scan-receipt/model/useSubmitStep.ts` (payerId, ветка сабмита), `useReceiptWizard.ts` (сброс payerId при удалении участника — в removeParticipant)
- Create: `frontend/src/features/scan-receipt/ui/PayerSelector.vue`
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step4Summary.vue`, `TransactionFormSection.vue` (скрытие категории), `CreateDebtsToggle.vue` (замена на инфо-карту при чужом плательщике), `ScanReceiptPage.vue`
- Test: `useReceiptWizard.spec.ts`

**Interfaces (Produces):**
```ts
payerId: Ref<string | null>; // null = Я
myShareTotal: ComputedRef<number>; // итог isMe-участника с учётом paidBy-переносов
// handleSubmit, ветка payerId != null && участник существует и !isMe:
//   транзакция НЕ создаётся; debtsApi.create({ debt_type: 'taken', person_name: payer.name,
//     total_amount: myShareTotal, name: `Чек: ${storeName}`, account_id, currency, ... })
//   идемпотентность: createdTakenDebt flag
// isFormValid для этой ветки: accountId && myShareTotal > 0 (categoryId не требуется)
// при importedId() != null селектор задизейблен на «Я»
```

- [x] Тесты: чужой плательщик → нет transactionsApi.create, один debts.create taken на myShareTotal; myShareTotal=0 → invalid; importedId → селектор «Я» → red → green (мокать transactionsApi/debtsApi как в существующем spec)
- [x] PayerSelector (чипы участников + «Я» по умолчанию) над TransactionFormSection; при чужом плательщике скрыть категорию и CreateDebtsToggle, показать инфо-карту «Будет создан долг: вы должны {X} — {sum}»
- [x] removeParticipant сбрасывает payerId

### Task 12: Полировка шага 4

**Files:**
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step4Summary.vue`, `TransactionFormSection.vue`

- [x] Секция «Параметры записи» с заголовком-uppercase (стиль «Кто сколько»), группировка формы и тумблера долгов; визуальный проход без изменения логики

## Phase E — Мульти-фото + ручной режим

### Task 13: Backend мульти-OCR

**Files:**
- Modify: `backend/src/modules/receipt/presentation/controllers/receipt.controller.ts` (`FilesInterceptor('image', 3)`)
- Modify: `backend/src/modules/receipt/application/services/receipt-ocr.service.ts` (`scanReceipt(files: { buffer: Buffer; mimetype: string }[])`, N image_url-частей, абзац в промпт про сегменты одного чека)
- Test: `backend/src/modules/receipt/application/services/receipt-ocr.service.spec.ts` (create)

- [x] Юнит: мокнутый openai — 2 файла → 2 image_url в user-content, промпт содержит инструкцию про сегменты; контракт ответа прежний → red → green
- [x] Контроллер: `@UploadedFiles()`, валидация 1..3, логика прежняя
- [x] `cd backend && bun run build` зелёный

### Task 14: Frontend мульти-фото + ручной режим

**Files:**
- Modify: `frontend/src/features/scan-receipt/model/usePhotoStep.ts` (`selectedFiles: File[]`, `previewUrls`, `addFile`, `removeFile(i)`, `scanReceipt()` шлёт все; убрать автостарт OCR)
- Modify: `frontend/src/features/scan-receipt/api/receiptApi.ts` (`scan(files: File[])` — formData.append('image', f) для каждого)
- Modify: `frontend/src/features/scan-receipt/ui/steps/Step1PhotoCapture.vue` (лента миниатюр + тайл добавления, primary «Распознать», кнопка «Ввести вручную» в idle)
- Modify: `frontend/src/features/scan-receipt/model/useReceiptWizard.ts` (`startManualMode()`: один пустой item, валюта из useUserCurrency — прокинуть из страницы; goNext), `ScanReceiptPage.vue`
- Test: `useReceiptWizard.spec.ts`

**Interfaces (Produces):** `startManualMode(defaultCurrency: string): void`; `manualMode: Ref<boolean>` (сверка суммы и «Переснять чек» в empty-state шага 2 не показываются в manual).

- [x] Тесты: startManualMode создаёт пустой item и шаг 2; multi-select добавляет до 3 файлов → red → green
- [x] UI превью: миниатюры 64px с крестиками, «+ Добавить кадр» (открывает выбор источника: камера/галерея — два скрытых input сохраняются), «Распознать N кадр(а)» primary
- [x] gallery input `multiple`; лимит 3 с тостом при превышении
- [x] Ctrl+V paste добавляет кадр (не заменяет)

## Phase F — Черновик

### Task 15: useReceiptDraft

**Files:**
- Create: `frontend/src/features/scan-receipt/model/useReceiptDraft.ts`
- Modify: `frontend/src/features/scan-receipt/model/useReceiptWizard.ts` (интеграция: snapshot/restore/clear), `ScanReceiptPage.vue` или Step1 (баннер «Продолжить прошлый чек?»)
- Test: `frontend/src/features/scan-receipt/useReceiptDraft.spec.ts` (create)

**Interfaces (Produces):**
```ts
export interface ReceiptDraft { v: 1; savedAt: number; step: number; items: ReceiptItem[]; currency: string;
  storeName: string | null; ocrTotalAmount: number | null; charges: ReceiptCharge[];
  participants: Participant[]; payerId: string | null; formData: ScanReceiptFormData; manualMode: boolean }
export function useReceiptDraft(): { draft: Ref<ReceiptDraft | null>; hasFreshDraft: ComputedRef<boolean>; // v===1 && <24h && items.length>0
  save(snapshot: Omit<ReceiptDraft,'v'|'savedAt'>): void; clear(): void }
```
Запись — `watchDebounced(..., 500)` в useReceiptWizard начиная с шага ≥2; clear при isSuccess и «Начать заново».

- [x] Тесты: save/restore round-trip, протухание 24ч, битый JSON → null, v≠1 → null → red → green
- [x] Баннер на шаге 1 (карточка над видоискателем): «Продолжить прошлый чек? · N позиций · Итого X» / «Продолжить» / «Начать заново»

## Phase G — Шаринг ссылкой

### Task 16: Backend shared_receipts + share/get эндпоинты

**Files:**
- Create: `backend/src/modules/receipt/infrastructure/persistence/typeorm/shared-receipt.orm-entity.ts`
- Create: `backend/src/modules/receipt/application/services/shared-receipt.service.ts`
- Create: `backend/src/modules/receipt/presentation/dto/share-receipt.dto.ts` (class-validator: вложенный payload с лимитами длин строк: имена ≤100, label/value реквизитов ≤50/≤100, participants ≤20, items на участника ≤100)
- Modify: `backend/src/modules/receipt/presentation/controllers/receipt.controller.ts` (POST share, GET shared/:token) — или отдельный `shared-receipt.controller.ts` (предпочтительно)
- Modify: `backend/src/modules/receipt/receipt.module.ts`, `backend/src/config/data-source.ts`, `backend/src/app.module.ts`
- Create: миграция `bun run migration:generate src/database/migrations/AddSharedReceipts`
- Modify: `backend/.env.example` (`PUBLIC_APP_URL`)
- Test: `backend/src/modules/receipt/application/services/shared-receipt.service.spec.ts`

**Interfaces (Produces):**
```ts
// POST /api/receipts/share (JWT) body: SharedReceiptPayloadDto → { token: string; url: string }
// url = `${PUBLIC_APP_URL}/r/${token}`; token = nanoid(21)
// GET /api/receipts/shared/:token (@Public()) → payload JSON | 404
interface SharedReceiptPayload { storeName: string | null; date: number; currency: string;
  totalAmount: number; subtotal: number; charges: { label: string; display: string }[];
  participants: { name: string; color: string; isMe: boolean; total: number; paidByName: string | null;
    items: { name: string; share: number; sharedWith: number; lineTotal: number }[] }[];
  paymentMethods: { label: string; value: string }[]; ownerName: string | null }
```
Хранение: Repository<SharedReceiptOrmEntity> напрямую в сервисе (фича инфраструктурная, полный DDD-цикл с агрегатом не нужен — по образцу ReceiptOcrService как application service; НО ormEntity + миграция обязательны).

- [x] Юнит сервиса (mock repository): create возвращает token/url, get 404 → red → green
- [x] Миграция сгенерирована и применена локально (`migration:run`)
- [x] `nanoid` в backend deps (v3 для CJS-совместимости NestJS — проверить) — решение: не добавляли nanoid, использован crypto-based `generateUrlSafeToken` (`shared/utils/token.ts`, randomBytes → base64url), избегая ESM-only проблем nanoid v5+ в CJS-сборке NestJS

### Task 17: OG-страница /r/:token + og.png

**Files:**
- Create: `backend/src/modules/receipt/presentation/controllers/share-page.controller.ts` (`@Controller('r')`, `@Public()`)
- Create: `backend/src/modules/receipt/application/services/og-image.service.ts` (SVG-шаблон → sharp → PNG, LRU/Map-кэш по token на 24ч)
- Modify: `backend/src/main.ts` (`setGlobalPrefix('api', { exclude: ['r/:token'] })`)
- Modify: `backend/package.json` (sharp)
- Test: `backend/src/modules/receipt/presentation/controllers/share-page.controller.spec.ts`

**Interfaces:**
- `GET /r/:token` → HTML: `og:title` «Чек из {store} — {total} {currency}», `og:description` «{N} участников · доли и реквизиты внутри», `og:image` `${PUBLIC_APP_URL_API}/api/receipts/shared/:token/og.png` (строить от PUBLIC_APP_URL), `og:url`, `twitter:card summary_large_image`, `<meta http-equiv="refresh" content="0;url={PUBLIC_APP_URL}/shared/{token}">` + `<script>location.replace(...)</script>`. 404 → простой HTML «Чек не найден».
- `GET /api/receipts/shared/:token/og.png` (в receipt/shared контроллере) → PNG 1200×630. SVG: тёмная карточка, storeName, дата, итог крупно, до 4 участников (имя + доля), «+N ещё». Все строки — экранировать (`&<>"'`).
- sharp упал → og.png 404, /r/:token рендерит OG без og:image.

- [x] Тест: HTML содержит экранированное имя (`<b>` в storeName → `&lt;b&gt;`), redirect-URL, 404-ветка → red → green
- [x] OG-image сервис + эндпоинт; ручная проверка PNG локально (сохранить в scratchpad, посмотреть)
- [x] main.ts exclude + `bun run build`

### Task 18: Backend payment_methods

**Files:**
- Create: `backend/src/modules/identity/infrastructure/persistence/typeorm/payment-method.orm-entity.ts`
- Create: `backend/src/modules/identity/presentation/controllers/payment-method.controller.ts` + dto
- Create: `backend/src/modules/identity/application/services/payment-method.service.ts`
- Modify: `identity.module.ts` (или где регистрируются контроллеры identity), `data-source.ts`, `app.module.ts`
- Create: миграция `AddPaymentMethods`
- Test: `payment-method.service.spec.ts`

**Interfaces (Produces):**
```ts
// GET /api/payment-methods (JWT) → { id, label, value, createdAt }[]
// POST /api/payment-methods { label: string(≤50), value: string(≤100) } → created; 400 при >10 у пользователя
// DELETE /api/payment-methods/:id (только своей) → 204
```

- [x] Юнит сервиса: лимит 10, удаление чужого → NotFound → red → green
- [x] Миграция применена; build зелёный

### Task 19: Frontend entity payment-method

**Files:**
- Create: `frontend/src/entities/payment-method/{index.ts, api/paymentMethodApi.ts, api/usePaymentMethods.ts, api/queryKeys.ts, model/types.ts}`

**Interfaces (Produces):** `usePaymentMethods(userId)` → `{ paymentMethods, isLoading, createPaymentMethod, deletePaymentMethod }` (Vue Query, паттерн как `entities/person/api/usePeople.ts` — читать его как образец).

- [x] Реализация по образцу usePeople (инвалидация своего ключа); type `PaymentMethod { id, label, value, created_at }` (snake_case трансформ)

### Task 20: Share-sheet на экране успеха

**Files:**
- Create: `frontend/src/features/scan-receipt/ui/ShareLinkSheet.vue`
- Create: `frontend/src/features/scan-receipt/model/useShareLink.ts` (построение payload из participantSummaries/charges/formData + POST)
- Modify: `frontend/src/features/scan-receipt/api/receiptApi.ts` (`share(payload) → { token, url }`)
- Modify: `frontend/src/features/scan-receipt/ui/SuccessOverlay.vue` (primary «Поделиться ссылкой»), `Step4Summary.vue`, `ScanReceiptPage.vue` (прокинуть userId/профиль для ownerName)

**Interfaces:**
- Consumes: `usePaymentMethods(userId)` (Task 19), `receiptApi.share` (Task 16), `useProfile` (ownerName = profile display name; допустим null).
- Produces: ShareLinkSheet: секция «Куда переводить» (чипы сохранённых карт-мультивыбор; форма добавления: label+value + UToggle «Сохранить для будущих чеков» выкл. по умолчанию, подпись «Реквизиты увидят все, у кого есть ссылка»), кнопка «Создать ссылку» → ссылка + «Копировать» (clipboard+toast) + navigator.share фолбэк-копия. Повторное открытие — готовая ссылка (createdUrl ref в useShareLink).

- [x] useShareLink: payload-маппинг (charges → display-строки через существующий formatChargeBadge-подобный хелпер — вынести в model/formatCharge.ts и переиспользовать в Step2), несохраняемые реквизиты идут только в payload
- [x] UI sheet + интеграция в SuccessOverlay

### Task 21: Публичная страница /shared/:token

**Files:**
- Create: `frontend/src/pages/shared-receipt/SharedReceiptPage.vue`
- Create: `frontend/src/features/view-shared-receipt/{index.ts, api/sharedReceiptApi.ts, ui/SharedReceiptCard.vue, ui/PaymentMethodsBlock.vue, ui/ParticipantBreakdown.vue}`
- Modify: `frontend/src/app/router/index.ts` (роут `{ path: '/shared/:token', name: SHARED_RECEIPT, meta: { public: true } }` — проверить, как guard обрабатывает public: читать router/index.ts; добавить обход auth), `frontend/src/shared/config/routeNames.ts`

**Interfaces:** `sharedReceiptApi.get(token)` — обычный fetch `${API_URL}/receipts/shared/${token}` без Authorization; типы = SharedReceiptPayload (camelCase, как отдаёт бэк).

- [x] Роут публичный (guard пропускает без сессии), состояния: skeleton → данные / 404-экран (NotFoundState из shared/ui) / ошибка сети с retry
- [x] Вёрстка: ReceiptTotalCard-подобная карточка (можно переиспользовать ReceiptTotalCard с пропсами), разбивка участников (read-only, раскрытие позиций по тапу), блок реквизитов с копированием (clipboard + toast + haptics), футер «Создано в Ouro» (взять реальное имя приложения из index.html/manifest — проверить) со ссылкой на `/`
- [x] Тёмная тема + мобильная ширина (max-w-md mx-auto)

### Task 22: Инфраструктура прод-роутинга

**Files:**
- Modify: nginx-конфиг фронтенда (найти: `frontend/nginx.conf` или в docker-compose.prod.yml volume) — `location /r/ { proxy_pass http://backend:3000; }` по образцу существующего `/api`
- Modify: `.github/workflows/deploy.yml` — `PUBLIC_APP_URL` в `env:` И `envs:`-whitelist; `docker-compose.prod.yml` — env для backend

- [x] Прочитать текущую прод-конфигурацию перед правкой; внести изменения зеркально существующему /api-паттерну

## Phase H — Финализация

### Task 23: Changelog + документация

- [x] `frontend/src/features/changelog/model/changelogData.ts` — patch-бамп, записи на русском (HEIC, мульти-фото, ручной режим, сборы суммой, деление по 1 шт, участники из контактов, «платил не я», ссылка на чек)
- [x] Корневой `CLAUDE.md`: share-эндпоинты в receipt-контекст, `payment-method` в entities/композаблы, `/shared/:token` в примечания — минимально
- [x] Спека: отметить статус «реализовано»

### Task 24: Полная верификация

- [x] `cd frontend && bun run build` (vue-tsc + vite) — зелёный
- [x] `cd backend && bun run build && bun run lint` — зелёный
- [x] Тесты фронт+бэк через test-runner-субагента — все зелёные
- [x] Ручной smoke: dev-сервер, пройти визард (мок-фото), открыть /shared/:token, /r/:token curl'ом проверить OG-теги
- [x] Итоговый отчёт пользователю: что сделано/не сделано, что проверено, известные ограничения
