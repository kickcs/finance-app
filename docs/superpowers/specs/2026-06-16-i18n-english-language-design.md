# Дизайн: добавление английского языка (i18n)

**Дата:** 2026-06-16
**Статус:** утверждён к реализации

## Цель

Добавить в приложение второй язык (английский) при сохранении русского. Итоговый
артефакт сессии — **два связанных результата**:

1. **i18n-каркас** (ставится один раз, вручную, аккуратно): инфраструктура
   vue-i18n на фронте, nestjs-i18n на бэке, поле языка в профиле, определение и
   переключение языка, locale-aware форматтеры.
2. **Переиспользуемый workflow** (`.claude/workflows/i18n-extract-slice.js`),
   который покомпонентно (один FSD-слайс за прогон) извлекает ~2000–3000
   захардкоженных русских строк в словари и переводит их на английский.

Каркас — фундамент: он определяет, *куда* workflow складывает ключи и *как*
переключается язык. Поэтому каркас ставится **до** первого прогона workflow.

## Решения (зафиксированы при брейншторминге)

| Вопрос | Решение |
|---|---|
| Артефакт | Сначала каркас (вручную), потом workflow для строк |
| Scope | Фронт + бэк полностью |
| Дефолтные категории | Создаются на языке пользователя при регистрации (без миграции схемы категорий) |
| Дефолт языка | `navigator.language` → fallback `ru`; выбор персистится |
| Конфликт localStorage vs профиль при логине | **Профиль выигрывает** |
| Перевод строк | LLM (Sonnet draft) + glossary, дорогой ревьюер (Opus) вычитывает и сам правит |
| Граница прогона workflow | Один FSD-слайс/фича за прогон |
| Трекинг прогресса | Персистентный реестр `progress.md`, гранулярность = слайс + счётчики ключей; полный реестр строится разовым bootstrap-сканом |
| Организация ключей | Подход A — namespace зеркалит FSD-путь |
| API-ошибки (NestJS exceptions) | **Отложены** (вне scope этого этапа) |

## Текущее состояние кодовой базы (факты)

- **Frontend:** i18n-библиотеки нет. ~256 `.vue`, тексты захардкожены на русском
  повсюду. Крупные централизованные источники: `changelogData.ts` (~992 строки),
  `entities/category/model/constants.ts`, `entities/subscription/model/constants.ts`
  и ~8 других `constants.ts`. Поля языка в профиле нет.
- **Форматтеры готовы частично:** `shared/lib/format/currency.ts` и `date.ts`
  принимают `locale` параметром через кэш `intlCache.ts`. НО `formatRelativeDate`
  и `formatDateGroup` хардкодят `'ru-RU'` и русские слова («Сегодня», «Вчера»,
  «N дн. назад»).
- **`main.ts` (frontend)** чистый — точка `app.use(...)` для плагина i18n.
- **Backend:** i18n нет. ~70–100 локализуемых строк: дефолтные категории
  (`accounting/domain/constants/default-categories.ts` — у категорий есть
  **стабильный `id`** отдельно от `name`), demo-данные
  (`demo-initialization.service.ts`), push-уведомления (recurring-subscription
  handlers), telegram-бот (`telegram-bot.service.ts`). Поля языка в профиле нет.
- **`profile.entity.ts`** (backend) и `database.types.ts` (frontend) — поля
  `language`/`locale` отсутствуют.

---

## Секция 1 — Frontend i18n каркас

**Библиотека:** `vue-i18n@11`, Composition API mode (`legacy: false`).

**Структура (подход A — namespace = FSD-путь):**

```
frontend/src/shared/i18n/
  index.ts            // createI18n, сборка messages через import.meta.glob
  detectLocale.ts     // navigator.language → 'en' | 'ru', fallback 'ru'
  types.ts            // (опц.) типизация ключей для type-safe t()

// Словари co-located по слайсам, собираются централизованно:
src/shared/i18n/locales/shared/{ru,en}.json
src/features/<feature>/locales/{ru,en}.json
src/widgets/<widget>/locales/{ru,en}.json
src/pages/<page>/locales/{ru,en}.json
src/entities/<entity>/locales/{ru,en}.json
```

**Сборка messages:** `import.meta.glob('@/**/locales/*.json', { eager: true })`.
Namespace выводится из пути файла: `features/add-transaction/locales/ru.json` →
секция `features.addTransaction` в `messages.ru`. Один прогон workflow пишет
только в `locales/` своего слайса → **изоляция записи, нет конфликтов** при
параллельных/последовательных прогонах и в git.

**Ключи:** внутри файла слайса — плоские. Пример
`features/add-transaction/locales/ru.json`:
```json
{ "amountLabel": "Сумма", "save": "Сохранить" }
```
Использование в шаблоне: `$t('features.addTransaction.amountLabel')`.

**Инициализация (`main.ts`):** `app.use(i18n)`; стартовая локаль из
`detectLocale()`.

**Форматтеры:**
- `formatRelativeDate`, `formatDateGroup` перестают хардкодить русский — берут
  активную локаль из i18n и используют ключи (`shared.date.today`,
  `shared.date.yesterday`, `shared.date.daysAgo`, и т.п.).
- `formatDate` / `formatCurrency` уже параметризованы `locale` — прокидываем
  активную локаль (дефолт-параметр меняется с `'ru-RU'` на активную локаль или
  на вычисление из i18n).

**Реактивное переключение:** смена `i18n.global.locale` перерисовывает `$t()`
автоматически. Для дат/валют, отформатированных вне шаблона (в `script`),
оборачивать в `computed`, чтобы реагировали на смену языка.

---

## Секция 2 — Хранение и синхронизация выбора языка

**Frontend (источник правды до логина):**
- Composable `useLocale()` (singleton, по образцу `useAuth`):
  `locale` (ref), `setLocale(l)`, `availableLocales`.
- Персист: `useLocalStorage('locale', detectLocale())` (VueUse — по конвенции).
- `setLocale(l)` делает: пишет в localStorage → переключает
  `i18n.global.locale` → если залогинен, шлёт `PATCH /api/profile { language }`.

**Backend (источник правды для залогиненного + серверных текстов):**
Новое поле `language: 'ru' | 'en'` добавляется в:
- `profile.entity.ts` (domain) + ORM-entity + **миграция**
  (`language varchar(2) NOT NULL DEFAULT 'ru'`);
- `ProfileResponse` DTO + **все** хендлеры (get-profile, update-profile,
  create-demo-user) — по гайду CLAUDE.md «Profile fields»;
- `UpdateProfileDto` (валидация `@IsIn(['ru','en'])`).

При регистрации `language` приходит с фронта (из `detectLocale()`), сохраняется
в профиль и **используется при создании дефолтных категорий** на нужном языке.

**Определение языка на бэке для серверных операций:**
- Push / recurring-уведомления (фон, юзер оффлайн) → язык **из профиля**
  (`profile.language`).
- Telegram-бот: привязанный аккаунт → `profile.language`; непривязанный →
  Telegram `language_code`; fallback `'ru'`.

**Приоритет определения языка (фронт):** localStorage → профиль (после
`/auth/me`) → `navigator.language` → `'ru'`.

**Разрешение конфликта при логине:** если в localStorage `en`, а в профиле
`ru` — **профиль выигрывает** (это настройка пользователя на сервере), и
localStorage синхронизируется под профиль.

---

## Секция 3 — Backend локализация (nestjs-i18n)

**Библиотека:** `nestjs-i18n`.

```
backend/src/i18n/
  ru/
    categories.json    // ключи = id категорий: { "groceries": "Продукты", ... }
    demo.json          // demo-счета, описания транзакций, контакты, долги
    notifications.json // push title/body шаблоны
    telegram.json      // сообщения бота
  en/
    categories.json    // { "groceries": "Groceries", ... }
    demo.json
    notifications.json
    telegram.json
```

**Резолвинг языка (порядок резолверов):**
1. HTTP-запрос залогиненного юзера → кастомный резолвер из `profile.language`
   (через JWT/контекст);
2. fallback — заголовок `Accept-Language`;
3. fallback — `'ru'`.

**Дефолтные категории:** у категорий уже есть стабильный `id` (`groceries`,
`transport`, ...) отдельно от `name`. `InitializeDefaultCategoriesHandler`
получает `language` создаваемого юзера и резолвит имя через
`i18n.translate('categories.' + cat.id, { lang })`. Константы
`default-categories.ts` используют `id` как ключ (русский `name` остаётся как
fallback/дефолт). **Demo-данные** — аналогично через `demo.json`.

**Фоновые операции без HTTP-контекста (push/recurring):**
`I18nService.translate(key, { lang: profile.language })` — язык явно
прокидывается из профиля (нет request scope).

**Telegram-бот:** резолвим язык (профиль → `language_code` → `'ru'`), переводим
через `telegram.json`.

**API-ошибки (NestJS exceptions):** **отложены** (вне scope). Они технические,
редко видны юзеру; их локализация требует i18n во всех `throw` по всем модулям —
отдельная задача.

---

## Секция 4 — Workflow экстракции строк

**Файл:** `.claude/workflows/i18n-extract-slice.js` (по образцу
`mobile-port-page.js`). Один FSD-слайс за прогон, `args` = путь слайса
(напр. `features/add-transaction`). **Без коммита.**

**Раскладка по моделям** (`opts.model` в каждом `agent()`):

| Фаза | Модель | Почему |
|---|---|---|
| Scan | Sonnet | Механический поиск строк по паттернам |
| Extract | Sonnet | Замена строк на `$t()`, генерация `ru.json` |
| Translate (draft) | Sonnet | Черновой перевод; качество гарантирует ревью |
| Review — tech | Opus | Контроль: компиляция, ключи, импорты; сам правит код |
| Review — translation | Opus | Вычитка en; **сам правит** `en.json` (тон, термины, длина) |

> Sonnet делает объёмную рутину; Opus выносит вердикт и сам правит. Цикл
> «до зелёного»: даже ошибки Sonnet ловит и исправляет Opus-ревьюер.
> (По правилу проекта Haiku не используется.)

**Фазы прогона:**

1. **Scan** (Sonnet) — найти все захардкоженные русские строки в слайсе
   (`.vue` шаблоны, `script setup`, `constants.ts`, тосты, `label`/
   `placeholder`/`title`). Вернуть `{ file, line, text, suggestedKey, context }`.
   Отсечь не-локализуемое (имена иконок, технические enum, ключи API/query).

2. **Extract** (Sonnet) — заменить строки на `$t('<ns>.<key>')` (шаблоны) /
   `t(...)` из `useI18n()` (script); создать `locales/ru.json` слайса с
   оригиналами; namespace из пути.

3. **Translate** (Sonnet) — перевести `ru.json` → `en.json` с **glossary**
   (финтех-словарь: «Счёт»→«Account», «Долг»→«Debt», «Перевод»→«Transfer»…) для
   консистентности терминов между прогонами.

4. **Review** (Opus, цикл до зелёного). Порядок важен: tech-gate проходит
   **первым** — нет смысла вычитывать перевод для сломанной экстракции.
   - *tech-review* (gate): типы/компиляция не сломаны, все ключи существуют,
     нет осиротевших `$t`, `useI18n` импортирован где нужно, `bun run build`
     зелёный. Сам правит код при поломке. Пока не зелёный — translation-review
     не запускается.
   - *translation-review* (после зелёного tech-gate): вычитка en — тон, термины
     по glossary, длина (не ломает UI), плейсхолдеры (`{amount}`) сохранены.
     **Сам правит** `en.json`.

5. **Report** — что извлечено, сколько ключей, что осталось `needs_human`.

### Трекинг прогресса (что переведено / что осталось)

Workflow ведёт персистентный реестр прогресса, который **читает на входе** и
**обновляет на выходе** каждого прогона. Это явное требование: в любой момент
видно, что уже переведено и что осталось.

**Bootstrap (разовый, до первого прогона переноса):**
Отдельный шаг сканирует `frontend/src`, строит **полный реестр всех слайсов**
(features / widgets / pages / entities / shared) со статусом `pending` и грубой
оценкой числа локализуемых строк в каждом. Это даёт честный знаменатель
«осталось N из M слайсов» с первого дня. Реестр строится один раз; дальнейшие
прогоны только обновляют свою строку, не пересканируя всё.

**Файл реестра:** `docs/features/i18n/progress.md` — Markdown-таблица, по строке
на слайс, гранулярность = слайс + счётчики ключей:

| Слайс | Статус | Ключей найдено | Извлечено | Переведено (en) | needs_human | Прогон от |
|---|---|---|---|---|---|---|
| features/add-transaction | done | 42 | 42 | 42 | 0 | 2026-06-17 |
| features/split-expense | partial | 31 | 31 | 24 | 7 | 2026-06-18 |
| widgets/balance-card | pending | ~8 | 0 | 0 | 0 | — |

- **Статус:** `pending` (не начат) / `partial` (есть `needs_human`-остаток) /
  `done` (все ключи извлечены и переведены, `needs_human` = 0).
- **Счётчики:** «Ключей найдено» фиксируется на Scan; «Извлечено» — после
  Extract; «Переведено» — после Review; «needs_human» — строки, отложенные на
  ручную доработку (плюрализация, неоднозначная интерполяция).
- Шапка файла содержит **сводку**: `Слайсов: X done / Y partial / Z pending из
  N`, обновляется каждым прогоном.

**Поток данных каждого прогона:**
1. На входе прочитать `progress.md`; найти строку целевого слайса (если её нет —
   ошибка: запустить bootstrap). Прочитать `glossary.md`.
2. Выполнить Scan → Extract → Translate → Review.
3. На выходе обновить строку слайса (статус, счётчики, дата прогона) и сводку в
   шапке. Дописать новые термины в `glossary.md`.

**Файл глоссария:** `docs/features/i18n/glossary.md` — финтех-словарь
(ru→en терминов), растёт от прогона к прогону, читается каждым прогоном для
консистентности перевода между слайсами.

**Возобновляемость:** `progress.md` — единственный источник правды о прогрессе;
прогоны идемпотентны по слайсу (повторный прогон `done`-слайса перепроверяет, не
дублирует). Слайсы со статусом `partial` видны явно и могут быть до-обработаны
после ручного разбора `needs_human`.

**Что workflow НЕ делает:**
- не трогает каркас (стоит до первого прогона);
- не коммитит;
- не переводит бэкенд (бэк — разовый ручной шаг в рамках каркаса, строк мало).

**Плюрализация/интерполяция:** vue-i18n поддерживает `t('key', { n })` и `|`
для plural. Workflow помечает такие строки `needs_human`, если не уверен
(русская плюрализация — «1 транзакция / 2 транзакции / 5 транзакций» — капризна
и требует ручной проверки форм).

---

## Порядок реализации (высокоуровнево)

1. **Backend каркас:** nestjs-i18n + поле `language` в профиле (entity, ORM,
   миграция, DTO, все хендлеры) + резолвер + словари `ru/en` (категории, demo,
   notifications, telegram) + локализация дефолтных категорий при регистрации.
2. **Frontend каркас:** vue-i18n + `useLocale()` + `detectLocale()` +
   синхронизация с профилем + правка форматтеров + переключатель языка в
   профиле + поле `language` в `database.types.ts` и профильном API.
3. **Workflow:** `i18n-extract-slice.js` + glossary + progress-трекер.
4. **Прогоны workflow:** по одному FSD-слайсу, начиная с самых заметных
   (dashboard, add-transaction, profile), до покрытия всего фронта.

## Явные deferrals

- Локализация API-ошибок (NestJS exceptions) — отдельная задача.
- `changelogData.ts` (~992 строки) — историю менять не нужно; обсудить при
  планировании, локализовать ли её вообще или оставить на языке оригинала записи.

## Критерии успеха

- Переключение языка в профиле мгновенно меняет весь UI обработанных слайсов.
- Новый англоязычный юзер при регистрации получает английские дефолтные
  категории и английские push/telegram-уведомления.
- Форматирование дат/чисел/валют корректно для активной локали.
- `bun run build` (фронт и бэк) зелёный после каждого прогона workflow.
