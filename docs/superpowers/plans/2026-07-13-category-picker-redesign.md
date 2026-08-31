# Category Picker Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить горизонтально-скроллируемые чипы категорий в форме транзакции на инлайн топ-8 частых категорий + bottom sheet со всеми категориями и поиском (mobile-first).

**Architecture:** Новые компоненты `CategoryPicker.vue` (инлайн flex-wrap чипы, рендерит шит внутри) и `CategoryPickerSheet.vue` (vaul-vue drawer: bottom на мобиле, right на desktop) в `entities/category/ui/`. Частотное ранжирование — чистая функция `getFrequentCategories` из уже загруженного кэша `useRecentTransactions(userId, 20)`. Существующий `CategoryChips.vue` НЕ трогаем — остальные 7 мест использования вне скоупа.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, vaul-vue, Tailwind v4 semantic tokens, vitest + @vue/test-utils.

**Спек:** `docs/superpowers/specs/2026-07-13-category-picker-redesign-design.md`

## Global Constraints

- **БЕЗ git-коммитов** — правило пользователя: коммиты только по явной просьбе. Шаги «Commit» заменены на «Verify»; изменения остаются в working tree.
- Тесты запускать через subagent `test-runner` (правило пользователя: логи тестов не в основном контексте). Команда: `cd frontend && bun run test:unit -- <паттерн>` — уточни фактический скрипт в `frontend/package.json` (`test`, `test:unit` или `vitest run`).
- Дизайн-токены: только семантические (`bg-card-light dark:bg-card-dark`, `text-text-primary-light dark:text-text-primary-dark` и т.д.), не сырые Tailwind-цвета.
- Иконки: `<UIcon name="material_symbol_name" />`; если имени нет в `frontend/src/shared/ui/icon/iconMap.ts` — добавить маппинг туда.
- Русские строки UI — как в спеке, буква «ё» сохраняется («Всё» не встречается, но «— выберите» и пр. копировать дословно).
- `cn()` из `@/shared/lib/utils` для динамических классов.
- Файлы фронта: `frontend/src/...` (все пути ниже относительны `frontend/src/`, если не указано иное).

---

### Task 1: `getFrequentCategories` — частотное ранжирование

**Files:**
- Create: `frontend/src/entities/category/model/useFrequentCategories.ts`
- Test: `frontend/src/entities/category/model/useFrequentCategories.spec.ts`

**Interfaces:**
- Consumes: `Category` из `./types`, `Transaction` из `@/shared/api/database.types` (у транзакции есть поля `category_id: string`, `type: string`).
- Produces: `getFrequentCategories(categories: Category[], transactions: Transaction[] | undefined, topN = 8): Category[]` — Task 4 вызывает её в computed.

- [ ] **Step 1: Написать падающий тест**

Создать `frontend/src/entities/category/model/useFrequentCategories.spec.ts`. Хелпер `makeTx` скопировать по образцу из `frontend/src/features/add-transaction/model/useSmartDefaults.spec.ts` (там полный объект `Transaction` со всеми обязательными полями — взять его дословно и параметризовать `category_id`).

```typescript
import { describe, it, expect } from 'vitest';
import { getFrequentCategories } from './useFrequentCategories';
import type { Category } from './types';
import type { Transaction } from '@/shared/api/database.types';

// makeTx: скопировать фабрику полного объекта Transaction из
// features/add-transaction/model/useSmartDefaults.spec.ts (строки ~10-40),
// оставив override только для category_id:
// function makeTx(categoryId: string): Transaction { ...category_id: categoryId... }

function makeCat(id: string, isFrequent?: boolean): Category {
  return { id, name: id, icon: 'restaurant', color: '#f00', type: 'expense', isFrequent };
}

describe('getFrequentCategories', () => {
  it('ранжирует по частоте употребления в транзакциях', () => {
    const cats = [makeCat('a'), makeCat('b'), makeCat('c')];
    const txs = [
      makeTx('c'), makeTx('c'), makeTx('c'),
      makeTx('b'), makeTx('b'),
      makeTx('a'),
    ];
    expect(getFrequentCategories(cats, txs, 8).map((c) => c.id)).toEqual(['c', 'b', 'a']);
  });

  it('обрезает до topN', () => {
    const cats = ['a', 'b', 'c'].map((id) => makeCat(id));
    const txs = [makeTx('a'), makeTx('b'), makeTx('c'), makeTx('c'), makeTx('a')];
    expect(getFrequentCategories(cats, txs, 2)).toHaveLength(2);
  });

  it('fallback на isFrequent при < 5 транзакций', () => {
    const cats = [makeCat('a', false), makeCat('b'), makeCat('c', true)];
    const txs = [makeTx('a'), makeTx('a'), makeTx('a'), makeTx('a')]; // 4 шт
    // isFrequent !== false → 'b' и 'c' в порядке исходного массива
    expect(getFrequentCategories(cats, txs, 8).map((c) => c.id)).toEqual(['b', 'c']);
  });

  it('fallback при undefined transactions', () => {
    const cats = [makeCat('a'), makeCat('b', false)];
    expect(getFrequentCategories(cats, undefined, 8).map((c) => c.id)).toEqual(['a']);
  });

  it('добирает до topN: сначала isFrequent, потом остальные в порядке БД', () => {
    const cats = [makeCat('a', false), makeCat('b'), makeCat('c'), makeCat('used')];
    const txs = Array.from({ length: 5 }, () => makeTx('used'));
    // used — по статистике; добор: b, c (isFrequent!==false), затем a
    expect(getFrequentCategories(cats, txs, 4).map((c) => c.id)).toEqual(['used', 'b', 'c', 'a']);
  });

  it('игнорирует category_id, которых нет в переданном списке категорий', () => {
    const cats = [makeCat('a')];
    const txs = Array.from({ length: 5 }, () => makeTx('other-type-cat'));
    expect(getFrequentCategories(cats, txs, 8).map((c) => c.id)).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Через subagent `test-runner`: `cd frontend && bun run test -- useFrequentCategories`
Expected: FAIL — модуль `./useFrequentCategories` не существует.

- [ ] **Step 3: Минимальная реализация**

Создать `frontend/src/entities/category/model/useFrequentCategories.ts`:

```typescript
import type { Category } from './types';
import type { Transaction } from '@/shared/api/database.types';

const MIN_TRANSACTIONS_FOR_STATS = 5;

/**
 * Топ-N категорий по частоте употребления в последних транзакциях.
 * При недостатке истории (< 5 транзакций) — fallback на ручной флажок isFrequent.
 * Если по статистике набралось меньше topN — добор: isFrequent-категории, затем порядок БД.
 */
export function getFrequentCategories(
  categories: Category[],
  transactions: Transaction[] | undefined,
  topN = 8,
): Category[] {
  const manualFrequent = categories.filter((c) => c.isFrequent !== false);

  if (!transactions || transactions.length < MIN_TRANSACTIONS_FOR_STATS) {
    return manualFrequent.slice(0, topN);
  }

  const knownIds = new Set(categories.map((c) => c.id));
  const counts = new Map<string, number>();
  for (const tx of transactions) {
    if (knownIds.has(tx.category_id)) {
      counts.set(tx.category_id, (counts.get(tx.category_id) ?? 0) + 1);
    }
  }

  // Array.prototype.sort стабилен: при равной частоте сохраняется порядок БД
  const ranked = categories
    .filter((c) => counts.has(c.id))
    .sort((a, b) => counts.get(b.id)! - counts.get(a.id)!)
    .slice(0, topN);

  if (ranked.length < topN) {
    const used = new Set(ranked.map((c) => c.id));
    for (const c of [...manualFrequent, ...categories]) {
      if (ranked.length >= topN) break;
      if (!used.has(c.id)) {
        ranked.push(c);
        used.add(c.id);
      }
    }
  }

  return ranked;
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Через subagent `test-runner`: `cd frontend && bun run test -- useFrequentCategories`
Expected: PASS (6 тестов).

- [ ] **Step 5: Verify**

Изменённые файлы на месте, тесты зелёные. Без коммита.

---

### Task 2: `categorySearch` — нормализация и ранжирование поиска

**Files:**
- Create: `frontend/src/entities/category/model/categorySearch.ts`
- Test: `frontend/src/entities/category/model/categorySearch.spec.ts`

**Interfaces:**
- Consumes: `Category` из `./types`.
- Produces:
  - `normalizeSearchText(text: string): string`
  - `searchCategories(categories: Category[], query: string): Category[]` — Task 3 вызывает в computed; пустой/пробельный query возвращает исходный массив.

- [ ] **Step 1: Написать падающий тест**

Создать `frontend/src/entities/category/model/categorySearch.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeSearchText, searchCategories } from './categorySearch';
import type { Category } from './types';

function makeCat(id: string, name: string): Category {
  return { id, name, icon: 'restaurant', color: '#f00', type: 'expense' };
}

describe('normalizeSearchText', () => {
  it('приводит к нижнему регистру и обрезает пробелы', () => {
    expect(normalizeSearchText('  ЕдА  ')).toBe('еда');
  });

  it('заменяет ё на е', () => {
    expect(normalizeSearchText('Копилка-мёд')).toBe('копилка-мед');
  });

  it('схлопывает множественные пробелы', () => {
    expect(normalizeSearchText('дом   и   быт')).toBe('дом и быт');
  });
});

describe('searchCategories', () => {
  const cats = [
    makeCat('food', 'Еда и напитки'),
    makeCat('transport', 'Транспорт'),
    makeCat('sport', 'Спорт'),
    makeCat('honey', 'Мёд'),
  ];

  it('пустой запрос возвращает все категории', () => {
    expect(searchCategories(cats, '')).toEqual(cats);
    expect(searchCategories(cats, '   ')).toEqual(cats);
  });

  it('находит по началу любого слова', () => {
    expect(searchCategories(cats, 'нап').map((c) => c.id)).toEqual(['food']);
  });

  it('prefix-совпадения ранжируются выше совпадений в середине слова', () => {
    // 'спорт': prefix у 'Спорт', substring у 'Транспорт'
    expect(searchCategories(cats, 'спорт').map((c) => c.id)).toEqual(['sport', 'transport']);
  });

  it('ищет без учёта ё/е и регистра', () => {
    expect(searchCategories(cats, 'МЕД').map((c) => c.id)).toEqual(['honey']);
  });

  it('возвращает пустой массив, если ничего не найдено', () => {
    expect(searchCategories(cats, 'xyz')).toEqual([]);
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Через subagent `test-runner`: `cd frontend && bun run test -- categorySearch`
Expected: FAIL — модуль не существует.

- [ ] **Step 3: Минимальная реализация**

Создать `frontend/src/entities/category/model/categorySearch.ts`:

```typescript
import type { Category } from './types';

/** Нормализация для поиска: нижний регистр, ё→е, схлопывание пробелов. */
export function normalizeSearchText(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е').trim().replace(/\s+/g, ' ');
}

/**
 * Фильтрует и ранжирует категории по запросу:
 * совпадения по началу слова — выше совпадений в середине.
 * Пустой запрос возвращает исходный список.
 */
export function searchCategories(categories: Category[], query: string): Category[] {
  const q = normalizeSearchText(query);
  if (!q) return categories;

  const prefixMatches: Category[] = [];
  const substringMatches: Category[] = [];

  for (const category of categories) {
    const name = normalizeSearchText(category.name);
    const words = name.split(/[\s\-/]+/);
    if (words.some((w) => w.startsWith(q))) {
      prefixMatches.push(category);
    } else if (name.includes(q)) {
      substringMatches.push(category);
    }
  }

  return [...prefixMatches, ...substringMatches];
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Через subagent `test-runner`: `cd frontend && bun run test -- categorySearch`
Expected: PASS (8 тестов).

- [ ] **Step 5: Verify**

Тесты зелёные. Без коммита.

---

### Task 3: `CategoryPickerSheet.vue` — шит со всеми категориями

**Files:**
- Create: `frontend/src/entities/category/ui/CategoryPickerSheet.vue`

**Interfaces:**
- Consumes: `searchCategories` из `../model/categorySearch` (Task 2); `useIsDesktop` из `@/shared/lib/composables/useIsDesktop`; `UIcon`, `UInput`, `IconBadge` из `@/shared/ui`; `ROUTE_NAMES.SETTINGS_CATEGORIES` из `@/shared/config/routeNames`; vaul-vue (`DrawerRoot`, `DrawerPortal`, `DrawerOverlay`, `DrawerContent`, `DrawerHandle`, `DrawerTitle` — образец импортов в `frontend/src/features/split-expense/ui/SplitExpenseDrawer.vue`).
- Produces: компонент с пропсами `{ open: boolean; categories: Category[]; selectedId: string }` и эмитами `'update:open': [boolean]`, `select: [categoryId: string]`. Task 4 рендерит его.

Компонентный тест на шит не пишем: vaul-vue рендерится через портал и завязан на реальные размеры — в jsdom это хрупко. Логика поиска покрыта Task 2, интеграция — Task 4 (шит стабом) и ручная проверка в Task 6.

- [ ] **Step 1: Реализовать компонент**

Создать `frontend/src/entities/category/ui/CategoryPickerSheet.vue`:

```vue
<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UIcon, UInput, IconBadge } from '@/shared/ui';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { ROUTE_NAMES } from '@/shared/config/routeNames';
import type { Category } from '../model/types';
import { searchCategories } from '../model/categorySearch';

const props = defineProps<{
  open: boolean;
  categories: Category[];
  selectedId: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  select: [categoryId: string];
}>();

const isDesktop = useIsDesktop();
const router = useRouter();

const searchQuery = ref('');
const searchInputRef = ref<InstanceType<typeof UInput> | null>(null);

const filtered = computed(() => searchCategories(props.categories, searchQuery.value));
const isSearching = computed(() => searchQuery.value.trim().length > 0);

// При открытии: сброс поиска; autofocus только на desktop —
// на мобиле клавиатура сразу съела бы пол-шита
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    searchQuery.value = '';
    if (isDesktop.value) nextTick(() => searchInputRef.value?.focus());
  },
);

function handleSelect(categoryId: string) {
  emit('select', categoryId);
}

// Enter (кнопка «Готово» на мобильной клавиатуре) выбирает первое совпадение
function handleEnter() {
  const first = filtered.value[0];
  if (isSearching.value && first) handleSelect(first.id);
}

function toManageCategories() {
  emit('update:open', false);
  router.push({ name: ROUTE_NAMES.SETTINGS_CATEGORIES });
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
            : 'bottom-0 left-0 right-0 rounded-t-2xl border-t border-border-light dark:border-border-dark h-[85dvh]'
        "
      >
        <!-- Handle (mobile only) -->
        <div v-if="!isDesktop" class="flex justify-center pt-3 pb-1">
          <DrawerHandle class="w-10 h-1 rounded-full bg-border-light dark:bg-border-dark" />
        </div>

        <!-- Header -->
        <div class="flex items-center justify-between px-5 pb-3" :class="{ 'pt-4': isDesktop }">
          <DrawerTitle
            class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
          >
            Категория
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

        <!-- Search (sticky над скроллом) -->
        <div class="px-5 pb-3">
          <UInput
            ref="searchInputRef"
            v-model="searchQuery"
            variant="search"
            placeholder="Поиск категории..."
            data-testid="category-sheet-search"
            @keydown.enter="handleEnter"
          />
        </div>

        <!-- Scrollable grid -->
        <div class="flex-1 overflow-y-auto px-5 pb-4 overscroll-contain" data-vaul-no-drag>
          <div
            v-if="filtered.length === 0"
            class="flex flex-col items-center gap-3 py-8 text-center"
          >
            <p class="text-sm text-text-tertiary-light dark:text-text-tertiary-dark">
              Ничего не найдено
            </p>
          </div>

          <div v-else role="radiogroup" aria-label="Все категории" class="grid grid-cols-4 gap-2">
            <button
              v-for="(category, idx) in filtered"
              :key="category.id"
              type="button"
              role="radio"
              :aria-checked="category.id === selectedId"
              class="flex flex-col items-center gap-1.5 px-1 py-2 rounded-xl border transition-colors min-h-[76px]"
              :class="
                category.id === selectedId
                  ? ''
                  : isSearching && idx === 0
                    ? 'border-primary/40 bg-primary/[0.04]'
                    : 'border-transparent hover:bg-surface-light dark:hover:bg-surface-dark'
              "
              :style="
                category.id === selectedId
                  ? { borderColor: category.color, backgroundColor: category.color + '10' }
                  : undefined
              "
              @click="handleSelect(category.id)"
            >
              <IconBadge :icon="category.icon" :color="category.color" size="lg" />
              <span
                class="text-xs text-center leading-tight line-clamp-2 text-text-primary-light dark:text-text-primary-dark"
              >
                {{ category.name }}
              </span>
            </button>
          </div>
        </div>

        <!-- Footer: управление категориями -->
        <div class="px-5 py-3 border-t border-border-light dark:border-border-dark">
          <button
            type="button"
            class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
            @click="toManageCategories"
          >
            <UIcon name="settings" size="sm" />
            Управление категориями
          </button>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
```

- [ ] **Step 2: Проверить типы**

Run: `cd frontend && bun run build` (vue-tsc + Vite; либо только type-check, если есть отдельный скрипт).
Expected: без ошибок типов в новом файле. Если `line-clamp-2` неизвестен Tailwind v4 — заменить на `line-clamp-2` из core (в v4 он в ядре; при проблеме использовать `overflow-hidden text-ellipsis`).

- [ ] **Step 3: Verify**

Компонент компилируется. Без коммита.

---

### Task 4: `CategoryPicker.vue` — инлайн-часть + интеграция шита

**Files:**
- Create: `frontend/src/entities/category/ui/CategoryPicker.vue`
- Modify: `frontend/src/entities/category/index.ts` (добавить экспорт)
- Test: `frontend/src/entities/category/ui/CategoryPicker.spec.ts`

**Interfaces:**
- Consumes: `getFrequentCategories` (Task 1), `CategoryPickerSheet` (Task 3), `useHaptics` из `@/shared/lib/haptics`, `UIcon` из `@/shared/ui`.
- Produces: компонент с пропсами `{ categories: Category[]; selectedId: string; label?: string; transactions?: Transaction[] }`, эмитом `select: [categoryId: string]`. Task 5 подключает его в панели.

- [ ] **Step 1: Написать падающий тест**

Создать `frontend/src/entities/category/ui/CategoryPicker.spec.ts`. Шит стабим (vaul-vue в jsdom не рендерим), haptics мокаем:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import CategoryPicker from './CategoryPicker.vue';
import type { Category } from '@/entities/category';

vi.mock('@/shared/lib/haptics', () => ({
  useHaptics: () => ({ trigger: vi.fn() }),
}));

function makeCat(id: string): Category {
  return { id, name: `Кат-${id}`, icon: 'restaurant', color: '#f00', type: 'expense' };
}

const manyCategories = Array.from({ length: 12 }, (_, i) => makeCat(`c${i}`));
const fewCategories = Array.from({ length: 6 }, (_, i) => makeCat(`c${i}`));

function mountPicker(props: Partial<InstanceType<typeof CategoryPicker>['$props']> = {}) {
  return mount(CategoryPicker, {
    props: { categories: manyCategories, selectedId: '', ...props },
    global: { stubs: { CategoryPickerSheet: true } },
  });
}

function chipButtons(wrapper: ReturnType<typeof mountPicker>) {
  return wrapper.findAll('button[role="radio"]');
}

describe('CategoryPicker', () => {
  it('при >9 категориях показывает 8 чипов и кнопку «Все категории»', () => {
    const wrapper = mountPicker();
    expect(chipButtons(wrapper)).toHaveLength(8);
    expect(wrapper.text()).toContain('Все категории');
    expect(wrapper.text()).toContain('12');
  });

  it('при ≤9 категориях показывает все чипы без кнопки «Все категории»', () => {
    const wrapper = mountPicker({ categories: fewCategories });
    expect(chipButtons(wrapper)).toHaveLength(6);
    expect(wrapper.text()).not.toContain('Все категории');
  });

  it('эмитит select по клику на чип', async () => {
    const wrapper = mountPicker();
    await chipButtons(wrapper)[0].trigger('click');
    expect(wrapper.emitted('select')).toEqual([['c0']]);
  });

  it('пинит выбранную категорию первым чипом, если она не в топ-8', () => {
    const wrapper = mountPicker({ selectedId: 'c11' });
    const chips = chipButtons(wrapper);
    expect(chips[0].text()).toContain('Кат-c11');
    expect(chips[0].attributes('aria-checked')).toBe('true');
  });

  it('не рендерит пин для несуществующей категории', () => {
    const wrapper = mountPicker({ selectedId: 'deleted' });
    expect(chipButtons(wrapper)).toHaveLength(8);
  });

  it('без транзакций показывает первые 8 по isFrequent-fallback (порядок БД)', () => {
    const wrapper = mountPicker();
    const ids = chipButtons(wrapper).map((b) => b.text());
    expect(ids[0]).toContain('Кат-c0');
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Через subagent `test-runner`: `cd frontend && bun run test -- CategoryPicker`
Expected: FAIL — компонент не существует.

- [ ] **Step 3: Реализовать компонент**

Создать `frontend/src/entities/category/ui/CategoryPicker.vue`:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import type { Transaction } from '@/shared/api/database.types';
import type { Category } from '../model/types';
import { getFrequentCategories } from '../model/useFrequentCategories';
import CategoryPickerSheet from './CategoryPickerSheet.vue';

const TOP_N = 8;

const props = defineProps<{
  categories: Category[];
  selectedId: string;
  label?: string;
  transactions?: Transaction[];
}>();

const emit = defineEmits<{
  select: [categoryId: string];
}>();

const { trigger } = useHaptics();
const sheetOpen = ref(false);

// ≤9 категорий — все инлайн, шит не нужен
const showAllButton = computed(() => props.categories.length > TOP_N + 1);

const frequent = computed(() =>
  getFrequentCategories(props.categories, props.transactions, TOP_N),
);

const inlineCategories = computed(() => {
  const base = showAllButton.value ? frequent.value : props.categories;
  const selected = props.categories.find((c) => c.id === props.selectedId);
  if (!selected || base.some((c) => c.id === selected.id)) return base;
  // Выбранная из шита / quick-action — пин первым чипом
  return [selected, ...base];
});

function selectCategory(categoryId: string) {
  trigger('selection');
  emit('select', categoryId);
  sheetOpen.value = false;
}

function getChipStyle(category: Category) {
  if (category.id !== props.selectedId) return undefined;
  return {
    color: category.color,
    borderColor: category.color,
    backgroundColor: `${category.color}15`,
  };
}
</script>

<template>
  <div>
    <div v-if="label" class="flex items-center gap-1.5 mb-2">
      <span class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        {{ label }}
      </span>
      <span
        v-if="!selectedId"
        class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        — выберите
      </span>
    </div>

    <div role="radiogroup" :aria-label="label || 'Категория'" class="flex flex-wrap gap-1.5">
      <button
        v-for="category in inlineCategories"
        :key="category.id"
        type="button"
        role="radio"
        :aria-checked="category.id === selectedId"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors duration-200 active:scale-95 whitespace-nowrap"
        :class="
          category.id !== selectedId
            ? 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
            : ''
        "
        :style="getChipStyle(category)"
        @click="selectCategory(category.id)"
      >
        <UIcon :name="category.icon" size="sm" :style="{ color: category.color }" />
        {{ category.name }}
      </button>

      <button
        v-if="showAllButton"
        type="button"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-dashed border-border-light dark:border-border-dark text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark active:scale-95 transition-colors duration-200 whitespace-nowrap"
        @click="sheetOpen = true"
      >
        <UIcon name="apps" size="sm" />
        Все категории · {{ categories.length }}
      </button>
    </div>

    <CategoryPickerSheet
      v-model:open="sheetOpen"
      :categories="categories"
      :selected-id="selectedId"
      @select="selectCategory"
    />
  </div>
</template>
```

Проверить, что `apps` есть в `frontend/src/shared/ui/icon/iconMap.ts` (grep `apps`); если нет — добавить маппинг на подходящую Lucide-иконку (например, `LayoutGrid`), следуя формату файла.

- [ ] **Step 4: Добавить экспорт**

В `frontend/src/entities/category/index.ts`:

```typescript
export * from './model/types';
export * from './model/constants';
export * from './api';
export { default as CategoryChips } from './ui/CategoryChips.vue';
export { default as CategoryPicker } from './ui/CategoryPicker.vue';
```

- [ ] **Step 5: Запустить тест — убедиться, что проходит**

Через subagent `test-runner`: `cd frontend && bun run test -- CategoryPicker`
Expected: PASS (6 тестов).

- [ ] **Step 6: Verify**

Тесты зелёные, экспорт добавлен. Без коммита.

---

### Task 5: Интеграция в форму транзакции

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/ExpensePanel.vue` (строки ~97-104: замена CategoryChips)
- Modify: `frontend/src/features/add-transaction/ui/IncomePanel.vue` (строки ~50-56: замена CategoryChips)
- Modify: `frontend/src/features/add-transaction/ui/TransactionForm.vue` (передать `transactions` в панели, строки ~328-380)

**Interfaces:**
- Consumes: `CategoryPicker` из `@/entities/category` (Task 4); реф `transactions` из `useRecentTransactions(userId, 20)` — уже существует в `TransactionForm.vue` (строка ~207).
- Produces: рабочая форма транзакции с новым пикером.

- [ ] **Step 1: ExpensePanel — заменить компонент**

В `frontend/src/features/add-transaction/ui/ExpensePanel.vue`:

1. Пропсы — добавить `transactions`:

```typescript
import type { Transaction } from '@/shared/api/database.types';

const props = defineProps<{
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
  categories: Category[];
  transactions?: Transaction[];
  splitData?: SplitExpenseData;
  splitValidationError?: string | null;
  autofocusAmount?: boolean;
  /** Hide the icon-only receipt-scan shortcut (import-confirm provides its own context-aware scan). */
  hideScanReceipt?: boolean;
}>();
```

2. Импорт: `import { CategoryChips } from '@/entities/category';` → `import { CategoryPicker } from '@/entities/category';`

3. В шаблоне заменить блок

```html
    <CategoryChips
      :categories="categories"
      :selected-id="formData.categoryId"
      :rows="4"
      label="Категория"
      searchable
      @select="updateField('categoryId', $event)"
    />
```

на

```html
    <CategoryPicker
      :categories="categories"
      :selected-id="formData.categoryId"
      :transactions="transactions"
      label="Категория"
      @select="updateField('categoryId', $event)"
    />
```

- [ ] **Step 2: IncomePanel — то же самое**

В `frontend/src/features/add-transaction/ui/IncomePanel.vue`: добавить проп `transactions?: Transaction[]` (импорт типа `Transaction` из `@/shared/api/database.types`), заменить импорт `CategoryChips` → `CategoryPicker`, в шаблоне:

```html
    <CategoryPicker
      :categories="categories"
      :selected-id="formData.categoryId"
      :transactions="transactions"
      label="Категория"
      @select="updateField('categoryId', $event)"
    />
```

(убрать `searchable`; `rows` в IncomePanel не было).

- [ ] **Step 3: TransactionForm — пробросить транзакции**

В `frontend/src/features/add-transaction/ui/TransactionForm.vue` реф `transactions` уже есть (`const { transactions } = useRecentTransactions(userId, 20);`). Добавить `:transactions="transactions"` в **три** места:
- `<ExpensePanel>` внутри `FeatureHintPopover` (строка ~328),
- `<ExpensePanel v-else-if="panelType === 'expense'">` (строка ~351),
- `<IncomePanel v-else-if="panelType === 'income'">` (строка ~374).

Пример для IncomePanel:

```html
          <IncomePanel
            v-else-if="panelType === 'income'"
            :form-data="formData"
            :accounts="accounts"
            :categories="incomeCategories"
            :transactions="transactions"
            @update:form-data="$emit('update:formData', $event)"
          />
```

- [ ] **Step 4: Type-check + полный прогон тестов**

Run: `cd frontend && bun run build` — Expected: без ошибок.
Через subagent `test-runner`: `cd frontend && bun run test` — Expected: все тесты проекта зелёные (включая нетронутый `CategoryChips.spec.ts`).

- [ ] **Step 5: Verify**

Сборка и тесты зелёные. Без коммита.

---

### Task 6: Changelog + сквозная проверка в браузере

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts` (запись в начало `CHANGELOG_ENTRIES`)

- [ ] **Step 1: Запись в changelog**

Открыть `frontend/src/features/changelog/model/changelogData.ts`, посмотреть текущую верхнюю версию, поднять **patch** (например `1.0.16` → `1.0.17`) и добавить запись В НАЧАЛО массива по формату существующих записей:

```typescript
  {
    version: '<bumped>',
    date: '2026-07-13',
    changes: [
      {
        type: 'improvement',
        description:
          'Выбор категории стал удобнее: самые используемые категории теперь на виду, а полный список со поиском открывается в отдельном окне',
      },
    ],
  },
```

(Точную структуру объекта сверить с существующими записями файла и повторить её; описание — простым языком, на русском.)

- [ ] **Step 2: Сквозная проверка (verify skill / вручную через chrome-devtools MCP)**

Поднять `cd frontend && bun run dev`, открыть страницу новой транзакции в мобильном вьюпорте (390×844):
1. Инлайн: видны ≤8 чипов + «Все категории · N», горизонтального скролла нет.
2. Тап «Все категории» → снизу открывается шит с сеткой 4 колонки.
3. Поиск в шите: ввод «еда» фильтрует; ввод с «ё»-словом находит «е»-вариант; Enter выбирает первое совпадение; шит закрывается, категория выбрана и запинена первым чипом (если не в топ-8).
4. Пустой запрос «zzz» → «Ничего не найдено» + внизу «Управление категориями», клик ведёт на страницу настроек категорий.
5. Desktop вьюпорт (1280×800): шит открывается справа, autofocus в поиске.
6. Доход: та же картина на вкладке «Доход».

- [ ] **Step 3: Финальная сборка**

Run: `cd frontend && bun run build`
Expected: успех. Изменения остаются в working tree (без коммита).

---

## Self-Review (выполнен)

- **Spec coverage:** частотность+fallback → Task 1; поиск/нормализация/Enter → Task 2+3; шит (vaul, 4 колонки, sticky-поиск, autofocus desktop-only, «Управление категориями», haptics, a11y) → Task 3+4; инлайн (топ-8, пин, ≤9 без кнопки, radiogroup) → Task 4; интеграция только в Expense/Income + проброс транзакций → Task 5; changelog → Task 6; краевые случаи спека покрыты тестами Task 1/4 и ручной проверкой Task 6. `CategoryChips` не изменяется ни в одной задаче. ✓
- **Placeholder scan:** нет TBD/TODO; единственные условные шаги — сверка формата changelog с существующим файлом и наличие иконки `apps` в iconMap (указано, как проверить и что сделать). ✓
- **Type consistency:** `getFrequentCategories(categories, transactions, topN)` едина в Task 1/4; `searchCategories(categories, query)` едина в Task 2/3; пропсы `CategoryPickerSheet` в Task 3 совпадают с использованием в Task 4; проп `transactions` в Task 4/5 везде `Transaction[] | undefined`. ✓
