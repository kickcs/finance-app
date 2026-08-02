# Веб-версия, этап 1: фундамент + Главная + Счета + Новая операция

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Развести мобильную и десктопную отрисовку по отдельным компонентам с единой границей 1024 px и собрать десктопные Главную, Счета и Новую операцию.

**Architecture:** Слой платформы (`shared/lib/platform`) даёт единственный признак десктопа и резолвер `platformPage`, который лениво подставляет мобильный или десктопный компонент в роутер. Оболочка распадается на `MobileLayout` / `DesktopLayout`. Логика страниц живёт в общем `model/`-слое, разметка — в двух непересекающихся SFC.

**Tech Stack:** Vue 3.5 (script setup), TypeScript, Vue Router 4, TanStack Vue Query, Tailwind v4 (`@theme` в `src/app/styles/index.css`), Reka UI, vaul-vue, VueUse 14, Vitest + @vue/test-utils (jsdom), Bun.

**Спека:** `docs/superpowers/specs/2026-07-31-web-desktop-adaptation-design.md`

## Global Constraints

- Все команды выполняются из `frontend/`.
- **Порог десктопа — ровно 1024 px.** Никаких других порогов в новом коде: ни `md:` для платформенного ветвления, ни локальных `useMediaQuery`.
- **Коммиты — только по явной команде пользователя** (правило проекта «No auto-commits»). Последний шаг каждой задачи — проверка, а не коммит. Отступление от шаблона writing-plans сделано осознанно.
- **Бюджет стартового бандла 250 КБ gzip**, текущий расход 236.4 КБ. Проверка: `bun run build && bun run check:bundle`. Десктопные страницы подключаются только через `defineAsyncComponent`; из `App.vue` и `router/index.ts` нельзя тянуть barrel `@/shared/ui`.
- **Мобильные SFC не переписываются** — из них только снимаются десктопные ветки. Существующие тесты обязаны остаться зелёными, в том числе `src/pages/dashboard/DashboardPage.spec.ts` (752 строки).
- **Дизайн-токены только из системы**: `bg-surface-light dark:bg-surface-dark`, `text-body-sm`, `rounded-2xl` и т. п. Сырые цвета Tailwind (`bg-zinc-800`) запрещены.
- **Динамические классы — через `cn()`** из `@/shared/lib/utils`.
- **Иконки** — `<UIcon name="material_symbol_name" />`; новой иконке нужна запись в `src/shared/ui/icon/iconMap.ts`.
- Тест, который открывает или закрывает vaul-шторку, обязан подключать стаб: `vi.mock('vaul-vue', () => import('@/test/stubs/vaul'))`.
- Проверка после каждой задачи: `bun run test -- <файлы задачи>`, `bun run lint`, `bunx vue-tsc -b`.

---

## Карта файлов

**Создаются:**

| Файл | Ответственность |
|---|---|
| `src/shared/lib/platform/useIsDesktop.ts` | единственный признак десктопа + порог + подмена для тестов |
| `src/shared/lib/platform/platformPage.ts` | резолвер компонента по платформе для роутера |
| `src/shared/lib/platform/index.ts` | точечный barrel слоя платформы |
| `src/app/layouts/ui/AppShell.vue` | общее для обеих оболочек: skip-link, RouterView, Transition |
| `src/app/layouts/ui/MobileLayout.vue` | оболочка телефона: BottomNav, FULLSCREEN_FLOWS |
| `src/app/layouts/ui/DesktopLayout.vue` | оболочка веба: SidebarNav, слой модальных маршрутов |
| `src/shared/ui/desktop-page/DesktopPage.vue` | шапка страницы + скроллируемая область, max-w 1440 |
| `src/shared/ui/desktop-page/DesktopColumns.vue` | сетка 12 колонок с именованными слотами |
| `src/shared/ui/overlay/UOverlay.vue` | mobile: bottom sheet; desktop: panel \| dialog |
| `src/shared/ui/overlay/OverlayHeader.vue` | шапка оверлея |
| `src/pages/dashboard/model/useDashboardPage.ts` | вся логика Главной, общая для двух SFC |
| `src/pages/dashboard/ui/DashboardModals.vue` | четыре модалки Главной, общие для двух SFC |
| `src/pages/dashboard/desktop/DashboardDesktopPage.vue` | десктопная Главная |
| `src/pages/dashboard/desktop/DashboardDesktopHeader.vue` | шапка десктопной Главной |
| `src/pages/dashboard/desktop/DashboardDesktopSidePanel.vue` | правая колонка |
| `src/pages/accounts/model/useAccountsPage.ts` | логика списка счетов, общая |
| `src/pages/accounts/desktop/AccountsDesktopPage.vue` | десктопные счета, выбор через URL |
| `src/pages/transactions/new/desktop/AddTransactionDesktopPage.vue` | форма операции в модалке |

**Изменяются:**

| Файл | Что меняется |
|---|---|
| `src/shared/lib/composables/useIsDesktop.ts` | превращается в реэкспорт нового модуля |
| `src/app/router/index.ts` | `platformPage`/`platformLayout` на роутах, `prefetchPages` по платформам, `meta.desktopOverlay` |
| `src/pages/dashboard/DashboardPage.vue` | худеет до мобильной разметки на `useDashboardPage` |
| `src/pages/dashboard/ui/DashboardActivityColumn.vue` | снимаются `md:hidden`-ветки |
| `src/pages/dashboard/ui/DashboardMobileHeader.vue` | снимается обёртка `md:hidden` |
| `src/pages/accounts/AccountsPage.vue` | снимается `MasterDetailLayout`, остаётся мобильный список |
| `src/entities/category/ui/CategoryPickerSheet.vue` | переезд на `UOverlay` |
| `src/entities/account/ui/AccountPickerSheet.vue` | переезд на `UOverlay` |
| `src/entities/person/ui/PersonPickerSheet.vue` | переезд на `UOverlay` |
| `src/features/split-expense/ui/SplitExpenseDrawer.vue` | переезд на `UOverlay` |
| `DESIGN_SYSTEM.md` | раздел про десктоп, исправление описания `UModal` |
| `src/features/changelog/model/changelogData.ts` | новая запись |

**Удаляются:** `src/pages/dashboard/ui/DashboardStandardLayout.vue`, `DashboardStandardDesktop.vue`, `DashboardSidePanel.vue`, `src/app/layouts/ui/MainLayout.vue`.

---

### Task 1: Слой платформы — `useIsDesktop`

**Files:**
- Create: `src/shared/lib/platform/useIsDesktop.ts`
- Create: `src/shared/lib/platform/index.ts`
- Modify: `src/shared/lib/composables/useIsDesktop.ts`
- Test: `src/shared/lib/platform/useIsDesktop.spec.ts`

**Interfaces:**
- Consumes: ничего.
- Produces: `DESKTOP_MIN_WIDTH: 1024`, `useIsDesktop(): Ref<boolean>`, `setIsDesktopForTests(value: boolean | null): void`.

**Зачем переписываем.** Текущая версия (`shared/lib/composables/useIsDesktop.ts`, 11 строк) кэширует `useMediaQuery` в module-переменной. `useMediaQuery` из VueUse вешает слушатель через `useEventListener`, привязанный к **текущему effect scope** — то есть к `setup()` того компонента, который вызвал функцию первым. Когда этот компонент размонтируется, слушатель снимается, а закэшированный `ref` остаётся жить с застывшим значением.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/shared/lib/platform/useIsDesktop.spec.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';

type Listener = (e: { matches: boolean }) => void;

let listeners: Listener[] = [];
let currentMatches = false;

function installMatchMedia() {
  listeners = [];
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: currentMatches,
    media: query,
    addEventListener: (_: string, cb: Listener) => listeners.push(cb),
    removeEventListener: (_: string, cb: Listener) => {
      listeners = listeners.filter((l) => l !== cb);
    },
  }));
}

function emitChange(matches: boolean) {
  currentMatches = matches;
  listeners.forEach((cb) => cb({ matches }));
}

describe('useIsDesktop', () => {
  beforeEach(() => {
    currentMatches = false;
    installMatchMedia();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('порог равен 1024 пикселям', async () => {
    const { DESKTOP_MIN_WIDTH } = await import('./useIsDesktop');
    expect(DESKTOP_MIN_WIDTH).toBe(1024);
  });

  it('переживает размонтирование компонента, который вызвал его первым', async () => {
    const { useIsDesktop } = await import('./useIsDesktop');

    const First = defineComponent({
      setup() {
        useIsDesktop();
        return () => h('div');
      },
    });

    const first = mount(First);
    first.unmount();

    const isDesktop = useIsDesktop();
    emitChange(true);
    await nextTick();

    expect(isDesktop.value).toBe(true);
  });

  it('setIsDesktopForTests подменяет значение и снимается через null', async () => {
    const { useIsDesktop, setIsDesktopForTests } = await import('./useIsDesktop');

    setIsDesktopForTests(true);
    expect(useIsDesktop().value).toBe(true);

    setIsDesktopForTests(false);
    expect(useIsDesktop().value).toBe(false);

    setIsDesktopForTests(null);
    expect(useIsDesktop().value).toBe(false);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Запустить: `bun run test -- src/shared/lib/platform/useIsDesktop.spec.ts`
Ожидаемо: FAIL — модуль `./useIsDesktop` не существует.

- [ ] **Step 3: Реализовать модуль**

```ts
// src/shared/lib/platform/useIsDesktop.ts
import { ref, type Ref } from 'vue';

/** Единственная граница между мобильной и десктопной версией приложения. */
export const DESKTOP_MIN_WIDTH = 1024;

const MEDIA_QUERY = `(min-width: ${DESKTOP_MIN_WIDTH}px)`;

/**
 * Состояние заводится вне какого-либо effect scope и живёт весь сеанс.
 *
 * Прошлая версия использовала `useMediaQuery` из VueUse: он вешает слушатель
 * через `useEventListener`, привязанный к текущему scope. Первый вызвавший
 * компонент забирал подписку себе, и после его размонтирования закэшированный
 * `ref` замирал.
 */
let state: Ref<boolean> | null = null;
let override: Ref<boolean> | null = null;

function createState(): Ref<boolean> {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return ref(false);
  }

  const mql = window.matchMedia(MEDIA_QUERY);
  const value = ref(mql.matches);
  mql.addEventListener('change', (event) => {
    value.value = event.matches;
  });
  return value;
}

export function useIsDesktop(): Ref<boolean> {
  if (override) return override;
  if (!state) state = createState();
  return state;
}

/** Точка подмены для тестов. `null` возвращает реальное состояние. */
export function setIsDesktopForTests(value: boolean | null): void {
  if (value === null) {
    override = null;
    return;
  }
  if (override) {
    override.value = value;
    return;
  }
  override = ref(value);
}
```

```ts
// src/shared/lib/platform/index.ts
export { useIsDesktop, setIsDesktopForTests, DESKTOP_MIN_WIDTH } from './useIsDesktop';
export { platformPage } from './platformPage';
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Запустить: `bun run test -- src/shared/lib/platform/useIsDesktop.spec.ts`
Ожидаемо: PASS, 3 теста.

- [ ] **Step 5: Превратить старый путь в реэкспорт**

```ts
// src/shared/lib/composables/useIsDesktop.ts
/**
 * Слой платформы переехал в `@/shared/lib/platform`. Файл оставлен реэкспортом,
 * чтобы одиннадцать существующих мест импорта не пришлось править механически.
 */
export { useIsDesktop, DESKTOP_MIN_WIDTH } from '@/shared/lib/platform/useIsDesktop';
```

- [ ] **Step 6: Проверить, что ничего не разъехалось**

Запустить: `bun run test`, затем `bun run lint` и `bunx vue-tsc -b`.
Ожидаемо: весь набор зелёный — 11 потребителей `useIsDesktop` продолжают работать через реэкспорт.

---

### Task 2: Резолвер `platformPage`

**Files:**
- Create: `src/shared/lib/platform/platformPage.ts`
- Test: `src/shared/lib/platform/platformPage.spec.ts`

**Interfaces:**
- Consumes: `useIsDesktop`, `setIsDesktopForTests` из Task 1.
- Produces: `platformPage(mobile: PageLoader, desktop: PageLoader): Component`, где `type PageLoader = () => Promise<Component | { default: Component }>`.

**Главное требование:** десктопный загрузчик не должен вызываться на мобильной ширине — иначе телефон качает разметку, которую никогда не покажет. Ровно эту ошибку делает нынешний `DashboardStandardLayout.vue`, импортирующий обе ветки статически.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/shared/lib/platform/platformPage.spec.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { platformPage } from './platformPage';
import { setIsDesktopForTests } from './useIsDesktop';

const Mobile = defineComponent({ name: 'Mobile', setup: () => () => h('div', 'мобильная') });
const Desktop = defineComponent({ name: 'Desktop', setup: () => () => h('div', 'десктопная') });

afterEach(() => {
  setIsDesktopForTests(null);
});

describe('platformPage', () => {
  it('на мобильной ширине рендерит мобильный вариант и не трогает десктопный загрузчик', async () => {
    setIsDesktopForTests(false);
    const mobileLoader = vi.fn(async () => Mobile);
    const desktopLoader = vi.fn(async () => Desktop);

    const wrapper = mount(platformPage(mobileLoader, desktopLoader));
    await flushPromises();

    expect(wrapper.text()).toContain('мобильная');
    expect(mobileLoader).toHaveBeenCalledTimes(1);
    expect(desktopLoader).not.toHaveBeenCalled();
  });

  it('на десктопной ширине рендерит десктопный вариант и не трогает мобильный загрузчик', async () => {
    setIsDesktopForTests(true);
    const mobileLoader = vi.fn(async () => Mobile);
    const desktopLoader = vi.fn(async () => Desktop);

    const wrapper = mount(platformPage(mobileLoader, desktopLoader));
    await flushPromises();

    expect(wrapper.text()).toContain('десктопная');
    expect(desktopLoader).toHaveBeenCalledTimes(1);
    expect(mobileLoader).not.toHaveBeenCalled();
  });

  it('переключается при пересечении границы', async () => {
    setIsDesktopForTests(false);
    const wrapper = mount(platformPage(async () => Mobile, async () => Desktop));
    await flushPromises();
    expect(wrapper.text()).toContain('мобильная');

    setIsDesktopForTests(true);
    await nextTick();
    await flushPromises();

    expect(wrapper.text()).toContain('десктопная');
  });

  it('принимает загрузчик в форме модуля с default', async () => {
    setIsDesktopForTests(false);
    const wrapper = mount(platformPage(async () => ({ default: Mobile }), async () => Desktop));
    await flushPromises();
    expect(wrapper.text()).toContain('мобильная');
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Запустить: `bun run test -- src/shared/lib/platform/platformPage.spec.ts`
Ожидаемо: FAIL — `platformPage` не экспортируется.

- [ ] **Step 3: Реализовать резолвер**

```ts
// src/shared/lib/platform/platformPage.ts
import { defineAsyncComponent, defineComponent, h, type Component } from 'vue';
import { useIsDesktop } from './useIsDesktop';

export type PageLoader = () => Promise<Component | { default: Component }>;

/**
 * Подставляет в роутер мобильный или десктопный компонент страницы.
 *
 * Оба варианта обёрнуты в `defineAsyncComponent`, поэтому чанк уходит в сеть
 * только когда его действительно рендерят: телефон никогда не качает
 * десктопную разметку, и наоборот.
 *
 * При пересечении границы поддерево размонтируется. Данные переживают это в
 * кэше Vue Query; теряется позиция скролла и локальное состояние формы.
 */
export function platformPage(mobile: PageLoader, desktop: PageLoader): Component {
  const Mobile = defineAsyncComponent(mobile as () => Promise<Component>);
  const Desktop = defineAsyncComponent(desktop as () => Promise<Component>);

  return defineComponent({
    name: 'PlatformPage',
    setup() {
      const isDesktop = useIsDesktop();
      return () => h(isDesktop.value ? Desktop : Mobile);
    },
  });
}
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Запустить: `bun run test -- src/shared/lib/platform/platformPage.spec.ts`
Ожидаемо: PASS, 4 теста.

- [ ] **Step 5: Проверка**

`bun run lint` и `bunx vue-tsc -b` — без ошибок.

---

### Task 3: Разделение оболочки на `MobileLayout` и `DesktopLayout`

**Files:**
- Create: `src/app/layouts/ui/AppShell.vue`
- Create: `src/app/layouts/ui/MobileLayout.vue`
- Create: `src/app/layouts/ui/DesktopLayout.vue`
- Modify: `src/app/layouts/index.ts`
- Modify: `src/app/router/index.ts:144-147`
- Delete: `src/app/layouts/ui/MainLayout.vue`
- Test: `src/app/layouts/ui/layouts.spec.ts`

**Interfaces:**
- Consumes: `platformPage` (Task 2).
- Produces: `MobileLayout`, `DesktopLayout` из `@/app/layouts`; `AppShell` со слотами `nav-top`, `nav-bottom` и пропом `contentClass?: string`.

**Что не так сейчас.** `MainLayout.vue` монтирует **обе** навигации и прячет одну CSS-классом (`hidden md:flex` / `md:hidden`, строки 71, 108, 118). Из-за этого `SidebarNav` на телефоне всё равно выполняется и безусловно дёргает `useLayoutData` — профиль, счета и курсы валют. Плюс порог 768 расходится с порогом 1024 у шторок и master-detail.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/app/layouts/ui/layouts.spec.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, createTestRouter, mockUser } from '@/test/test-utils';
import { setIsDesktopForTests } from '@/shared/lib/platform';

vi.mock('@/app/layouts/model/useLayoutData', () => ({
  useLayoutData: () => ({
    userName: { value: 'Тест' },
    greeting: { value: 'Добрый день' },
    totalBalance: { value: 1000 },
    currency: { value: 'UZS' },
    isHidden: { value: false },
    toggleHidden: vi.fn(),
    isLoading: { value: false },
  }),
}));

const Stub = defineComponent({ setup: () => () => h('div', 'страница') });

function mountLayout(component: unknown) {
  const router = createTestRouter([{ path: '/', component: Stub }]);
  return renderWithProviders(component as never, { router, provideAuth: { user: mockUser } });
}

afterEach(() => setIsDesktopForTests(null));

describe('оболочки приложения', () => {
  it('мобильная оболочка показывает нижнюю навигацию и не монтирует сайдбар', async () => {
    setIsDesktopForTests(false);
    const { default: MobileLayout } = await import('./MobileLayout.vue');
    const wrapper = mountLayout(MobileLayout);
    await flushPromises();

    expect(wrapper.find('[data-testid="bottom-nav"]').exists()).toBe(true);
    expect(wrapper.find('aside[aria-label="Навигационная панель"]').exists()).toBe(false);
  });

  it('десктопная оболочка показывает сайдбар и не монтирует нижнюю навигацию', async () => {
    setIsDesktopForTests(true);
    const { default: DesktopLayout } = await import('./DesktopLayout.vue');
    const wrapper = mountLayout(DesktopLayout);
    await flushPromises();

    expect(wrapper.find('aside[aria-label="Навигационная панель"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="bottom-nav"]').exists()).toBe(false);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Запустить: `bun run test -- src/app/layouts/ui/layouts.spec.ts`
Ожидаемо: FAIL — `MobileLayout.vue` не существует.

- [ ] **Step 3: Вынести общую часть в `AppShell.vue`**

Переносится из `MainLayout.vue` без изменения поведения: skip-link, `RouterView` с `Transition`, ветка `transitionName === 'none'`, переключение высоты в демо-режиме.

```vue
<!-- src/app/layouts/ui/AppShell.vue -->
<script setup lang="ts">
import { inject, ref, type Ref } from 'vue';
import { RouterView } from 'vue-router';
import { transitionName, finishPageTransition } from '@/app/router';

defineProps<{ contentClass?: string }>();

const isDemo = inject<Ref<boolean>>('isDemo', ref(false));
</script>

<template>
  <div
    :class="[
      'w-full flex overflow-hidden bg-background-light dark:bg-background-dark',
      isDemo ? 'flex-1 min-h-0' : 'h-dvh',
    ]"
  >
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:shadow-lg"
    >
      Перейти к содержимому
    </a>

    <slot name="nav-side" />

    <div
      id="main-content"
      :class="[
        'flex-1 flex flex-col min-w-0 h-full relative bg-background-light dark:bg-background-dark',
        contentClass,
      ]"
    >
      <div class="flex-1 relative overflow-hidden flex flex-col">
        <RouterView v-slot="{ Component, route }">
          <div
            v-if="transitionName === 'none'"
            :key="route.path"
            class="w-full h-full flex flex-col"
          >
            <component :is="Component" />
          </div>
          <Transition v-else :name="transitionName" @after-enter="finishPageTransition">
            <div :key="route.path" class="absolute inset-0 w-full h-full flex flex-col">
              <component :is="Component" />
            </div>
          </Transition>
        </RouterView>
      </div>

      <slot name="nav-bottom" />
    </div>
  </div>
</template>
```

- [ ] **Step 4: Написать `MobileLayout.vue`**

Содержимое переносится из `MainLayout.vue:13-17, 19-52, 104-126`. Классы `md:hidden` снимаются — компонент монтируется только на мобильной ширине.

```vue
<!-- src/app/layouts/ui/MobileLayout.vue -->
<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BottomNav from '@/widgets/bottom-nav/ui/BottomNav.vue';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { useNavbarStyle } from '@/shared/lib/composables';
import { useFeatureHints } from '@/features/feature-hints';
import AppShell from './AppShell.vue';

const LiquidGlassBottomNav = defineAsyncComponent({
  loader: () => import('@/widgets/bottom-nav/ui/LibLiquidGlassBottomNav.vue'),
  errorComponent: BottomNav,
  timeout: 10000,
});

const { isDotDismissed, dismissDot } = useFeatureHints();
const showAddDot = computed(() => !isDotDismissed('add-button'));

const router = useRouter();
const route = useRoute();
const { style: navbarStyle } = useNavbarStyle();

/** Сфокусированные полноэкранные сценарии прячут нижнюю навигацию: иначе она
 *  висит поверх их собственных действий внизу экрана. */
const FULLSCREEN_FLOWS: string[] = [
  ROUTE_NAMES.SCAN_RECEIPT,
  ROUTE_NAMES.IMPORT_CONFIRM,
  ROUTE_NAMES.IMPORT_INBOX,
  ROUTE_NAMES.NEW_TRANSACTION,
];

const hideBottomNav = computed(() => FULLSCREEN_FLOWS.includes(route.name as string));

function handleAddTransaction() {
  router.push({ name: ROUTE_NAMES.NEW_TRANSACTION });
}
</script>

<template>
  <AppShell>
    <template #nav-bottom>
      <template v-if="!hideBottomNav">
        <LiquidGlassBottomNav
          v-if="navbarStyle === 'liquid-glass'"
          data-testid="bottom-nav"
          :show-add-dot="showAddDot"
          @add-click="handleAddTransaction"
          @add-dot-dismiss="dismissDot('add-button')"
        />
        <div
          v-else
          data-testid="bottom-nav"
          class="shrink-0 border-t border-border-light dark:border-border-dark relative z-40 bg-background-light dark:bg-background-dark"
        >
          <BottomNav
            :show-add-dot="showAddDot"
            @add-click="handleAddTransaction"
            @add-dot-dismiss="dismissDot('add-button')"
          />
        </div>
      </template>
    </template>
  </AppShell>
</template>
```

- [ ] **Step 5: Написать `DesktopLayout.vue`**

```vue
<!-- src/app/layouts/ui/DesktopLayout.vue -->
<script setup lang="ts">
import { useRouter } from 'vue-router';
import { SidebarNav } from '@/widgets/sidebar-nav';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { useLayoutData } from '../model/useLayoutData';
import AppShell from './AppShell.vue';

const router = useRouter();
const { userName, greeting, totalBalance, currency, isHidden, toggleHidden, isLoading } =
  useLayoutData();

function handleAddTransaction() {
  router.push({ name: ROUTE_NAMES.NEW_TRANSACTION });
}
</script>

<template>
  <AppShell>
    <template #nav-side>
      <SidebarNav
        class="flex shrink-0 z-50"
        :user-name="userName"
        :greeting="greeting"
        :total-balance="totalBalance"
        :currency="currency"
        :is-hidden="isHidden"
        :loading="isLoading"
        @toggle-hidden="toggleHidden"
        @add-click="handleAddTransaction"
      />
    </template>
  </AppShell>
</template>
```

- [ ] **Step 6: Подключить оболочки в роутер**

В `src/app/router/index.ts` заменить строку 146:

```ts
// было:
//   component: () => import('@/app/layouts').then((m) => m.MainLayout),
component: platformPage(
  () => import('@/app/layouts/ui/MobileLayout.vue'),
  () => import('@/app/layouts/ui/DesktopLayout.vue'),
),
```

Импорт добавить по подпути, не из barrel'а: `import { platformPage } from '@/shared/lib/platform/platformPage';`

В `src/app/layouts/index.ts` заменить экспорт `MainLayout` на `MobileLayout` и `DesktopLayout`, затем удалить `src/app/layouts/ui/MainLayout.vue`.

- [ ] **Step 7: Убедиться, что тесты проходят**

Запустить: `bun run test -- src/app/layouts/ui/layouts.spec.ts`
Ожидаемо: PASS, 2 теста.

- [ ] **Step 8: Убрать слайд-переходы между разделами на десктопе**

Направление перехода считается во втором `router.beforeEach` (`router/index.ts:436-478`) по позиции маршрута в `MAIN_NAV_ITEMS` — а это четыре мобильных таба. Сайдбар ходит по `DESKTOP_NAV_ITEMS` (пять пунктов, включая `/debts`), поэтому переход на «Долги» получал бы `slide-forward`: страница уезжала бы вбок, хотя ни один экран не «глубже» другого.

В начало этого guard'а добавить:

```ts
import { useIsDesktop } from '@/shared/lib/platform/useIsDesktop';

// На десктопе разделы равноправны — боковой слайд там читается как переход
// «вглубь», которого нет. Оставляем мгновенную смену.
if (useIsDesktop().value) {
  transitionName.value = 'none';
  return;
}
```

Тест на это поведение:

```ts
// добавить в src/app/layouts/ui/layouts.spec.ts
it('на десктопе разделы меняются без слайда', async () => {
  setIsDesktopForTests(true);
  const { transitionName, router: appRouter } = await import('@/app/router');
  await appRouter.push('/analytics');
  expect(transitionName.value).toBe('none');
});
```

- [ ] **Step 9: Проверить, что не осталось ссылок на `MainLayout`**

Запустить: `grep -rn "MainLayout" src/ docs/ 2>/dev/null`
Ожидаемо: пусто (либо только упоминания в документации, которые надо поправить).

- [ ] **Step 10: Полная проверка**

`bun run test`, `bun run lint`, `bunx vue-tsc -b`, `bun run build && bun run check:bundle`.
Ожидаемо: всё зелёное, расход стартового бандла не вырос относительно 236.4 КБ.

---

### Task 4: Примитивы десктопной страницы

**Files:**
- Create: `src/shared/ui/desktop-page/DesktopPage.vue`
- Create: `src/shared/ui/desktop-page/DesktopColumns.vue`
- Create: `src/shared/ui/desktop-page/index.ts`
- Modify: `src/shared/ui/index.ts`
- Test: `src/shared/ui/desktop-page/DesktopPage.spec.ts`

**Interfaces:**
- Consumes: ничего из предыдущих задач.
- Produces:
  - `DesktopPage` — пропы `title?: string`, `maxWidth?: '1440' | '1280' | 'full'` (по умолчанию `'1440'`); слоты `header-actions`, `default`; `defineExpose({ scrollRef })`.
  - `DesktopColumns` — пропы `main?: number` (по умолчанию 8), `aside?: number` (по умолчанию 4); слоты `main`, `aside`; правая колонка липкая.

**Почему не переиспользуем `PageContainer`.** Тот отдаёт `max-w-7xl` (1280) и мобильные отступы `px-5 lg:px-8`, а его слот `header` рассчитан на мобильную шапку с safe-area. Десктопной странице нужна своя шапка и ширина 1440.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/shared/ui/desktop-page/DesktopPage.spec.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DesktopPage from './DesktopPage.vue';
import DesktopColumns from './DesktopColumns.vue';

describe('DesktopPage', () => {
  it('показывает заголовок и содержимое', () => {
    const wrapper = mount(DesktopPage, {
      props: { title: 'Главная' },
      slots: { default: '<p>содержимое</p>' },
    });

    expect(wrapper.text()).toContain('Главная');
    expect(wrapper.text()).toContain('содержимое');
  });

  it('не резервирует место под нижнюю навигацию', () => {
    const wrapper = mount(DesktopPage, { props: { title: 'Главная' } });
    expect(wrapper.html()).not.toContain('pb-28');
  });

  it('ограничивает ширину контента 1440 пикселями по умолчанию', () => {
    const wrapper = mount(DesktopPage, { props: { title: 'Главная' } });
    expect(wrapper.html()).toContain('max-w-[1440px]');
  });

  it('отдаёт scrollRef наружу', () => {
    const wrapper = mount(DesktopPage, { props: { title: 'Главная' } });
    expect((wrapper.vm as unknown as { scrollRef: unknown }).scrollRef).toBeTruthy();
  });
});

describe('DesktopColumns', () => {
  it('раскладывает слоты в сетку 8 и 4 по умолчанию', () => {
    const wrapper = mount(DesktopColumns, {
      slots: { main: '<p>основное</p>', aside: '<p>боковое</p>' },
    });

    const html = wrapper.html();
    expect(html).toContain('col-span-8');
    expect(html).toContain('col-span-4');
    expect(wrapper.text()).toContain('основное');
    expect(wrapper.text()).toContain('боковое');
  });

  it('делает боковую колонку липкой', () => {
    const wrapper = mount(DesktopColumns, { slots: { aside: '<p>боковое</p>' } });
    expect(wrapper.html()).toContain('sticky');
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Запустить: `bun run test -- src/shared/ui/desktop-page/DesktopPage.spec.ts`
Ожидаемо: FAIL — компоненты не существуют.

- [ ] **Step 3: Реализовать `DesktopPage.vue`**

```vue
<!-- src/shared/ui/desktop-page/DesktopPage.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { cn } from '@/shared/lib/utils';

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    maxWidth?: '1440' | '1280' | 'full';
  }>(),
  { title: undefined, subtitle: undefined, maxWidth: '1440' },
);

const widthClass = {
  '1440': 'max-w-[1440px]',
  '1280': 'max-w-[1280px]',
  full: 'max-w-none',
}[props.maxWidth];

const scrollRef = ref<HTMLElement>();

defineExpose({ scrollRef });
</script>

<template>
  <div class="h-full flex flex-col">
    <header
      v-if="title || $slots['header-actions']"
      class="shrink-0 border-b border-border-light dark:border-border-dark"
    >
      <div :class="cn('mx-auto w-full px-8 py-5 flex items-center justify-between gap-6', widthClass)">
        <div class="min-w-0">
          <h1 class="text-h2 font-bold text-text-primary-light dark:text-text-primary-dark truncate">
            {{ title }}
          </h1>
          <p
            v-if="subtitle"
            class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark truncate"
          >
            {{ subtitle }}
          </p>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <slot name="header-actions" />
        </div>
      </div>
    </header>

    <div ref="scrollRef" class="flex-1 overflow-y-auto px-8 py-6">
      <div :class="cn('mx-auto w-full', widthClass)">
        <slot />
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Реализовать `DesktopColumns.vue`**

```vue
<!-- src/shared/ui/desktop-page/DesktopColumns.vue -->
<script setup lang="ts">
withDefaults(defineProps<{ main?: number; aside?: number }>(), { main: 8, aside: 4 });

/** Tailwind не собирает классы из строковой интерполяции, поэтому раскладка
 *  колонок перечислена явно. */
const spanClass: Record<number, string> = {
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
};
</script>

<template>
  <div class="grid grid-cols-12 gap-6 items-start">
    <div :class="[spanClass[main], 'flex flex-col gap-6 min-w-0']">
      <slot name="main" />
    </div>
    <aside :class="[spanClass[aside], 'flex flex-col gap-6 min-w-0 self-start sticky top-6']">
      <slot name="aside" />
    </aside>
  </div>
</template>
```

```ts
// src/shared/ui/desktop-page/index.ts
export { default as DesktopPage } from './DesktopPage.vue';
export { default as DesktopColumns } from './DesktopColumns.vue';
```

В `src/shared/ui/index.ts` дописать: `export { DesktopPage, DesktopColumns } from './desktop-page';`

- [ ] **Step 5: Убедиться, что тесты проходят**

Запустить: `bun run test -- src/shared/ui/desktop-page/DesktopPage.spec.ts`
Ожидаемо: PASS, 6 тестов.

- [ ] **Step 6: Проверка**

`bun run lint`, `bunx vue-tsc -b`.

---

### Task 5: `UOverlay` и перевод четырёх шторок

**Files:**
- Create: `src/shared/ui/overlay/UOverlay.vue`
- Create: `src/shared/ui/overlay/OverlayHeader.vue`
- Create: `src/shared/ui/overlay/index.ts`
- Modify: `src/shared/ui/index.ts`
- Modify: `src/entities/category/ui/CategoryPickerSheet.vue`
- Modify: `src/entities/account/ui/AccountPickerSheet.vue`
- Modify: `src/entities/person/ui/PersonPickerSheet.vue`
- Modify: `src/features/split-expense/ui/SplitExpenseDrawer.vue`
- Test: `src/shared/ui/overlay/UOverlay.spec.ts`

**Interfaces:**
- Consumes: `useIsDesktop` (Task 1).
- Produces: `UOverlay` — пропы `modelValue: boolean`, `title?: string`, `desktop?: 'panel' | 'dialog'` (по умолчанию `'panel'`), `maxHeight?: string` (по умолчанию `'85dvh'`); события `update:modelValue`; слоты `default`, `footer`.

**Что чиним.** Одна и та же обвязка vaul продублирована в 13 файлах: `:direction="isDesktop ? 'right' : 'bottom'"`, оверлей `fixed inset-0 z-50 bg-black/40`, тернарник классов `w-[420px] rounded-l-2xl`, ручка, шапка с крестиком. Мобильные высоты при этом разъехались: `70dvh`, `80dvh`, `85dvh`, `90dvh`, а `CategoryPickerSheet` вообще фиксирует `h-[85dvh]` и потому не сжимается под короткий список.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/shared/ui/overlay/UOverlay.spec.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { setIsDesktopForTests } from '@/shared/lib/platform';
import UOverlay from './UOverlay.vue';

vi.mock('vaul-vue', () => import('@/test/stubs/vaul'));

afterEach(() => setIsDesktopForTests(null));

function mountOverlay(props: Record<string, unknown> = {}) {
  return mount(UOverlay, {
    props: { modelValue: true, title: 'Выбор счёта', ...props },
    slots: { default: '<p>содержимое</p>' },
    global: { stubs: { teleport: true } },
  });
}

describe('UOverlay', () => {
  it('на мобильной ширине рисует нижнюю шторку', async () => {
    setIsDesktopForTests(false);
    const wrapper = mountOverlay();
    await flushPromises();

    expect(wrapper.find('[data-testid="overlay-sheet"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="overlay-dialog"]').exists()).toBe(false);
  });

  it('на десктопе в режиме dialog рисует центрированный диалог', async () => {
    setIsDesktopForTests(true);
    const wrapper = mountOverlay({ desktop: 'dialog' });
    await flushPromises();

    expect(wrapper.find('[data-testid="overlay-dialog"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="overlay-sheet"]').exists()).toBe(false);
  });

  it('на десктопе в режиме panel рисует правую панель', async () => {
    setIsDesktopForTests(true);
    const wrapper = mountOverlay({ desktop: 'panel' });
    await flushPromises();

    expect(wrapper.find('[data-testid="overlay-panel"]').exists()).toBe(true);
  });

  it('показывает заголовок и содержимое', async () => {
    setIsDesktopForTests(false);
    const wrapper = mountOverlay();
    await flushPromises();

    expect(wrapper.text()).toContain('Выбор счёта');
    expect(wrapper.text()).toContain('содержимое');
  });

  it('закрытие поднимает update:modelValue со значением false', async () => {
    setIsDesktopForTests(true);
    const wrapper = mountOverlay({ desktop: 'dialog' });
    await flushPromises();

    await wrapper.find('[data-testid="overlay-close"]').trigger('click');

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false]);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Запустить: `bun run test -- src/shared/ui/overlay/UOverlay.spec.ts`
Ожидаемо: FAIL — компонент не существует.

- [ ] **Step 3: Реализовать `OverlayHeader.vue`**

```vue
<!-- src/shared/ui/overlay/OverlayHeader.vue -->
<script setup lang="ts">
import { UIcon } from '@/shared/ui/icon';

defineProps<{ title?: string }>();
defineEmits<{ close: [] }>();
</script>

<template>
  <div
    v-if="title || $slots.default"
    class="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-border-light dark:border-border-dark"
  >
    <h2 class="text-body-lg font-semibold text-text-primary-light dark:text-text-primary-dark truncate">
      {{ title }}
    </h2>
    <slot />
    <button
      type="button"
      data-testid="overlay-close"
      aria-label="Закрыть"
      class="shrink-0 p-1.5 -mr-1.5 rounded-lg text-text-tertiary-light dark:text-text-tertiary-dark hover:bg-surface-hover-light dark:hover:bg-surface-hover-dark transition-colors"
      @click="$emit('close')"
    >
      <UIcon name="close" size="sm" />
    </button>
  </div>
</template>
```

- [ ] **Step 4: Реализовать `UOverlay.vue`**

Мобильная ветка использует `vaul-vue`, десктопная — `reka-ui`. Обязательные `data-testid`: `overlay-sheet`, `overlay-panel`, `overlay-dialog`.

```vue
<!-- src/shared/ui/overlay/UOverlay.vue -->
<script setup lang="ts">
import { computed } from 'vue';
import { DrawerRoot, DrawerPortal, DrawerOverlay, DrawerContent } from 'vaul-vue';
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent } from 'reka-ui';
import { useIsDesktop } from '@/shared/lib/platform/useIsDesktop';
import { cn } from '@/shared/lib/utils';
import OverlayHeader from './OverlayHeader.vue';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    desktop?: 'panel' | 'dialog';
    maxHeight?: string;
  }>(),
  { title: undefined, desktop: 'panel', maxHeight: '85dvh' },
);

const emit = defineEmits<{ 'update:modelValue': [boolean] }>();

const isDesktop = useIsDesktop();
const isPanel = computed(() => isDesktop.value && props.desktop === 'panel');
const isDialog = computed(() => isDesktop.value && props.desktop === 'dialog');

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const OVERLAY_CLASS = 'fixed inset-0 z-50 bg-black/40';
const BODY_CLASS = 'flex-1 overflow-y-auto px-5 py-4';
const SURFACE_CLASS = 'flex flex-col bg-card-light dark:bg-card-dark';
</script>

<template>
  <!-- Десктоп: правая панель или центрированный диалог -->
  <DialogRoot v-if="isDesktop" v-model:open="open">
    <DialogPortal>
      <DialogOverlay :class="OVERLAY_CLASS" />
      <DialogContent
        :data-testid="isPanel ? 'overlay-panel' : 'overlay-dialog'"
        :class="
          cn(
            'fixed z-50',
            SURFACE_CLASS,
            isPanel
              ? 'top-0 right-0 bottom-0 w-[420px] rounded-l-2xl border-l border-border-light dark:border-border-dark'
              : 'left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-lg max-h-[85dvh] -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-lg',
          )
        "
      >
        <OverlayHeader :title="title" @close="open = false" />
        <div :class="BODY_CLASS"><slot /></div>
        <div v-if="$slots.footer" class="shrink-0 px-5 py-4"><slot name="footer" /></div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>

  <!-- Мобильная: нижняя шторка -->
  <DrawerRoot v-else v-model:open="open" direction="bottom">
    <DrawerPortal>
      <DrawerOverlay :class="OVERLAY_CLASS" />
      <DrawerContent
        data-testid="overlay-sheet"
        :style="{ maxHeight }"
        :class="cn('fixed inset-x-0 bottom-0 z-50 rounded-t-2xl', SURFACE_CLASS)"
      >
        <div class="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-border-light dark:bg-border-dark" />
        <OverlayHeader :title="title" @close="open = false" />
        <div :class="BODY_CLASS" data-vaul-no-drag><slot /></div>
        <div v-if="$slots.footer" class="shrink-0 px-5 pb-[env(safe-area-inset-bottom)] pt-4">
          <slot name="footer" />
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
```

Клавиатурный хак `useDrawerKeyboard` (мутирует `style` в обход реактивности Vue, иначе перерисовка забирает фокус у инпута) подключается **только** в мобильной ветке — на десктопе экранной клавиатуры нет.

Точные имена и сигнатуры примитивов `vaul-vue` и `reka-ui` сверить с любой из существующих шторок, например `src/entities/account/ui/AccountPickerSheet.vue`.

- [ ] **Step 5: Убедиться, что тесты проходят**

Запустить: `bun run test -- src/shared/ui/overlay/UOverlay.spec.ts`
Ожидаемо: PASS, 5 тестов.

- [ ] **Step 6: Перевести `CategoryPickerSheet.vue` на `UOverlay`**

Вся обвязка vaul внутри файла заменяется на `<UOverlay v-model="..." title="..." desktop="dialog">`. Фиксированная `h-[85dvh]` уходит — высота приходит из общего `max-h`, поэтому короткий список больше не растягивает шторку на весь экран.

- [ ] **Step 7: Прогнать тесты категорий**

Запустить: `bun run test -- src/entities/category`
Ожидаемо: PASS, включая существующий `CategoryPicker.spec.ts`.

- [ ] **Step 8: Перевести оставшиеся три шторки**

`AccountPickerSheet.vue`, `PersonPickerSheet.vue`, `SplitExpenseDrawer.vue` — тем же приёмом, `desktop="dialog"`.

- [ ] **Step 9: Проверить страницу подтверждения импорта**

Все четыре шторки используются `src/pages/import-inbox/confirm/ImportConfirmPage.vue` (942 строки, держит семь шторок одновременно). Страница в этап 1 не входит, но сломать её нельзя.

Запустить: `bun run test -- src/pages/import-inbox src/features/split-expense src/entities`
Ожидаемо: PASS.

- [ ] **Step 10: Полная проверка**

`bun run test`, `bun run lint`, `bunx vue-tsc -b`.

---

### Task 6: Десктопная Главная

**Files:**
- Create: `src/pages/dashboard/model/useDashboardPage.ts`
- Create: `src/pages/dashboard/ui/DashboardModals.vue`
- Create: `src/pages/dashboard/desktop/DashboardDesktopPage.vue`
- Create: `src/pages/dashboard/desktop/DashboardDesktopHeader.vue`
- Create: `src/pages/dashboard/desktop/DashboardDesktopSidePanel.vue`
- Modify: `src/pages/dashboard/DashboardPage.vue`
- Modify: `src/pages/dashboard/ui/DashboardActivityColumn.vue`
- Modify: `src/pages/dashboard/ui/DashboardMobileHeader.vue`
- Modify: `src/app/router/index.ts:149-153`
- Delete: `src/pages/dashboard/ui/DashboardStandardLayout.vue`, `DashboardStandardDesktop.vue`, `DashboardSidePanel.vue`
- Test: `src/pages/dashboard/desktop/DashboardDesktopPage.spec.ts`

**Interfaces:**
- Consumes: `DesktopPage`, `DesktopColumns` (Task 4); `platformPage` (Task 2); существующие `useDashboardData`, `useDashboardQuickActions`, `useDashboardNavigation`, `provideDashboardContext`, `useDashboardContext`.
- Produces: `useDashboardPage(): { greeting, userName, isHidden, isCompactMode, showInstallModal, showBudgetSheet, showFinancialPeriodModal, showSettingsDot, showSettingsHint, settingsHintConfig, isScrolledPastBalance, setScrollContainer(el), handleSettingsClick(), dismissSettingsHint(), handleSettingsHintAction(), quickActions, data }` — вызывает `provideDashboardContext` внутри себя.

**Что переиспользуется как есть.** Модель Главной уже общая: `dashboardContext.ts` (InjectionKey на ~40 ключей), `useDashboardData` (9 источников данных), `useDashboardQuickActions`, `useDashboardNavigation`. Задача не трогает их вовсе — только перекладывает обвязку из SFC в `useDashboardPage`.

**Что удаляется.** `DashboardStandardLayout.vue` (12 строк, локальный `useMediaQuery('(min-width: 768px)')` — порог, расходящийся с общим), `DashboardStandardDesktop.vue` (59 строк), `DashboardSidePanel.vue` (149 строк). Их содержимое переезжает в `desktop/`.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/pages/dashboard/desktop/DashboardDesktopPage.spec.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, createTestRouter, mockUser } from '@/test/test-utils';
import { setIsDesktopForTests } from '@/shared/lib/platform';
import DashboardDesktopPage from './DashboardDesktopPage.vue';

vi.mock('vaul-vue', () => import('@/test/stubs/vaul'));

afterEach(() => setIsDesktopForTests(null));

function mountPage() {
  setIsDesktopForTests(true);
  const router = createTestRouter([
    { path: '/', component: { template: '<div />' } },
    { path: '/accounts', component: { template: '<div />' } },
    { path: '/dashboard/settings', component: { template: '<div />' } },
  ]);
  return renderWithProviders(DashboardDesktopPage, { router, provideAuth: { user: mockUser } });
}

describe('десктопная Главная', () => {
  it('показывает шапку страницы, которой нет в мобильной версии', async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find('[data-testid="dashboard-desktop-header"]').exists()).toBe(true);
  });

  it('раскладывает контент на основную и боковую колонки', async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find('[data-testid="dashboard-desktop-main"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-desktop-aside"]').exists()).toBe(true);
  });

  it('не резервирует место под нижнюю навигацию', async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.html()).not.toContain('pb-28');
  });

  it('игнорирует компактный режим: он мобильная оптимизация', async () => {
    localStorage.setItem('dashboard_compact_mode', 'true');
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find('[data-testid="dashboard-desktop-main"]').exists()).toBe(true);
    localStorage.removeItem('dashboard_compact_mode');
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Запустить: `bun run test -- src/pages/dashboard/desktop/DashboardDesktopPage.spec.ts`
Ожидаемо: FAIL — страница не существует.

- [ ] **Step 3: Вынести логику в `useDashboardPage.ts`**

Переносится из `DashboardPage.vue:34-207` без изменения поведения: feature-hints и отложенная подсказка, `getGreeting()`, `useDashboardData`, `useDashboardQuickActions`, `useDashboardNavigation`, PWA-модалка, флаги `useLocalStorage`, `handleRefresh`, `handleBudgetSave` / `handleBudgetReset` с `useFinancialPeriod`, и весь вызов `provideDashboardContext`.

Отличие одно: скролл-контейнер приходит извне, потому что у мобильной версии это `PageContainer`, а у десктопной — `DesktopPage`. Обе функции возвращаются наружу из composable, а не экспортируются из модуля:

```ts
export function useDashboardPage() {
  // …

  const scrollContainerRef = ref<HTMLElement | undefined>();
  const isScrolledPastBalance = ref(false);
  const BALANCE_SCROLL_THRESHOLD = 80;

  /** Вызывается страницей: мобильная отдаёт scrollRef из PageContainer,
   *  десктопная — из DesktopPage. */
  function setScrollContainer(el: HTMLElement | undefined) {
    scrollContainerRef.value = el;
  }

  useEventListener(scrollContainerRef, 'scroll', (e: Event) => {
    const scrolled = (e.target as HTMLElement).scrollTop > BALANCE_SCROLL_THRESHOLD;
    if (scrolled !== isScrolledPastBalance.value) isScrolledPastBalance.value = scrolled;
  });

  provideDashboardContext({ /* те же ~40 ключей, что сейчас в DashboardPage.vue:156-207 */ });

  return { /* …, */ setScrollContainer, isScrolledPastBalance };
}
```

Обе страницы связывают контейнер после монтирования:

```ts
const pageRef = ref<{ scrollRef?: HTMLElement }>();
watch(() => pageRef.value?.scrollRef, (el) => setScrollContainer(el), { immediate: true });
```

- [ ] **Step 4: Вынести модалки в `DashboardModals.vue`**

Переносится из `DashboardPage.vue:240-260`: `InstallPwaModal`, `QuickActionModal`, `FinancialPeriodModal`, `SetBudgetSheet`. Компонент принимает то, что не лежит в контексте, пропами.

- [ ] **Step 5: Ужать `DashboardPage.vue` до мобильной разметки**

Остаётся `PageContainer` + `DashboardMobileHeader` + `InstallPwaBanner` + `DashboardCompactView` / `DashboardStandardMobile` + `DashboardModals`. Ветвление `DashboardStandardLayout` заменяется прямым `DashboardStandardMobile`. Класс `md:pt-8 md:pb-8` в `<main>` (строка 231) сводится к мобильным значениям: `pt-3 pb-28`.

- [ ] **Step 6: Написать десктопные компоненты**

`DashboardDesktopHeader.vue` — приветствие с именем, финансовый период, кнопка «Настроить вид» (`data-testid="dashboard-desktop-header"`).

`DashboardDesktopSidePanel.vue` — перенос `DashboardSidePanel.vue`: фильтрует `widgetOrder` по `SIDE_PANEL_WIDGET_IDS`, рендерит виджеты через `defineAsyncComponent` + `Suspense`.

`DashboardDesktopPage.vue`:

```vue
<script setup lang="ts">
import { DesktopPage, DesktopColumns } from '@/shared/ui/desktop-page';
import { BalanceCard } from '@/widgets/balance-card';
import { useDashboardPage } from '../model/useDashboardPage';
import DashboardModals from '../ui/DashboardModals.vue';
import DashboardDesktopHeader from './DashboardDesktopHeader.vue';
import DashboardDesktopSidePanel from './DashboardDesktopSidePanel.vue';
// …
</script>
```

Внутри: `DesktopPage` со слотом `header-actions`, `DesktopColumns` с `main` (баланс строкой, счета сеткой, последние операции на 12 строк) и `aside` (боковая панель). Обязательные `data-testid`: `dashboard-desktop-main`, `dashboard-desktop-aside`.

- [ ] **Step 7: Подключить страницу в роутер**

```ts
{
  path: '',
  name: ROUTE_NAMES.DASHBOARD,
  component: platformPage(
    () => import('@/pages/dashboard/DashboardPage.vue'),
    () => import('@/pages/dashboard/desktop/DashboardDesktopPage.vue'),
  ),
},
```

- [ ] **Step 8: Снять десктопные ветки из мобильных компонентов**

В `DashboardActivityColumn.vue` убрать `md:hidden` у долгов и подписок — на мобиле они должны показываться всегда, а десктоп теперь рисуется отдельной страницей. В `DashboardMobileHeader.vue` убрать обёртку `md:hidden`.

- [ ] **Step 9: Удалить три файла**

```bash
rm src/pages/dashboard/ui/DashboardStandardLayout.vue \
   src/pages/dashboard/ui/DashboardStandardDesktop.vue \
   src/pages/dashboard/ui/DashboardSidePanel.vue
```

Проверить, что на них не осталось ссылок: `grep -rn "DashboardStandard\|DashboardSidePanel" src/`

- [ ] **Step 10: Убедиться, что тесты проходят**

Запустить: `bun run test -- src/pages/dashboard`
Ожидаемо: PASS — и новый файл, и существующий `DashboardPage.spec.ts` (752 строки на мобильную разметку).

Если мобильный набор падает из-за ветвления по платформе, добавить в его `beforeEach`: `setIsDesktopForTests(false)`, а в `afterEach` — `setIsDesktopForTests(null)`.

- [ ] **Step 11: Полная проверка**

`bun run test`, `bun run lint`, `bunx vue-tsc -b`.

---

### Task 7: Десктопные Счета с выбором в URL

**Files:**
- Create: `src/pages/accounts/model/useAccountsPage.ts`
- Create: `src/pages/accounts/desktop/AccountsDesktopPage.vue`
- Modify: `src/pages/accounts/AccountsPage.vue`
- Modify: `src/app/router/index.ts:164-168`
- Test: `src/pages/accounts/desktop/AccountsDesktopPage.spec.ts`

**Interfaces:**
- Consumes: `DesktopPage` (Task 4), `platformPage` (Task 2), `UOverlay` (Task 5).
- Produces: `useAccountsPage()` — общая логика списка (запросы, группировка, суммы, обработчики модалок).

**Что чиним по дороге.** Сейчас выбранный счёт живёт в локальном `ref` (`AccountsPage.vue:75`) и в URL не попадает: перезагрузка теряет выбор, ссылкой на счёт поделиться нельзя. В десктопной версии выбор переезжает в query-параметр. Мобильный маршрут `/accounts/:id` остаётся отдельным экраном.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/pages/accounts/desktop/AccountsDesktopPage.spec.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, createTestRouter, mockUser } from '@/test/test-utils';
import { setIsDesktopForTests } from '@/shared/lib/platform';
import AccountsDesktopPage from './AccountsDesktopPage.vue';

vi.mock('vaul-vue', () => import('@/test/stubs/vaul'));

afterEach(() => setIsDesktopForTests(null));

async function mountPage(initialPath = '/accounts') {
  setIsDesktopForTests(true);
  const router = createTestRouter([
    { path: '/accounts', component: { template: '<div />' } },
    { path: '/accounts/:id', component: { template: '<div />' } },
  ]);
  await router.push(initialPath);
  const wrapper = renderWithProviders(AccountsDesktopPage, {
    router,
    provideAuth: { user: mockUser },
  });
  await flushPromises();
  return { wrapper, router };
}

describe('десктопные Счета', () => {
  it('без выбранного счёта показывает заглушку в правой колонке', async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.find('[data-testid="accounts-detail-empty"]').exists()).toBe(true);
  });

  it('берёт выбранный счёт из query-параметра', async () => {
    const { wrapper } = await mountPage('/accounts?id=acc-1');
    expect(wrapper.find('[data-testid="accounts-detail-empty"]').exists()).toBe(false);
  });

  it('выбор счёта пишется в URL, а не только в локальное состояние', async () => {
    const { wrapper, router } = await mountPage();

    await wrapper.find('[data-testid="account-row"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.query.id).toBeTruthy();
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Запустить: `bun run test -- src/pages/accounts/desktop/AccountsDesktopPage.spec.ts`
Ожидаемо: FAIL — страница не существует.

- [ ] **Step 3: Вынести общую логику в `useAccountsPage.ts`**

Из `AccountsPage.vue` переносится всё, кроме разметки и локального `selectedAccountId`: запросы счетов и балансов, конвертация валют, группировка, состояния модалок создания/редактирования/корректировки баланса.

- [ ] **Step 4: Написать `AccountsDesktopPage.vue`**

`DesktopPage` + две колонки: список слева сеткой (`data-testid="account-row"` на карточке), детали справа. Выбор:

```ts
const route = useRoute();
const router = useRouter();
const selectedId = computed(() => (route.query.id as string | undefined) ?? null);

function selectAccount(id: string) {
  router.replace({ query: { ...route.query, id } });
}
```

Пустое состояние правой колонки — `data-testid="accounts-detail-empty"`.

- [ ] **Step 5: Снять `MasterDetailLayout` из мобильной страницы**

В `AccountsPage.vue` убрать `MasterDetailLayout` и ветку `isDesktop` в `handleAccountClick` — остаётся мобильный список с переходом на `/accounts/:id`.

`MasterDetailLayout` сам **не удаляется**: его продолжают использовать История и Долги до своих этапов.

- [ ] **Step 6: Подключить в роутер**

```ts
{
  path: 'accounts',
  name: ROUTE_NAMES.ACCOUNTS,
  component: platformPage(
    () => import('@/pages/accounts/AccountsPage.vue'),
    () => import('@/pages/accounts/desktop/AccountsDesktopPage.vue'),
  ),
},
```

- [ ] **Step 7: Убедиться, что тесты проходят**

Запустить: `bun run test -- src/pages/accounts`
Ожидаемо: PASS.

- [ ] **Step 8: Полная проверка**

`bun run test`, `bun run lint`, `bunx vue-tsc -b`.

---

### Task 8: Новая операция как модальный маршрут

**Files:**
- Create: `src/pages/transactions/new/desktop/AddTransactionDesktopPage.vue`
- Modify: `src/app/router/index.ts:179-183`
- Modify: `src/app/layouts/ui/DesktopLayout.vue`
- Test: `src/pages/transactions/new/desktop/AddTransactionDesktopPage.spec.ts`

**Interfaces:**
- Consumes: `UOverlay` (Task 5), `DesktopLayout` (Task 3), существующий `TransactionForm`.
- Produces: `meta.desktopOverlay: true` на маршруте `transactions/new`; `DesktopLayout` умеет рисовать фоновый маршрут под оверлеем.

**Что учитываем.** Мобильная форма завязана на анимацию перехода: `isReady` поднимается по `isPageTransitioning === false` и намеренно не опускается обратно, автофокус ждёт конца слайда. В модалке слайда нет, поэтому десктопная обвязка эту защёлку не использует. `SubmitBar` внутри модалки идёт без `safe-area` и без компенсации `-mx-4 px-4`.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/pages/transactions/new/desktop/AddTransactionDesktopPage.spec.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, createTestRouter, mockUser } from '@/test/test-utils';
import { setIsDesktopForTests } from '@/shared/lib/platform';
import AddTransactionDesktopPage from './AddTransactionDesktopPage.vue';

vi.mock('vaul-vue', () => import('@/test/stubs/vaul'));
vi.mock('@/app/router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/router')>()),
  isPageTransitioning: { value: false },
}));

afterEach(() => setIsDesktopForTests(null));

async function mountPage() {
  setIsDesktopForTests(true);
  const router = createTestRouter([
    { path: '/', component: { template: '<div />' } },
    { path: '/transactions/new', component: { template: '<div />' } },
  ]);
  await router.push('/transactions/new');
  const wrapper = renderWithProviders(AddTransactionDesktopPage, {
    router,
    provideAuth: { user: mockUser },
  });
  await flushPromises();
  return { wrapper, router };
}

describe('Новая операция на десктопе', () => {
  it('рисуется как центрированный диалог, а не как полноэкранная страница', async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.find('[data-testid="overlay-dialog"]').exists()).toBe(true);
  });

  it('закрытие возвращает на предыдущий маршрут', async () => {
    const { wrapper, router } = await mountPage();

    await wrapper.find('[data-testid="overlay-close"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.path).not.toBe('/transactions/new');
  });

  it('не резервирует safe-area под нижнюю панель', async () => {
    const { wrapper } = await mountPage();
    expect(wrapper.html()).not.toContain('safe-area-inset-bottom');
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Запустить: `bun run test -- src/pages/transactions/new/desktop/AddTransactionDesktopPage.spec.ts`
Ожидаемо: FAIL — страница не существует.

- [ ] **Step 3: Научить `DesktopLayout` фоновому маршруту**

```ts
// внутри DesktopLayout.vue
const route = useRoute();
const backgroundRoute = ref<string>('/');

watch(
  () => route.fullPath,
  (_, from) => {
    if (!route.meta.desktopOverlay && from) backgroundRoute.value = from;
  },
);

const isOverlayRoute = computed(() => route.meta.desktopOverlay === true);
```

Когда маршрут помечен как оверлей, `AppShell` получает фоновый компонент через `router.resolve(backgroundRoute.value)`, а сам оверлей рендерится поверх. При прямом заходе по ссылке фоном остаётся Главная (`'/'`).

- [ ] **Step 4: Пометить маршрут**

```ts
{
  path: 'transactions/new',
  name: ROUTE_NAMES.NEW_TRANSACTION,
  meta: { desktopOverlay: true },
  component: platformPage(
    () => import('@/pages/transactions/new/AddTransactionPage.vue'),
    () => import('@/pages/transactions/new/desktop/AddTransactionDesktopPage.vue'),
  ),
},
```

Тип `meta` расширить в `src/app/router/index.ts` (или в `env.d.ts`) через `declare module 'vue-router' { interface RouteMeta { desktopOverlay?: boolean } }`.

- [ ] **Step 5: Написать `AddTransactionDesktopPage.vue`**

`UOverlay` с `desktop="dialog"`, `max-w-xl`, внутри — существующий `TransactionForm` с теми же пропами, что и в мобильной странице. Закрытие: `router.back()` при наличии истории, иначе `router.push('/')`.

- [ ] **Step 6: Убедиться, что тесты проходят**

Запустить: `bun run test -- src/pages/transactions`
Ожидаемо: PASS, включая существующий `AddTransactionPage.spec.ts`.

- [ ] **Step 7: Полная проверка**

`bun run test`, `bun run lint`, `bunx vue-tsc -b`.

---

### Task 9: Префетч по платформам, документация, changelog

**Files:**
- Modify: `src/app/router/index.ts:78-118`
- Modify: `DESIGN_SYSTEM.md`
- Modify: `frontend/CLAUDE.md`
- Modify: `src/features/changelog/model/changelogData.ts`
- Test: `src/app/router/prefetch.spec.ts`

**Interfaces:**
- Consumes: `useIsDesktop` (Task 1).
- Produces: ничего для последующих задач.

**Что чиним.** `prefetchPages()` содержит жёстко зашитый список из 13 импортов мобильных страниц. Без правки десктопный пользователь впрок скачает 13 мобильных чанков, которые никогда не отрендерит.

- [ ] **Step 1: Написать падающий тест**

```ts
// src/app/router/prefetch.spec.ts
import { describe, it, expect, afterEach } from 'vitest';
import { setIsDesktopForTests } from '@/shared/lib/platform';
import { getPrefetchTargets } from './prefetchTargets';

afterEach(() => setIsDesktopForTests(null));

describe('цели префетча', () => {
  it('на мобиле не включает десктопные страницы', () => {
    setIsDesktopForTests(false);
    const targets = getPrefetchTargets();
    expect(targets.primary.every((name) => !name.includes('desktop'))).toBe(true);
  });

  it('на десктопе не включает мобильные варианты разделённых страниц', () => {
    setIsDesktopForTests(true);
    const targets = getPrefetchTargets();
    expect(targets.primary.some((name) => name.includes('desktop'))).toBe(true);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

Запустить: `bun run test -- src/app/router/prefetch.spec.ts`
Ожидаемо: FAIL — модуль `./prefetchTargets` не существует.

- [ ] **Step 3: Вынести цели префетча в отдельный модуль**

```ts
// src/app/router/prefetchTargets.ts
import { useIsDesktop } from '@/shared/lib/platform/useIsDesktop';

export interface PrefetchTargets {
  primary: string[];
  secondary: string[];
  load: (name: string) => Promise<unknown>;
}

/**
 * Динамический импорт по строке Vite не понимает, поэтому загрузчики
 * перечислены явно. Имя ключа — то же, что в списках ниже.
 */
const LOADERS: Record<string, () => Promise<unknown>> = {
  'history/HistoryPage': () => import('@/pages/history/HistoryPage.vue'),
  'analytics/AnalyticsPage': () => import('@/pages/analytics/AnalyticsPage.vue'),
  'profile/ProfilePage': () => import('@/pages/profile/ProfilePage.vue'),
  'transactions/AddTransactionPage': () =>
    import('@/pages/transactions/new/AddTransactionPage.vue'),
  'transactions/desktop/AddTransactionDesktopPage': () =>
    import('@/pages/transactions/new/desktop/AddTransactionDesktopPage.vue'),
  'accounts/AccountsPage': () => import('@/pages/accounts/AccountsPage.vue'),
  'accounts/desktop/AccountsDesktopPage': () =>
    import('@/pages/accounts/desktop/AccountsDesktopPage.vue'),
  'accounts/AccountDetailPage': () => import('@/pages/accounts/AccountDetailPage.vue'),
  'debts/DebtsListPage': () => import('@/pages/debts/list/DebtsListPage.vue'),
  'debts/DebtDetailPage': () => import('@/pages/debts/detail/DebtDetailPage.vue'),
  'debts/AddDebtPage': () => import('@/pages/debts/new/AddDebtPage.vue'),
  'changelog/ChangelogPage': () => import('@/pages/changelog/ChangelogPage.vue'),
  'settings/CurrencySettingsPage': () =>
    import('@/pages/settings/currency/CurrencySettingsPage.vue'),
  'settings/CategoriesPage': () => import('@/pages/settings/categories/CategoriesPage.vue'),
  'settings/ImportPage': () => import('@/pages/settings/import/ImportPage.vue'),
};

/** Страницы, у которых мобильный и десктопный варианты — разные чанки. */
const SPLIT = {
  addTransaction: {
    mobile: 'transactions/AddTransactionPage',
    desktop: 'transactions/desktop/AddTransactionDesktopPage',
  },
  accounts: {
    mobile: 'accounts/AccountsPage',
    desktop: 'accounts/desktop/AccountsDesktopPage',
  },
} as const;

export function getPrefetchTargets(): PrefetchTargets {
  const desktop = useIsDesktop().value;
  const pick = (page: { mobile: string; desktop: string }) => (desktop ? page.desktop : page.mobile);

  return {
    primary: [
      'history/HistoryPage',
      'analytics/AnalyticsPage',
      'profile/ProfilePage',
      pick(SPLIT.addTransaction),
    ],
    secondary: [
      pick(SPLIT.accounts),
      // экран одного счёта на десктопе живёт правой колонкой списка
      ...(desktop ? [] : ['accounts/AccountDetailPage']),
      'debts/DebtsListPage',
      'debts/DebtDetailPage',
      'debts/AddDebtPage',
      'changelog/ChangelogPage',
      'settings/CurrencySettingsPage',
      'settings/CategoriesPage',
      'settings/ImportPage',
    ],
    load: (name) => LOADERS[name]?.() ?? Promise.resolve(),
  };
}
```

Главная в префетч не попадает намеренно: она и так первый экран.

В `prefetchPages()` (`router/index.ts:78-118`) списки импортов заменяются на обход целей — вся обвязка с `afterLoad`, `requestIdleCallback` и задержками 1500/5000 мс остаётся как есть:

```ts
const targets = getPrefetchTargets();
const prefetchPrimary = () => targets.primary.forEach((name) => targets.load(name));
const prefetchSecondary = () => targets.secondary.forEach((name) => targets.load(name));
```

- [ ] **Step 4: Убедиться, что тесты проходят**

Запустить: `bun run test -- src/app/router/prefetch.spec.ts`
Ожидаемо: PASS, 2 теста.

- [ ] **Step 5: Обновить документацию**

`DESIGN_SYSTEM.md`:
- исправить описание `UModal` (строки 201-213): он всегда центрированный диалог, мобильного bottom-sheet у него нет;
- добавить раздел про десктоп: порог 1024, `UOverlay` с режимами `panel` / `dialog`, `DesktopPage` / `DesktopColumns`, ширина контента 1440.

`frontend/CLAUDE.md` — в раздел «Conventions & gotchas» дописать: платформенное ветвление только через `@/shared/lib/platform`, десктопные страницы подключаются `platformPage`, `pb-28` в десктопной ветке не нужен.

- [ ] ~~**Step 6: Добавить запись в changelog**~~ — **отменено пользователем 2026-07-31**: версию не бампаем, запись не добавляем. Шаг оставлен зачёркнутым, чтобы его не восстановили по невнимательности.

<details>
<summary>Исходный текст шага</summary>

В `src/features/changelog/model/changelogData.ts` **в начало** массива `CHANGELOG_ENTRIES`, с патч-версией на единицу больше текущей:

```ts
{
  version: '1.0.XX',
  date: '2026-07-31',
  type: 'improvement',
  title: 'Веб-версия на широком экране',
  description:
    'Главная, счета и создание операции получили раскладку для компьютера: боковая панель, две колонки и форма в окне поверх страницы.',
}
```

Точную форму записи взять из соседних элементов массива — структура полей должна совпасть.

</details>

- [ ] **Step 7: Финальная проверка**

```bash
bun run test
bun run lint
bunx vue-tsc -b
bun run build && bun run check:bundle
```

Ожидаемо: тесты зелёные, типы чистые, расход стартового бандла не превышает 250 КБ gzip и не вырос заметно относительно исходных 236.4 КБ.

---

## Проверка вручную

После Task 9 поднять стенд и пройти сценарии на 1440 px и на 390 px:

```bash
docker compose up -d postgres          # из корня репозитория
cd backend && bun run start:dev
cd frontend && VITE_API_URL=http://localhost:3000 npx vite --port 5174 --strictPort
```

1. `1440 px`: сайдбар слева, у Главной есть шапка, контент в две колонки, боковая панель липкая при скролле.
2. `1440 px`: клик по счёту в `/accounts` меняет URL; F5 сохраняет выбор.
3. `1440 px`: «Добавить операцию» открывает окно поверх страницы; Esc закрывает; после сохранения остаёшься там же.
4. `1023 px`: нижняя навигация, мобильная разметка — переход через границу не оставляет пустого экрана.
5. `390 px`: Главная, счета и создание операции выглядят ровно как до изменений.
