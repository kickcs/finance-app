# Design Review: Dashboard (главная страница)

**Review ID:** dashboard_20260711
**Reviewed:** 2026-07-11
**Target:** `frontend/src/pages/dashboard/` + виджеты дашборда (`widgets/*`)
**Focus:** комплексный UI/UX (визуал, юзабилити, консистентность, a11y)
**Method:** чтение кода (30 файлов) + живой осмотр в Chrome (demo-режим, mobile 390px / desktop 1440px, light/dark, standard/compact)

## Summary

Дашборд архитектурно зрелый (widget order/visibility, compact-режим, skeleton'ы, PullToRefresh, haptics, дизайн-токены), но есть 2 критические проблемы (исчезающая нижняя навигация; дырявое маскирование сумм), сильный onboarding-шум для новых пользователей и разнобой empty-states/радиусов/шапок между виджетами standard-режима. Compact-режим — эталон консистентности (единые константы в `compact/constants.ts`), standard-режим до него не дотягивает.

**Issues:** 2 critical, 7 major, 8 minor.

---

## Critical

### C1. Нижняя навигация может полностью исчезнуть (воспроизведено)

**Location:** `frontend/src/app/layouts/ui/MainLayout.vue:93-112`, `shared/lib/composables/useNavbarStyle.ts`

В `MainLayout` рендер BottomNav: `v-if="navbarStyle === 'classic'"` / `v-else-if="navbarStyle === 'liquid-glass'"` — **нет ветки `v-else`**. В localStorage лежало легаси-значение `"classic"` **с JSON-кавычками** (двойная сериализация из старой версии кода); `useLocalStorage` со string-сериализатором читает его как `'"classic"'` → ни одна ветка не совпадает → на mobile нет вообще никакой навигации. Воспроизведено локально; у прод-пользователей со старым значением ключа `navbar-style` навигация отсутствует прямо сейчас.

**Fix:** нормализовать значение при чтении (strip кавычек / валидация по enum с fallback на дефолт) + заменить `v-else-if` на `v-else` (classic как fallback).

### C2. «Скрыть баланс» не скрывает суммы в половине виджетов

**Location:** `widgets/recent-transactions/RecentTransactions.vue`, `widgets/upcoming-subscriptions/UpcomingSubscriptions.vue`, `widgets/analytics/top-categories/TopCategories.vue`, `pages/dashboard/ui/DashboardTopExpenses.vue`

Глобальный privacy-режим (`isHidden`) работает в BalanceCard, AccountStack, DebtsSection, BudgetSection, и во **всех** compact-виджетах. Но в standard-режиме:
- `RecentTransactions` — prop `hidden` объявлен, но не используется (суммы транзакций всегда видны);
- `UpcomingSubscriptions` — prop `hidden` отсутствует вовсе;
- `TopCategories` — `formatCurrency` вместо `formatMasked`, prop нет (в `DashboardTopExpenses` при isHidden показывается «Данные скрыты» — но это на уровне карточки-обёртки, разный паттерн с compact).

Пользователь включает «глазик», показывает экран — а операции и подписки с суммами видны. Фича приватности не выполняет обещание на главном экране.

---

## Major

### M1. Onboarding-шум вытесняет данные за пределы первого экрана (mobile)

На первом экране нового пользователя: PWA-баннер (крупный) → BalanceCard → push-баннер → 4-6 пустых quick-action слотов → текст-подсказка про long-press → (через 1с) FeatureHint popover + DiscoveryDot на иконке настроек. Первый виджет с данными («Счета») начинается на ~1.5 экрана вниз. Три промо-механики конкурируют одновременно.

**Fix:** очередь promo-баннеров (максимум один одновременно, по приоритету); показывать push-баннер не в прайм-зоне между балансом и действиями, а ниже; hint-подсказки — только когда предыдущая закрыта.

### M2. Пустые quick actions выглядят как сломанная сетка

`DashboardQuickActions.vue` / `DashboardSidePanel`: если действия не настроены, рендерится 6 (desktop) / 4+ (mobile) одинаковых призрачных тайлов «+ Добавить» — на desktop это два ряда пустых карточек, занимающих верх side panel; в light-теме почти невидимы и читаются как незагрузившиеся skeleton'ы. Плюс в `DashboardCompactView.vue:43-47` условие `quickActionSlots.length > 0` не отсекает пустоту — slots содержат и пустые слоты-плейсхолдеры.

**Fix:** при 0 настроенных действий показывать один компактный CTA-тайл («Настроить быстрые действия»); пустые слоты показывать только рядом с уже настроенными.

### M3. Empty states — четыре разных паттерна в одном скролле

- Бюджет: крупный `EmptyState` (py-12) + dashed-рамка + CTA «Установить лимит расходов» ✅
- Подписки: голый центрированный текст «Нет активных подписок», без карточки, без иконки, без CTA — выглядит как дыра в layout;
- Долги: `EmptyState inline` без CTA;
- Счета/операции: `EmptyState` с CTA.

**Fix:** единый `EmptyState variant="inline"` + CTA во всех виджетах (у подписок — «Добавить подписку»).

### M4. FeatureHint «Настройте дашборд» появляется за пределами экрана + крадёт фокус

`DashboardPage.vue:48-62` показывает hint через 1с после маунта, но popover заякорен на кнопку «Настроить вид дашборда» **в самом низу страницы** — на mobile она вне вьюпорта, пользователь подсказку не видит. При этом (по a11y-снапшоту) фокус переносится на невидимую кнопку «Не показывать» — телепорт фокуса в никуда для клавиатурных/скринридер-пользователей.

**Fix:** якорить hint на иконку настроек в header (она видна всегда, там уже есть DiscoveryDot), либо показывать только когда якорь в вьюпорте (IntersectionObserver).

### M5. Иерархия BalanceCard размыта; на desktop баланс дублируется

В BalanceCard три числовых блока конкурируют: баланс, «средний расход» (оранжевый) и «безопасный остаток» (зелёный) — цветные метрики визуально кричат громче главного числа. На desktop общий баланс показан дважды на одном экране (сайдбар-карточка + BalanceCard), плюс обе ведут «к счетам».

**Fix:** приглушить метрики (меньше кегль, цвет только у значения-индикатора или точки-маркера); на desktop убрать дубль (в сайдбаре оставить компактную строку или вовсе убрать карточку).

### M6. Desktop: несбалансированная сетка → большая пустая зона

`DashboardStandardDesktop.vue`: `col-span-8` (баланс + операции) заканчивается сильно раньше `col-span-4` side panel (6 виджетов) → пустое поле в пол-экрана слева-снизу. Сетка не перестраивается на широких экранах (нет lg/xl-вариаций), side panel `sticky top-0` без верхнего отступа прилипает к краю.

**Fix:** дать операциям `h-full` растяжение уже есть — реально помогает перенос части виджетов (top expenses/budget) в левую колонку при коротком списке, либо 3-колоночный layout на xl. Sticky — `top-6`.

### M7. Console warning: `budget=""` (string) вместо Object|Null

Vue warning в проде-коде: `Invalid prop: type check failed for prop "budget"` — где-то API/composable отдаёт пустую строку при отсутствии бюджета. Симптом сырого контракта данных.

---

## Minor

1. **Радиусы/тени вразнобой (standard):** `rounded-2xl` (баланс, бюджет, top-categories UCard) vs `rounded-3xl` (hover-обёртки AccountStack/DebtsSection в side panel) vs `rounded-xl` (строки долгов); hover-lift (`hover:-translate-y-0.5 hover:shadow-md`) навешан inline-классами из родителя только части виджетов side panel — у соседей его нет.
2. **Шапки секций:** BudgetSection и TopCategories без `SectionHeader` (свои кастомные шапки со своей типографикой) — три разных стиля заголовков в одном скролле standard-режима.
3. **Иконки-кнопки без aria-label:** «+» в `SectionHeader` (add), крестик push-баннера — в a11y-дереве видны безымянные кнопки (uid без имени в снапшоте).
4. **Микротекст-кнопка** «Зарплата не 1-го? Настройте начало месяца» — 0.65rem, hit-area < 24px (WCAG 2.5.8), постоянно висит без возможности скрыть.
5. **TopCategories:** emit `category-click` объявлен, но не подключён (мёртвый API); нет собственного loading.
6. **Haptics/анимации только в DebtsSection** (TransitionGroup + useHaptics) — неровный полиш между виджетами standard-режима; compact-режим haptics использует шире.
7. **useStaggerAnimation** не уважает `prefers-reduced-motion`; задержки только 75/150/300 — виджеты ниже входят одной пачкой (duration-700 длинновато).
8. **AccountStackSkeleton** экспортируется, но не используется (мёртвый код); skeleton'ы части виджетов структурно не совпадают с реальной вёрсткой (баннер-шапки).

---

## Positive Observations

- **Compact-режим** — образцовый: единые `SECTION_*`-константы, консистентные радиусы/типографика/CTA в пустых состояниях, отличная плотность данных.
- Дизайн-токены соблюдаются везде (semantic light/dark пары), тёмная тема без провалов.
- Морфинг header'а greeting → sticky-баланс при скролле — приятный, с корректными `aria-hidden`.
- Настройка порядка/видимости виджетов + сохранение на бэкенде — сильная киллер-фича.
- Skeleton почти у всех виджетов, Suspense + async chunks для нижних виджетов, PullToRefresh, tabular-nums для сумм, `aria-pressed` на переключателе режима, tablist в долгах.
- Хорошая модель данных: `useDashboardData` с реактивной границей суток, financial period, multi-currency конверсия.

## Next Steps (по приоритету)

1. **C1** — fallback для BottomNav + нормализация `navbar-style` (риск прод-инцидента уже сейчас).
2. **C2** — довести маскирование `isHidden` до RecentTransactions / UpcomingSubscriptions / TopCategories.
3. **M1+M2** — очередь promo-баннеров + свернуть пустые quick actions в один CTA.
4. **M3** — унифицировать empty states (`EmptyState inline` + CTA везде).
5. **M4** — перевесить hint на видимый якорь.
6. **M5+M6** — иерархия BalanceCard, убрать дубль баланса, добалансировать desktop-сетку.
7. Пройтись по minor-списку (aria-label'ы, радиусы, SectionHeader).
