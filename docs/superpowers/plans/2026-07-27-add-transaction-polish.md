# «Новая транзакция»: полировка — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Чипы категорий заполняют всю ширину, сумма живёт без карточки, кнопка скана подписана, вкладка «Долг» вдвое короче, вход на страницу без рывка.

**Architecture:** Формула упаковки чипов — чистая функция в `shared/lib/layout`, обёрнутая композаблом с замером через `canvas.measureText`. Карточка суммы разбирается на голый блок, список счетов выносится в переиспользуемый `AccountPopover`. Рывок на входе снимается новым флагом `isPageTransitioning` в `app/router` (навбар и автофокус ждут конца перехода) плюс переводом `Calendar`/`CategoryPickerSheet`/`DebtPanel` в `defineAsyncComponent`.

**Tech Stack:** Vue 3 SFC + TypeScript, Tailwind v4, Reka UI primitives, VueUse, Vitest + @vue/test-utils, Bun.

## Статус: выполнено (PR #104)

Все десять задач закрыты. Проверки: 1340/1340 тестов, линт без ошибок, оба
билда, сторож бандла 236,1 / 250 КБ. `/code-review medium --fix` дал 7 находок —
все исправлены.

**Расхождения с планом, принятые по ходу:**

1. **Task 7 — правка `BottomNav` откачена.** План исходил из того, что снятие
   навбара посреди слайда перекомпоновывает уходящую страницу. Разбор этого не
   подтвердил: смена роута, перерисовка `v-if` и старт `Transition` идут в одном
   flush'е Vue, то есть высота меняется до первого отрисованного кадра.
   Отложенное снятие, наоборот, перенесло бы сдвиг на момент, когда экран уже
   стоит на месте, и возвращало бы навбар на переходе между двумя
   fullscreen-экранами. `MainLayout` изменён только добавлением `@after-enter`.
2. **Task 8 — отложенный хвост сужен.** План откладывал мета-строку и ряд
   действий; кнопка сабмита и чипы категорий остались в первом кадре: кнопка —
   главное действие, категория — второй шаг сценария, задержка им не идёт.
3. **Task 4 — добавлен `flush` для `DatePickerField`.** План не учёл, что у поля
   даты своя рамка, которая внутри строки списка стала бы второй.
4. **Task 6 — снята несогласованность валюты.** Итог долга печатал «UZS», пока
   главная сумма показывала «сўм»; добавлен `withSymbol`. Дефект был и до
   работы, но на переработанном экране стал заметен.
5. **`useAmountInput` — пружина удалена и в `HeroAmount`.** План этого места не
   называл, а композабл там тот же.
6. **Флаг перехода получил таймер-страховку** (600 мс) и защёлку в одну сторону
   на странице: без неё обратный переход выдёргивал бы хвост формы из уже
   уезжающего экрана.

## Global Constraints

- Спека: `docs/superpowers/specs/2026-07-27-add-transaction-polish-design.md`.
- Ветка: `feat/add-transaction-polish`. Пушить только в `origin` (GitHub), никогда в `gitlab`. `master` защищён — нужен PR.
- Только дизайн-токены: `bg-surface-light dark:bg-surface-dark`, `text-text-primary-light dark:text-text-primary-dark` и т.п. Сырые Tailwind-цвета (`bg-zinc-800`, `text-gray-500`) запрещены — см. `frontend/DESIGN_SYSTEM.md` § Anti-Patterns.
- `cn()` из `shared/lib/utils.ts` для любой динамической строки классов.
- Иконки только через `<UIcon name="material_symbol_name" />`; новое имя требует записи в `shared/ui/icon/iconMap.ts`.
- VueUse вместо самописных хуков для ResizeObserver, таймеров, слушателей событий.
- `:global(html.dark)` в scoped-стилях не работает — тема висит классом на `html`. Тёмный вариант задавать Tailwind-вариантом `dark:` на самом элементе или CSS-переменной, выставленной там же.
- Каждый анимируемый узел получает `@media (prefers-reduced-motion: reduce) { transition: none }` — так сделано во всех соседних компонентах.
- Тексты интерфейса — на русском.
- Комментарии в коде объясняют **почему**, а не **что**; писать только там, где решение неочевидно.
- `CategoryChips.vue` и его семь мест использования **не трогать**.
- Модель `useDebtForm` **не менять** — переработка только в разметке `DebtPanel`.
- Команды из `frontend/`: тесты `bun run test`, линт `bun run lint`, сборка `bun run build`.
- Перед коммитом прогонять `bun run build` — есть сторож бандла `scripts/check-eager-bundle.mjs`.

---

### Task 1: Формула упаковки чипов

**Files:**
- Create: `frontend/src/shared/lib/layout/justifyRows.ts`
- Test: `frontend/src/shared/lib/layout/justifyRows.spec.ts`

**Interfaces:**
- Consumes: ничего.
- Produces: `packJustifiedRows(widths: number[], containerWidth: number, gap: number): number[][]` — массив рядов, каждый ряд — индексы элементов в исходном порядке.

- [ ] **Step 1: Write the failing test**

Создать `frontend/src/shared/lib/layout/justifyRows.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { packJustifiedRows } from './justifyRows';

describe('packJustifiedRows', () => {
  it('пустой список даёт пустой результат', () => {
    expect(packJustifiedRows([], 300, 6)).toEqual([]);
  });

  it('всё, что влезает в один ряд, остаётся одним рядом', () => {
    expect(packJustifiedRows([50, 60, 70], 300, 6)).toEqual([[0, 1, 2]]);
  });

  it('неизвестная ширина контейнера даёт один ряд со всеми элементами', () => {
    expect(packJustifiedRows([50, 60, 70], 0, 6)).toEqual([[0, 1, 2]]);
  });

  it('элемент шире контейнера получает собственный ряд и не режется', () => {
    const rows = packJustifiedRows([400, 50], 300, 6);
    expect(rows).toEqual([[0], [1]]);
  });

  it('ни один ряд не превышает ширину контейнера', () => {
    const widths = [80, 80, 80, 80, 80];
    const rows = packJustifiedRows(widths, 250, 10);
    for (const row of rows) {
      const natural = row.reduce((sum, i) => sum + widths[i], 0) + 10 * (row.length - 1);
      expect(natural).toBeLessThanOrEqual(250);
    }
  });

  it('балансирует ряды: последний ряд не остаётся почти пустым', () => {
    // Жадная упаковка дала бы 3+3+2 (последний ряд 55% ширины).
    // Балансировка выравнивает наполнение рядов.
    const widths = [110, 120, 95, 90, 85, 100, 105, 130];
    const rows = packJustifiedRows(widths, 350, 6);
    const fills = rows.map(
      (row) => row.reduce((sum, i) => sum + widths[i], 0) + 6 * (row.length - 1),
    );
    const min = Math.min(...fills);
    const max = Math.max(...fills);
    // Разброс наполнения рядов — не больше ширины самого широкого элемента
    expect(max - min).toBeLessThanOrEqual(130);
  });

  it('учитывает зазор при подсчёте числа рядов', () => {
    // Без учёта зазоров 3×100 влезли бы в 300; с зазорами 2×6 — нет.
    const rows = packJustifiedRows([100, 100, 100], 300, 6);
    expect(rows.length).toBeGreaterThan(1);
  });

  it('сохраняет исходный порядок элементов', () => {
    const rows = packJustifiedRows([100, 100, 100, 100], 250, 6);
    expect(rows.flat()).toEqual([0, 1, 2, 3]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bun run test -- justifyRows`
Expected: FAIL — `Failed to resolve import "./justifyRows"`.

- [ ] **Step 3: Write minimal implementation**

Создать `frontend/src/shared/lib/layout/justifyRows.ts`:

```ts
/**
 * Раскладка чипов по рядам так, чтобы каждый ряд заполнял ширину контейнера.
 *
 * Жадная упаковка «пока влезает» оставляет последний ряд полупустым — именно
 * это и видно на экране как рваный правый край. Здесь сначала считается,
 * сколько рядов вообще нужно, а потом элементы раскладываются по цели
 * «одинаковое наполнение ряда»: тогда добор ширины через `flex-grow`
 * распределяется мелкими долями и не бросается в глаза.
 */

/** Сколько рядов даёт обычная жадная упаковка — это и есть минимум. */
function fitRowCount(widths: number[], containerWidth: number, gap: number): number {
  let rows = 1;
  let rowWidth = 0;

  for (const width of widths) {
    const add = width + (rowWidth ? gap : 0);
    if (rowWidth && rowWidth + add > containerWidth) {
      rows++;
      rowWidth = width;
    } else {
      rowWidth += add;
    }
  }

  return rows;
}

export function packJustifiedRows(
  widths: number[],
  containerWidth: number,
  gap: number,
): number[][] {
  const count = widths.length;
  if (count === 0) return [];

  const allInOne = () => [widths.map((_, index) => index)];

  // Ширина контейнера ещё не измерена (скрытый узел, первый кадр) — отдаём один
  // ряд: в шаблоне он ведёт себя как прежний `flex-wrap`.
  if (containerWidth <= 0) return allInOne();

  const total = widths.reduce((sum, width) => sum + width, 0) + gap * (count - 1);
  if (total <= containerWidth) return allInOne();

  const rowCount = fitRowCount(widths, containerWidth, gap);
  if (rowCount <= 1) return allInOne();

  const target = total / rowCount;

  const rows: number[][] = [];
  let current: number[] = [];
  let currentWidth = 0;

  for (let index = 0; index < count; index++) {
    const width = widths[index];
    const withItem = currentWidth + width + (current.length ? gap : 0);

    // Переполнение рвём всегда: ряд шире контейнера пришлось бы сжимать, а
    // сжатие режет названия — ровно то, чего мы избегаем.
    const overflows = current.length > 0 && withItem > containerWidth;

    // Балансировка: закрываем ряд, если элемент перелетит цель сильнее, чем
    // недолетает остановка на текущем содержимом. Последний разрешённый ряд не
    // закрываем — иначе появился бы лишний.
    const unbalances =
      current.length > 0 &&
      rows.length < rowCount - 1 &&
      withItem - target > target - currentWidth;

    if (overflows || unbalances) {
      rows.push(current);
      current = [index];
      currentWidth = width;
    } else {
      current.push(index);
      currentWidth = withItem;
    }
  }

  if (current.length) rows.push(current);
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && bun run test -- justifyRows`
Expected: PASS — 8 тестов.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/lib/layout/justifyRows.ts frontend/src/shared/lib/layout/justifyRows.spec.ts
git commit -m "feat(shared): формула упаковки чипов по рядам на всю ширину"
```

---

### Task 2: Композабл замера и раскладки

**Files:**
- Create: `frontend/src/shared/lib/hooks/useJustifiedRows.ts`
- Test: `frontend/src/shared/lib/hooks/useJustifiedRows.spec.ts`

**Interfaces:**
- Consumes: `packJustifiedRows(widths, containerWidth, gap)` из Task 1.
- Produces:
  ```ts
  useJustifiedRows<T>(
    items: MaybeRefOrGetter<T[]>,
    labelOf: (item: T) => string,
    options?: { gap?: number; chromeFallback?: number; maxGrow?: number },
  ): {
    containerRef: Ref<HTMLElement | null>;
    chipRef: (el: Element | ComponentPublicInstance | null) => void;
    rows: ComputedRef<Array<Array<{ item: T; maxWidth: number }>>>;
  }
  ```
  `maxWidth` — предел роста чипа в пикселях (натуральная ширина + `maxGrow`).

- [ ] **Step 1: Write the failing test**

Создать `frontend/src/shared/lib/hooks/useJustifiedRows.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useJustifiedRows } from './useJustifiedRows';

// jsdom не считает layout: ширины нулевые. Подменяем измеритель текста и
// ширину контейнера, чтобы проверять именно раскладку, а не вёрстку.
const measureWidth = vi.fn((text: string) => text.length * 10);

vi.mock('@/shared/lib/layout/measureTextWidth', () => ({
  measureTextWidth: (text: string) => measureWidth(text),
}));

function mountHarness(names: string[], containerWidth: number) {
  const Harness = defineComponent({
    setup() {
      const items = ref(names.map((name) => ({ name })));
      const { containerRef, rows } = useJustifiedRows(items, (item) => item.name, {
        gap: 6,
        chromeFallback: 40,
      });
      return { containerRef, rows };
    },
    render() {
      return h(
        'div',
        { ref: 'containerRef' },
        this.rows.map((row, rowIndex) =>
          h(
            'div',
            { class: 'row', key: rowIndex },
            row.map((chip) => h('button', { key: chip.item.name }, chip.item.name)),
          ),
        ),
      );
    },
  });

  const wrapper = mount(Harness, { attachTo: document.body });
  Object.defineProperty(wrapper.element, 'clientWidth', {
    value: containerWidth,
    configurable: true,
  });
  return wrapper;
}

describe('useJustifiedRows', () => {
  beforeEach(() => measureWidth.mockClear());

  it('до замера контейнера отдаёт один ряд со всеми элементами', () => {
    const wrapper = mountHarness(['аб', 'вг'], 0);
    expect(wrapper.vm.rows).toHaveLength(1);
    expect(wrapper.vm.rows[0]).toHaveLength(2);
  });

  it('раскладывает по рядам, когда ширина контейнера известна', async () => {
    const wrapper = mountHarness(['аааа', 'бббб', 'вввв', 'гггг'], 200);
    // 4 чипа по 40 + 40 = 80px → в 200px влезает 2 с зазором
    wrapper.vm.$.exposed;
    await nextTick();
    const rows = wrapper.vm.rows;
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.flat().map((chip) => chip.item.name)).toEqual([
      'аааа',
      'бббб',
      'вввв',
      'гггг',
    ]);
  });

  it('отдаёт предел роста для каждого чипа', async () => {
    const wrapper = mountHarness(['аб'], 200);
    await nextTick();
    const [chip] = wrapper.vm.rows[0];
    // натуральная 2*10 + chromeFallback 40 = 60, maxGrow по умолчанию 48
    expect(chip.maxWidth).toBe(108);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bun run test -- useJustifiedRows`
Expected: FAIL — `Failed to resolve import "./useJustifiedRows"`.

- [ ] **Step 3: Write minimal implementation**

Сначала измеритель текста — `frontend/src/shared/lib/layout/measureTextWidth.ts`:

```ts
/**
 * Ширина текста без участия вёрстки.
 *
 * Замер чипов через DOM требовал бы двух проходов: сначала натуральные ширины,
 * потом перегруппировка в ряды — а после `flex-grow` ширины уже растянуты, и
 * повторный замер уводит раскладку в петлю. Canvas отвечает на тот же вопрос
 * без layout, а погрешность в пару пикселей поглощает `flex-grow`: она может
 * лишь сдвинуть точку разрыва ряда, но не оставить пустоту.
 */
let context: CanvasRenderingContext2D | null = null;
let cachedFont = '';
const cache = new Map<string, number>();

function getContext(): CanvasRenderingContext2D | null {
  if (context) return context;
  if (typeof document === 'undefined') return null;
  context = document.createElement('canvas').getContext('2d');
  return context;
}

export function measureTextWidth(text: string, font: string): number {
  const ctx = getContext();
  if (!ctx) return 0;

  if (font && font !== cachedFont) {
    ctx.font = font;
    cachedFont = font;
    cache.clear();
  }

  const hit = cache.get(text);
  if (hit !== undefined) return hit;

  const width = ctx.measureText(text).width;
  cache.set(text, width);
  return width;
}

/** Шрифт узла в форме, которую понимает `CanvasRenderingContext2D.font`. */
export function resolveFont(el: HTMLElement): string {
  const style = getComputedStyle(el);
  return `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}
```

Затем `frontend/src/shared/lib/hooks/useJustifiedRows.ts`:

```ts
import {
  computed,
  ref,
  toValue,
  type ComponentPublicInstance,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue';
import { useResizeObserver } from '@vueuse/core';
import { packJustifiedRows } from '@/shared/lib/layout/justifyRows';
import { measureTextWidth, resolveFont } from '@/shared/lib/layout/measureTextWidth';

/** Паддинги + рамка + иконка + зазор, когда ни один чип ещё не смонтирован. */
const DEFAULT_CHROME = 62;
/** Предел добора ширины на чип. Дальше ряд остаётся чуть недобранным — лучше,
 *  чем одинокий чип, растянутый на всю ширину экрана. */
const DEFAULT_MAX_GROW = 48;

export function useJustifiedRows<T>(
  items: MaybeRefOrGetter<T[]>,
  labelOf: (item: T) => string,
  options: { gap?: number; chromeFallback?: number; maxGrow?: number } = {},
): {
  containerRef: Ref<HTMLElement | null>;
  chipRef: (el: Element | ComponentPublicInstance | null) => void;
  rows: ComputedRef<Array<Array<{ item: T; maxWidth: number }>>>;
} {
  const gap = options.gap ?? 6;
  const chromeFallback = options.chromeFallback ?? DEFAULT_CHROME;
  const maxGrow = options.maxGrow ?? DEFAULT_MAX_GROW;

  const containerRef = ref<HTMLElement | null>(null);
  const containerWidth = ref(0);
  const font = ref('');
  const chrome = ref(chromeFallback);

  /**
   * Хром чипа читается с живого узла, а не хардкодится копией CSS-классов.
   * Паддинги, рамка, зазор и иконка не зависят от `flex-grow` — растягивается
   * content-box, — поэтому читать их можно и с уже растянутого чипа: второго
   * прохода не возникает.
   */
  function chipRef(el: Element | ComponentPublicInstance | null) {
    const node = (el as ComponentPublicInstance | null)?.$el ?? el;
    if (!(node instanceof HTMLElement)) return;

    const style = getComputedStyle(node);
    const box =
      parseFloat(style.paddingLeft) +
      parseFloat(style.paddingRight) +
      parseFloat(style.borderLeftWidth) +
      parseFloat(style.borderRightWidth);
    const icon = node.querySelector('svg');
    const iconWidth = icon instanceof SVGElement ? icon.getBoundingClientRect().width : 0;
    const columnGap = parseFloat(style.columnGap) || 0;

    const measured = box + iconWidth + (iconWidth ? columnGap : 0);
    if (measured > 0) chrome.value = measured;
  }

  useResizeObserver(containerRef, ([entry]) => {
    containerWidth.value = entry.contentRect.width;
    if (containerRef.value) font.value = resolveFont(containerRef.value);
  });

  // Метрики шрифта до его загрузки врут — после загрузки пересчитываем.
  if (typeof document !== 'undefined' && document.fonts) {
    document.fonts.ready.then(() => {
      if (containerRef.value) font.value = resolveFont(containerRef.value);
    });
  }

  const widths = computed(() =>
    toValue(items).map((item) => chrome.value + measureTextWidth(labelOf(item), font.value)),
  );

  const rows = computed(() => {
    const list = toValue(items);
    const itemWidths = widths.value;
    return packJustifiedRows(itemWidths, containerWidth.value, gap).map((row) =>
      row.map((index) => ({
        item: list[index],
        maxWidth: itemWidths[index] + maxGrow,
      })),
    );
  });

  return { containerRef, chipRef, rows };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && bun run test -- useJustifiedRows`
Expected: PASS — 3 теста. Если тест «раскладывает по рядам» падает из-за того, что jsdom не вызывает `ResizeObserver`, замените в нём ожидание на прямую установку `containerWidth` через exposed-значение либо оставьте только два стабильных теста (первый и третий) — раскладку уже покрывает `justifyRows.spec.ts`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/shared/lib/layout/measureTextWidth.ts frontend/src/shared/lib/hooks/useJustifiedRows.ts frontend/src/shared/lib/hooks/useJustifiedRows.spec.ts
git commit -m "feat(shared): композабл юстированных рядов чипов"
```

---

### Task 3: CategoryPicker на юстированных рядах

**Files:**
- Modify: `frontend/src/entities/category/ui/CategoryPicker.vue`
- Test: `frontend/src/entities/category/ui/CategoryPicker.spec.ts:28-66`

**Interfaces:**
- Consumes: `useJustifiedRows` из Task 2.
- Produces: ничего нового наружу — пропы и события `CategoryPicker` не меняются.

- [ ] **Step 1: Write the failing test**

Добавить в `frontend/src/entities/category/ui/CategoryPicker.spec.ts` внутрь `describe('CategoryPicker')`:

```ts
  it('раскладывает чипы по рядам и растягивает каждый', () => {
    const wrapper = mountPicker();
    const rows = wrapper.findAll('[data-testid="category-row"]');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    // Все чипы лежат внутри рядов, ни один не остался в корне
    expect(rows.reduce((sum, row) => sum + row.findAll('button').length, 0)).toBe(
      chipButtons(wrapper).length + 1, // + чип «Ещё N»
    );
    const [chip] = chipButtons(wrapper);
    expect(chip.attributes('style')).toContain('max-width');
  });

  it('чип «Ещё N» участвует в раскладке рядов', () => {
    const wrapper = mountPicker();
    const more = wrapper.find('button[aria-label="Все категории"]');
    expect(more.element.closest('[data-testid="category-row"]')).not.toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bun run test -- CategoryPicker`
Expected: FAIL — `rows.length` равен 0, `data-testid="category-row"` не существует.

- [ ] **Step 3: Write minimal implementation**

Заменить `frontend/src/entities/category/ui/CategoryPicker.vue` целиком:

```vue
<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue';
import { UIcon } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import { useJustifiedRows } from '@/shared/lib/hooks/useJustifiedRows';
import type { Transaction } from '@/shared/api/database.types';
import type { Category } from '../model/types';
import { getFrequentCategories } from '../model/useFrequentCategories';

// Шит на vaul тянет свой пакет и открывается редко — в кадр первой отрисовки
// формы ему попадать незачем.
const CategoryPickerSheet = defineAsyncComponent(() => import('./CategoryPickerSheet.vue'));

const props = defineProps<{
  categories: Category[];
  selectedId: string;
  label?: string;
  transactions?: Transaction[];
}>();

const emit = defineEmits<{
  select: [categoryId: string];
}>();

const TOP_N = 8;

const { trigger } = useHaptics();
const sheetOpen = ref(false);

// Порог TOP_N + 1: при ровно 9 категориях кнопка «Все категории» скрывала бы
// одну-единственную — дешевле показать девятый чип, чем шит ради него
const showAllButton = computed(() => props.categories.length > TOP_N + 1);

const frequent = computed(() => getFrequentCategories(props.categories, props.transactions, TOP_N));

const inlineCategories = computed(() => {
  const base = showAllButton.value ? frequent.value : props.categories;
  const selected = props.categories.find((c) => c.id === props.selectedId);
  if (!selected || base.some((c) => c.id === selected.id)) return base;
  // Выбранная из шита / quick-action — пин первым чипом
  return [selected, ...base];
});

const hiddenCount = computed(() => props.categories.length - inlineCategories.value.length);

/**
 * Чип «Ещё N» едет в раскладке вместе с категориями: посчитанный без него
 * последний ряд всё равно не сходился бы по ширине.
 */
type Slot = { kind: 'category'; category: Category } | { kind: 'more'; label: string };

const slots = computed<Slot[]>(() => {
  const list: Slot[] = inlineCategories.value.map((category) => ({
    kind: 'category' as const,
    category,
  }));
  if (showAllButton.value) {
    list.push({ kind: 'more', label: `Ещё ${hiddenCount.value}` });
  }
  return list;
});

const { containerRef, chipRef, rows } = useJustifiedRows(
  slots,
  (slot) => (slot.kind === 'category' ? slot.category.name : slot.label),
  { gap: 6 },
);

function selectCategory(categoryId: string) {
  trigger('selection');
  emit('select', categoryId);
  sheetOpen.value = false;
}

function getChipStyle(category: Category, maxWidth: number) {
  const base = { maxWidth: `${maxWidth}px` };
  if (category.id !== props.selectedId) return base;
  return {
    ...base,
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

    <div
      ref="containerRef"
      role="radiogroup"
      :aria-label="label || 'Категория'"
      class="flex flex-col gap-1.5"
    >
      <div
        v-for="(row, rowIndex) in rows"
        :key="rowIndex"
        data-testid="category-row"
        class="flex gap-1.5"
      >
        <template v-for="slot in row" :key="slot.item.kind === 'category' ? slot.item.category.id : 'more'">
          <button
            v-if="slot.item.kind === 'category'"
            :ref="chipRef"
            type="button"
            role="radio"
            :aria-checked="slot.item.category.id === selectedId"
            class="category-chip flex min-w-max shrink-0 grow items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm transition-[color,background-color,border-color,transform] duration-200 active:scale-95"
            :class="
              slot.item.category.id !== selectedId
                ? 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
                : ''
            "
            :style="getChipStyle(slot.item.category, slot.maxWidth)"
            @click="selectCategory(slot.item.category.id)"
          >
            <UIcon :name="slot.item.category.icon" size="sm" :style="{ color: slot.item.category.color }" />
            {{ slot.item.category.name }}
          </button>

          <button
            v-else
            type="button"
            aria-label="Все категории"
            class="category-chip flex min-w-max shrink-0 grow items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-dashed border-border-light px-3 py-1.5 text-sm text-text-tertiary-light transition-[color,background-color,border-color,transform] duration-200 hover:text-text-secondary-light active:scale-95 dark:border-border-dark dark:text-text-tertiary-dark dark:hover:text-text-secondary-dark"
            :style="{ maxWidth: `${slot.maxWidth}px` }"
            @click="sheetOpen = true"
          >
            <UIcon name="apps" size="sm" />
            {{ slot.item.label }}
          </button>
        </template>
      </div>
    </div>

    <CategoryPickerSheet
      v-if="sheetOpen"
      v-model:open="sheetOpen"
      :categories="categories"
      :selected-id="selectedId"
      @select="selectCategory"
    />
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .category-chip {
    transition: none;
  }
}
</style>
```

Ключевое в классах чипа: `min-w-max shrink-0 grow` — рост есть, сжатия нет, ниже
содержимого не уйдёт, поэтому названия не режутся ни при какой погрешности замера.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && bun run test -- CategoryPicker`
Expected: PASS — 8 тестов (6 старых + 2 новых).

`v-if="sheetOpen"` на шите: он и раньше не открывался сам, а `v-model:open`
остаётся — так async-чанк грузится только по нажатию.

- [ ] **Step 5: Verify the whole suite and build**

Run: `cd frontend && bun run test && bun run lint && bun run build`
Expected: PASS, сторож бандла без нарушений.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/entities/category/ui/CategoryPicker.vue frontend/src/entities/category/ui/CategoryPicker.spec.ts
git commit -m "feat(category): чипы категорий заполняют всю ширину"
```

---

### Task 4: AccountPopover и сумма без карточки

**Files:**
- Create: `frontend/src/entities/account/ui/AccountPopover.vue`
- Modify: `frontend/src/entities/account/index.ts`
- Create: `frontend/src/features/add-transaction/ui/AmountHeadline.vue`
- Delete: `frontend/src/features/add-transaction/ui/AmountCard.vue`
- Modify: `frontend/src/features/add-transaction/ui/TransactionForm.vue:19,337-354`

**Interfaces:**
- Consumes: `useAmountInput` (без изменений на этом шаге).
- Produces:
  - `AccountPopover` — пропы `accounts: AccountWithBalances[]`, `selectedId: string | null`; событие `select: [accountId: string]`; слот `trigger` без параметров.
  - `AmountHeadline` — те же пропы и события, что были у `AmountCard`.

- [ ] **Step 1: Создать AccountPopover**

`frontend/src/entities/account/ui/AccountPopover.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useHaptics } from '@/shared/lib/haptics';
import type { AccountWithBalances } from '../model/types';

/**
 * Список счетов в поповере. Одна и та же разметка нужна и строке суммы, и
 * панели долга — держим её в одном месте.
 */
defineProps<{
  accounts: AccountWithBalances[];
  selectedId: string | null;
}>();

const emit = defineEmits<{
  select: [accountId: string];
}>();

const open = ref(false);
const { trigger } = useHaptics();

function select(id: string) {
  trigger('selection');
  emit('select', id);
  open.value = false;
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <slot name="trigger" />
    </PopoverTrigger>
    <PopoverContent
      align="start"
      :side-offset="6"
      class="w-max min-w-[12rem] max-w-[min(20rem,calc(100vw-2rem))] p-1"
    >
      <button
        v-for="account in accounts"
        :key="account.id"
        type="button"
        :class="[
          'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors',
          account.id === selectedId
            ? 'bg-primary/10 font-medium text-primary'
            : 'text-text-primary-light hover:bg-surface-light dark:text-text-primary-dark dark:hover:bg-surface-dark',
        ]"
        @click="select(account.id)"
      >
        <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: account.color }" />
        <span class="min-w-0 flex-1 truncate text-left">{{ account.name }}</span>
        <span
          class="shrink-0 whitespace-nowrap text-xs tabular-nums text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          {{
            formatCurrency(account.balances[0]?.balance ?? 0, account.balances[0]?.currency ?? '')
          }}
        </span>
      </button>
    </PopoverContent>
  </Popover>
</template>
```

Проверить путь к типу: если `AccountWithBalances` экспортируется не из
`../model/types`, взять тот путь, которым пользуется соседний
`AccountSelector.vue`.

- [ ] **Step 2: Экспортировать из публичного API entity**

В `frontend/src/entities/account/index.ts` добавить рядом со строкой экспорта `AccountSelector`:

```ts
export { default as AccountPopover } from './ui/AccountPopover.vue';
```

- [ ] **Step 3: Создать AmountHeadline**

`frontend/src/features/add-transaction/ui/AmountHeadline.vue` — копия `AmountCard.vue` со следующими правками. Скопировать файл, затем изменить:

1. Docblock над `defineProps` заменить на:

```ts
/**
 * Сумма операции — на голом фоне страницы, без карточки.
 *
 * Карточка здесь была лишним ярусом: рамка, заливка, слой тонировки и цветная
 * полоска слева — три шаблонных приёма подряд, из-за которых экран читался как
 * сгенерированный. Цвет счёта информацию всё ещё несёт, но точкой в
 * переключателе и окраской каретки, а не заливкой площади. На вкладке «Долг»,
 * где счёт выбирается ниже и прогноза остатка нет, блок вырождается в одну
 * сумму — и на голом фоне это выглядит нормально, а полупустой карточкой не
 * выглядело.
 */
```

2. Удалить `tintStyle`/`borderStyle` и всё, что от них зависит, кроме окраски каретки:

```ts
const accent = computed(() => props.accountColor || FALLBACK_ACCENT);
const caretStyle = computed(() => ({ backgroundColor: accent.value }));
```

3. Удалить неиспользуемые импорты `Popover`, `PopoverTrigger`, `PopoverContent`, `getCurrencyByCode` оставить (валютный поповер остаётся), `useHaptics` и `selectAccount` удалить — их берёт на себя `AccountPopover`. Добавить:

```ts
import { AccountPopover } from '@/entities/account';
```

4. Корень шаблона: вместо `div.amount-card` с двумя absolute-слоями —

```vue
<template>
  <div class="pt-1">
    <AccountPopover
      v-if="accountName"
      :accounts="accounts"
      :selected-id="accountId"
      @select="emit('update:accountId', $event)"
    >
      <template #trigger>
        <button
          type="button"
          data-testid="account-trigger"
          aria-label="Выбрать счёт"
          class="account-trigger -ml-1 flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
        >
          <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: accent }" />
          <span class="truncate">{{ accountName }}</span>
          <UIcon v-if="accounts.length > 1" name="expand_more" size="xs" class="shrink-0" />
        </button>
      </template>
    </AccountPopover>

    <!-- дальше — существующий блок ввода суммы и строка баланса без изменений,
         только внешние обёртки `relative px-4 py-4 pl-5` убраны -->
  </div>
</template>
```

5. Каретка: `:style="isFocused ? caretStyle : undefined"` вместо `tintStyle`.

6. В `<style scoped>` удалить правило `.amount-card`, если было; оставить
   `.amount-value`, `.account-trigger`, `caret-blink` и блок
   `prefers-reduced-motion`.

- [ ] **Step 4: Подключить в TransactionForm и добавить разделитель**

В `frontend/src/features/add-transaction/ui/TransactionForm.vue`:

```diff
-import AmountCard from './AmountCard.vue';
+import AmountHeadline from './AmountHeadline.vue';
```

```diff
-      <AmountCard
+      <AmountHeadline
         :amount="formData.amount"
         ...
         @update:account-id="handleAccountChange"
       />
+
+      <!-- Волосяная линия вместо карточки: сумма отделена от типа операции,
+           но своей поверхности не получает. -->
+      <div class="-mx-4 border-b border-border-light dark:border-border-dark" />
```

- [ ] **Step 5: Удалить старый файл**

```bash
git rm frontend/src/features/add-transaction/ui/AmountCard.vue
```

- [ ] **Step 6: Verify**

Run: `cd frontend && bun run test && bun run lint && bun run build`
Expected: PASS. Если какой-то тест ищет `AmountCard` по имени компонента — обновить на `AmountHeadline`.

Затем визуально: `bun run dev`, открыть `/transactions/new`, проверить в светлой
и тёмной теме, что карточки нет, точка цвета счёта на месте, каретка окрашена, а
на вкладке «Долг» под суммой нет пустой коробки.

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src/entities/account frontend/src/features/add-transaction/ui
git commit -m "feat(add-transaction): сумма без карточки, список счетов в AccountPopover"
```

---

### Task 5: Подписанная кнопка сканирования

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/ExpensePanel.vue:146-157`

**Interfaces:**
- Consumes: ничего нового.
- Produces: ничего нового.

- [ ] **Step 1: Заменить иконку-квадрат на подписанную половину**

В `frontend/src/features/add-transaction/ui/ExpensePanel.vue` заменить блок кнопки сканирования:

```diff
       <button
         type="button"
         aria-label="Сканировать чек"
-        :class="[chipBase, chipIdle, 'flex w-12 shrink-0 items-center justify-center']"
+        :class="[chipBase, chipIdle, 'flex shrink-0 items-center gap-2 px-3 py-2.5']"
         @click="toScanReceipt"
       >
         <UIcon
           name="document_scanner"
           size="sm"
           class="text-text-tertiary-light dark:text-text-tertiary-dark"
         />
+        <span class="whitespace-nowrap text-sm text-text-secondary-light dark:text-text-secondary-dark">
+          Скан чека
+        </span>
       </button>
```

Иконка без подписи не читалась: пользователи не понимали, что делает кнопка.

- [ ] **Step 2: Verify**

Run: `cd frontend && bun run test -- ExpensePanel && bun run lint`
Expected: PASS (или «нет тестов для ExpensePanel» — тогда достаточно линта).

Визуально при `bun run dev` на `/transactions/new` проверить ширину 320 px
(DevTools → iPhone SE): обе половины ряда должны влезать и при настроенном
разделении расхода. Если не влезают — левой половине уже стоит `min-w-0`,
добавить `truncate` на текст сводки внутри чипа участников.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/add-transaction/ui/ExpensePanel.vue
git commit -m "feat(add-transaction): подписать кнопку сканирования чека"
```

---

### Task 6: «Долг» — плотный список

**Files:**
- Modify: `frontend/src/shared/ui/input/UInput.vue:14,154-160`
- Modify: `frontend/src/entities/person/ui/PersonSelector.vue`
- Modify: `frontend/src/features/add-transaction/ui/DebtDirectionPill.vue`
- Modify: `frontend/src/features/add-transaction/ui/DebtPanel.vue:164-333`
- Test: `frontend/src/features/add-transaction/ui/DebtPanel.spec.ts` (создать)

**Interfaces:**
- Consumes: `AccountPopover` из Task 4; `useDebtForm` без изменений.
- Produces: `UInput` получает `variant: 'flush'`; `PersonSelector` получает проброс `variant?: InputProps['variant']`.

- [ ] **Step 1: Write the failing test**

Создать `frontend/src/features/add-transaction/ui/DebtPanel.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import DebtPanel from './DebtPanel.vue';
import type { AccountWithBalances } from '@/entities/account';

vi.mock('@/shared/lib/haptics', () => ({ useHaptics: () => ({ trigger: vi.fn() }) }));
vi.mock('@/shared/lib/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ userId: { value: 'u1' } }),
}));
vi.mock('@/entities/person', () => ({
  PersonSelector: { template: '<div data-testid="person-selector" />' },
  usePeople: () => ({ people: { value: [] }, createPerson: vi.fn() }),
}));

const accounts: AccountWithBalances[] = [
  {
    id: 'a1',
    name: 'Основной',
    color: '#3b82f6',
    balances: [{ currency: 'UZS', balance: 1_000_000 }],
  } as AccountWithBalances,
];

function mountPanel() {
  return mount(DebtPanel, {
    props: { amount: 98_000, currency: 'UZS', accountId: 'a1', accounts },
    global: { stubs: { AccountPopover: true, DatePickerField: true, ToggleRow: true } },
  });
}

describe('DebtPanel', () => {
  it('человек, счёт и дата лежат в одном списке', () => {
    const wrapper = mountPanel();
    const list = wrapper.find('[data-testid="debt-fields"]');
    expect(list.exists()).toBe(true);
    expect(list.findAll('[data-testid^="debt-row-"]')).toHaveLength(3);
  });

  it('комиссия скрыта, пока «Ещё» свёрнуто', () => {
    const wrapper = mountPanel();
    expect(wrapper.find('[data-testid="debt-fee-input"]').exists()).toBe(false);
  });

  it('комиссия появляется в раскрытом «Ещё»', async () => {
    const wrapper = mountPanel();
    await wrapper.find('[data-testid="debt-more-toggle"]').trigger('click');
    expect(wrapper.find('[data-testid="debt-fee-input"]').exists()).toBe(true);
  });

  it('итог списания — одна строка, а не блок с заливкой', () => {
    const wrapper = mountPanel();
    expect(wrapper.find('[data-testid="debt-summary"]').text()).toContain('Спишется');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bun run test -- DebtPanel`
Expected: FAIL — `debt-fields` не существует; комиссия видна без раскрытия «Ещё».

- [ ] **Step 3: Добавить вариант `flush` в UInput**

В `frontend/src/shared/ui/input/UInput.vue`:

```diff
-  variant?: 'default' | 'search' | 'currency';
+  variant?: 'default' | 'search' | 'currency' | 'flush';
```

В обёртке инпута добавить строку после варианта `search`:

```diff
           variant === 'search' && 'bg-surface-light dark:bg-surface-dark border-transparent',
+          // `flush` — поле внутри готовой строки списка: своя рамка и фон стали
+          // бы вторым контуром внутри первого.
+          variant === 'flush' &&
+            'bg-transparent border-transparent rounded-none focus-within:border-transparent focus-within:ring-0',
```

- [ ] **Step 4: Пробросить variant через PersonSelector**

В `frontend/src/entities/person/ui/PersonSelector.vue` добавить в `defineProps` (внутрь объекта пропов):

```ts
    /** Проброс во внутренний `UInput` — нужен варианту `flush` в строке списка. */
    variant?: 'default' | 'search' | 'currency' | 'flush';
```

и на самом `UInput` в шаблоне:

```diff
       <UInput
         ref="inputRef"
         data-vaul-no-drag
+        :variant="variant"
         :model-value="String(modelValue)"
```

- [ ] **Step 5: DebtDirectionPill на всю ширину**

Заменить шаблон `frontend/src/features/add-transaction/ui/DebtDirectionPill.vue`:

```vue
<template>
  <!-- Центрованная пилюля в ~160 px терялась: направление долга — первое
       решение на вкладке, а выглядело мельче всего на экране. -->
  <div
    class="grid grid-cols-2 gap-1 rounded-xl border border-border-light bg-surface-light p-1 dark:border-border-dark dark:bg-surface-dark"
    role="tablist"
    aria-label="Направление долга"
  >
    <button
      type="button"
      role="tab"
      :aria-selected="modelValue === 'given'"
      class="direction-tab flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold"
      :class="
        modelValue === 'given'
          ? 'bg-card-light text-text-primary-light shadow-sm dark:bg-card-dark dark:text-text-primary-dark'
          : 'text-text-secondary-light dark:text-text-secondary-dark'
      "
      @click="select('given')"
    >
      <UIcon name="arrow_upward" size="xs" />
      <span>Дал</span>
    </button>
    <button
      type="button"
      role="tab"
      :aria-selected="modelValue === 'taken'"
      class="direction-tab flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold"
      :class="
        modelValue === 'taken'
          ? 'bg-card-light text-text-primary-light shadow-sm dark:bg-card-dark dark:text-text-primary-dark'
          : 'text-text-secondary-light dark:text-text-secondary-dark'
      "
      @click="select('taken')"
    >
      <UIcon name="arrow_downward" size="xs" />
      <span>Взял</span>
    </button>
  </div>
</template>

<style scoped>
.direction-tab {
  transition:
    background-color 200ms ease,
    color 200ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .direction-tab {
    transition: none;
  }
}
</style>
```

- [ ] **Step 6: Переписать разметку DebtPanel**

В `frontend/src/features/add-transaction/ui/DebtPanel.vue` заменить импорт `AccountSelector` на `AccountPopover`:

```diff
-import { AccountSelector } from '@/entities/account';
+import { AccountPopover } from '@/entities/account';
```

Добавить в `<script setup>` рядом с остальными computed:

```ts
const selectedAccount = computed(() =>
  props.accounts.find((a) => a.id === formData.value.account_id),
);

/** Итог одной строкой: блок с иконкой, заливкой и `p-4` занимал два яруса
 *  ради факта, который читается фразой. */
const summaryText = computed(() => {
  if (formData.value.skip_transaction || !formData.value.account_id) return null;
  if (formData.value.amount <= 0) return null;
  const isGiven = formData.value.debt_type === 'given';
  const amount = isGiven ? totalDebited.value : formData.value.amount;
  const verb = isGiven ? 'Спишется' : 'Добавится';
  const preposition = isGiven ? 'с' : 'на';
  const account = selectedAccount.value?.name ?? '';
  return `${verb} ${formatCurrency(amount, formData.value.currency)} ${preposition} «${account}»`;
});
```

Удалить теперь неиспользуемые `accountLabel` и `infoText`. Оставить `personLabel`,
`skipToggleTitle`, `showFeeInput`.

Заменить весь `<template>` на:

```vue
<template>
  <div class="space-y-3 pb-4 md:pb-8">
    <DebtDirectionPill
      :model-value="formData.debt_type"
      @update:model-value="updateField('debt_type', $event)"
    />

    <!--
      Три поля срослись в один список: раньше у каждого была своя подпись
      сверху, своя рамка и свой зазор — восемь ярусов там, где хватает четырёх.
      Подписи уехали внутрь строк иконкой и плейсхолдером.
    -->
    <div
      data-testid="debt-fields"
      class="divide-y divide-border-light overflow-hidden rounded-xl border border-border-light dark:divide-border-dark dark:border-border-dark"
    >
      <div data-testid="debt-row-person" class="flex items-center gap-2 px-3">
        <UIcon
          name="group"
          size="sm"
          class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
        />
        <PersonSelector
          class="min-w-0 flex-1"
          variant="flush"
          :model-value="formData.person_name"
          :people="people"
          :placeholder="personLabel"
          @update:model-value="updateField('person_name', $event)"
          @select="updateField('person_name', $event)"
          @save-person="(name) => createPerson({ name })"
        />
      </div>

      <AccountPopover
        :accounts="accounts"
        :selected-id="formData.account_id"
        @select="handleAccountChange"
      >
        <template #trigger>
          <button
            data-testid="debt-row-account"
            type="button"
            aria-label="Выбрать счёт"
            class="flex w-full items-center gap-2 px-3 py-3 text-left"
          >
            <span
              class="h-2.5 w-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: selectedAccount?.color }"
            />
            <span
              class="min-w-0 flex-1 truncate text-sm text-text-primary-light dark:text-text-primary-dark"
            >
              {{ selectedAccount?.name ?? 'Выберите счёт' }}
            </span>
            <UIcon
              name="expand_more"
              size="sm"
              class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
            />
          </button>
        </template>
      </AccountPopover>

      <div data-testid="debt-row-date" class="px-1">
        <DatePickerField
          v-model:open="isDebtDateOpen"
          :model-value="formData.debt_date"
          @update:model-value="updateField('debt_date', $event)"
        />
      </div>
    </div>

    <!--
      Срок, комиссия, комментарий и два переключателя заполняют единицы — на
      виду они растягивали панель на два экрана. Волосяная линия сверху нужна,
      чтобы строка вообще читалась как элемент управления: без неё её не
      замечали.
    -->
    <div class="border-t border-border-light pt-1 dark:border-border-dark">
      <button
        type="button"
        data-testid="debt-more-toggle"
        :aria-expanded="showMore"
        class="flex w-full items-center justify-between rounded-xl px-1 py-2 text-sm text-text-secondary-light transition-colors hover:text-text-primary-light dark:text-text-secondary-dark dark:hover:text-text-primary-dark"
        @click="showMore = !showMore"
      >
        <span>
          Ещё
          <span v-if="extrasCount" class="text-primary">· {{ extrasCount }}</span>
        </span>
        <UIcon
          name="expand_more"
          size="sm"
          class="more-chevron transition-transform duration-200"
          :class="showMore && 'rotate-180'"
        />
      </button>
    </div>

    <div v-if="showMore" class="space-y-3">
      <!-- Комиссия живёт здесь: её подпись была длиннее самого поля, а зависит
           она от `skip_transaction`, который тоже под «Ещё». -->
      <div v-if="showFeeInput" class="space-y-1.5">
        <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
          Комиссия за перевод
        </label>
        <div
          class="flex items-center gap-2 rounded-xl border border-border-light px-3 py-2.5 dark:border-border-dark"
        >
          <UIcon
            name="receipt_long"
            size="sm"
            class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
          />
          <input
            type="text"
            inputmode="decimal"
            :value="rawFeeValue"
            placeholder="0"
            aria-label="Комиссия за перевод"
            data-testid="debt-fee-input"
            class="min-w-0 flex-1 bg-transparent text-right text-sm tabular-nums text-text-primary-light outline-none dark:text-text-primary-dark"
            @input="handleFeeInput(($event.target as HTMLInputElement).value)"
            @focus="isFeeInputFocused = true"
            @blur="handleFeeBlur"
          />
          <span class="shrink-0 text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
            {{ formData.currency }}
          </span>
        </div>
        <p
          v-if="formData.fee > 0"
          class="px-1 text-xs tabular-nums text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          Со счёта спишется {{ formatCurrency(totalDebited, formData.currency) }} — долг
          {{ formatCurrency(formData.amount, formData.currency) }} + комиссия
          {{ formatCurrency(formData.fee, formData.currency) }}
        </p>
      </div>

      <div class="space-y-1.5">
        <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
          Срок возврата
        </label>
        <DatePickerField
          v-model:open="isDueDateOpen"
          :model-value="formData.due_date"
          placeholder="Без срока"
          clearable
          @update:model-value="updateField('due_date', $event)"
        />
      </div>

      <UInput
        :model-value="formData.description"
        label="Комментарий (необязательно)"
        placeholder="Добавьте описание..."
        @update:model-value="updateField('description', $event as string)"
      />

      <ToggleRow
        :model-value="formData.is_private"
        title="Скрыть сумму"
        description="Сумма не будет видна в общем списке"
        @update:model-value="updateField('is_private', $event)"
      />

      <ToggleRow
        :model-value="formData.skip_transaction"
        :title="skipToggleTitle"
        description="Транзакция не будет создана"
        @update:model-value="updateField('skip_transaction', $event)"
      />
    </div>

    <p
      v-if="summaryText"
      data-testid="debt-summary"
      class="px-1 text-xs tabular-nums text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      {{ summaryText }}
    </p>

    <p v-if="error" class="text-xs text-danger">{{ error }}</p>

    <UButton
      type="button"
      variant="primary"
      size="lg"
      full-width
      :loading="isSubmitting"
      :disabled="!isValid"
      @click="handleSubmit"
    >
      Создать долг
    </UButton>
  </div>
</template>
```

Также обновить `extrasCount`, чтобы комиссия считалась «заполненным лишним»:

```diff
 const extrasCount = computed(
   () =>
     Number(Boolean(formData.value.due_date)) +
     Number(Boolean(formData.value.description.trim())) +
     Number(formData.value.is_private) +
-    Number(formData.value.skip_transaction),
+    Number(formData.value.skip_transaction) +
+    Number(formData.value.fee > 0),
 );
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd frontend && bun run test -- DebtPanel`
Expected: PASS — 4 теста.

- [ ] **Step 8: Verify the suite, lint, build**

Run: `cd frontend && bun run test && bun run lint && bun run build`
Expected: PASS. `useDebtForm.spec.ts` должен пройти без правок — модель не менялась.

Визуально при `bun run dev`: `/transactions/new` → вкладка «Долг». Проверить, что
поля идут одним списком, «Ещё» заметно, комиссия внутри «Ещё», итог — одна
строка, «Дал/Взял» на всю ширину. Проверить обе темы.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/shared/ui/input/UInput.vue frontend/src/entities/person/ui/PersonSelector.vue frontend/src/features/add-transaction/ui/DebtDirectionPill.vue frontend/src/features/add-transaction/ui/DebtPanel.vue frontend/src/features/add-transaction/ui/DebtPanel.spec.ts
git commit -m "feat(add-transaction): вкладка «Долг» плотным списком"
```

---

### Task 7: Флаг перехода: навбар и автофокус ждут конца слайда

**Files:**
- Modify: `frontend/src/app/router/index.ts:13` (рядом с `transitionName`), `:400-437`
- Modify: `frontend/src/app/layouts/ui/MainLayout.vue:7,31-37,77-94`
- Modify: `frontend/src/features/add-transaction/model/useAmountInput.ts:70-74`
- Modify: `frontend/src/pages/transactions/new/AddTransactionPage.vue`
- Test: `frontend/src/features/add-transaction/model/useAmountInput.spec.ts` (создать)

**Interfaces:**
- Consumes: ничего.
- Produces: `isPageTransitioning: Ref<boolean>` — экспорт из `@/app/router`; `finishPageTransition(): void` — снимает флаг.

- [ ] **Step 1: Write the failing test**

Создать `frontend/src/features/add-transaction/model/useAmountInput.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useAmountInput } from './useAmountInput';

function mountHarness(autofocus: ReturnType<typeof ref<boolean>>) {
  const Harness = defineComponent({
    setup() {
      const { inputRef } = useAmountInput({
        amount: () => 0,
        autofocus: () => autofocus.value,
        onChange: vi.fn(),
      });
      return { inputRef };
    },
    render() {
      return h('input', { ref: 'inputRef' });
    },
  });
  return mount(Harness, { attachTo: document.body });
}

describe('useAmountInput', () => {
  it('не фокусит поле, пока autofocus false', async () => {
    const autofocus = ref(false);
    const wrapper = mountHarness(autofocus);
    await nextTick();
    expect(document.activeElement).not.toBe(wrapper.element);
  });

  it('фокусит поле, когда autofocus становится true', async () => {
    const autofocus = ref(false);
    const wrapper = mountHarness(autofocus);
    autofocus.value = true;
    await nextTick();
    await nextTick();
    expect(document.activeElement).toBe(wrapper.element);
  });

  it('фокусит один раз: повторное включение не перефокусирует', async () => {
    const autofocus = ref(false);
    const wrapper = mountHarness(autofocus);
    autofocus.value = true;
    await nextTick();
    await nextTick();
    (wrapper.element as HTMLInputElement).blur();
    autofocus.value = false;
    await nextTick();
    autofocus.value = true;
    await nextTick();
    await nextTick();
    expect(document.activeElement).not.toBe(wrapper.element);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && bun run test -- useAmountInput`
Expected: FAIL — второй тест не проходит: фокус ставится только в `onMounted`.

- [ ] **Step 3: Заменить onMounted на watch в useAmountInput**

В `frontend/src/features/add-transaction/model/useAmountInput.ts`:

```diff
-  onMounted(() => {
-    if (toValue(options.autofocus)) {
-      nextTick(() => inputRef.value?.focus());
-    }
-  });
+  /**
+   * Фокус ждёт разрешения снаружи, а не ставится на монтировании: раньше
+   * клавиатура открывалась посреди перехода между страницами, `h-dvh`
+   * пересчитывался, и вход на экран дёргался. Страница включает автофокус
+   * после конца слайда.
+   */
+  const hasFocused = ref(false);
+  watch(
+    () => toValue(options.autofocus),
+    (enabled) => {
+      if (!enabled || hasFocused.value) return;
+      hasFocused.value = true;
+      nextTick(() => inputRef.value?.focus());
+    },
+    { immediate: true },
+  );
```

Удалить `onMounted` из импорта, если он больше не используется.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && bun run test -- useAmountInput`
Expected: PASS — 3 теста.

- [ ] **Step 5: Добавить флаг перехода в роутер**

В `frontend/src/app/router/index.ts` рядом с объявлением `transitionName`:

```ts
/**
 * Идёт ли переход между страницами.
 *
 * Нужен тем, кто не должен трогать раскладку посреди слайда: нижняя навигация
 * (её снятие меняет высоту контейнера, и уходящая страница перекомпоновывается)
 * и автофокус суммы (клавиатура пересчитывает `h-dvh`).
 */
export const isPageTransitioning = ref(false);

export function finishPageTransition() {
  isPageTransitioning.value = false;
}
```

В `router.beforeEach`, который выставляет `transitionName`, в самом начале
добавить:

```diff
 router.beforeEach((to, from) => {
+  isPageTransitioning.value = true;
+
   // Skip on initial load
   if (!from.name) {
     transitionName.value = 'fade';
+    isPageTransitioning.value = false;
     return;
   }
```

и в ветке popstate, где переход отключается:

```diff
   if (isPopStateNavigation || isRecentPopState) {
     transitionName.value = 'none';
     isPopStateNavigation = false;
+    isPageTransitioning.value = false;
     return;
   }
```

- [ ] **Step 6: Снимать флаг и держать навбар в MainLayout**

В `frontend/src/app/layouts/ui/MainLayout.vue`:

```diff
-import { transitionName } from '@/app/router';
+import { transitionName, isPageTransitioning, finishPageTransition } from '@/app/router';
```

```diff
 const hideBottomNav = computed(() => FULLSCREEN_FLOWS.includes(route.name as string));
+
+/**
+ * Прятать навбар только после перехода. Классический навбар — `shrink-0` в
+ * потоке: его мгновенное снятие увеличивает контейнер, в котором обе страницы
+ * лежат `absolute inset-0`, и уходящая страница перекомпоновывается посреди
+ * слайда. Показываем сразу — входящая страница должна получить его с первого
+ * кадра.
+ */
+const navHidden = computed(() => hideBottomNav.value && !isPageTransitioning.value);
```

В шаблоне: снять флаг на конце перехода и переключить условие навбара.

```diff
-          <Transition v-else :name="transitionName">
+          <Transition v-else :name="transitionName" @after-enter="finishPageTransition">
             <div :key="route.path" class="absolute inset-0 w-full h-full flex flex-col">
               <component :is="Component" />
             </div>
           </Transition>
```

```diff
-      <template v-if="!hideBottomNav">
+      <template v-if="!navHidden">
```

Ветка без перехода (`transitionName === 'none'`) флаг не ставит вовсе — роутер
снимает его сам в `beforeEach`.

- [ ] **Step 7: Включать автофокус после перехода на странице**

В `frontend/src/pages/transactions/new/AddTransactionPage.vue`:

```diff
-import { navigateBack, navigateBackTo } from '@/app/router';
+import { navigateBack, navigateBackTo, isPageTransitioning } from '@/app/router';
```

```diff
 const { currency: userCurrency } = useUserCurrency();
+
+/**
+ * Клавиатуру открываем после слайда: во время перехода она пересчитывает
+ * `h-dvh`, и вход на экран дёргается.
+ */
+const canFocusAmount = computed(() => !isPageTransitioning.value);
```

Добавить `computed` в импорт из `vue`, затем в шаблоне:

```diff
-          autofocus-amount
+          :autofocus-amount="canFocusAmount"
```

- [ ] **Step 8: Verify**

Run: `cd frontend && bun run test && bun run lint && bun run build`
Expected: PASS.

Визуально при `bun run dev`: перейти на `/transactions/new` с дашборда. Нижняя
навигация не должна «выдёргиваться» в начале слайда, а клавиатура — открываться
до его конца. Проверить оба стиля навбара: `classic` и `liquid-glass`
(переключатель в настройках).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/router/index.ts frontend/src/app/layouts/ui/MainLayout.vue frontend/src/features/add-transaction/model/useAmountInput.ts frontend/src/features/add-transaction/model/useAmountInput.spec.ts frontend/src/pages/transactions/new/AddTransactionPage.vue
git commit -m "fix(add-transaction): убрать рывок на входе — навбар и автофокус ждут конца перехода"
```

---

### Task 8: Тяжёлое — вне кадра слайда

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/TransactionMetaRow.vue:6`
- Modify: `frontend/src/features/add-transaction/ui/DatePickerField.vue:6`
- Modify: `frontend/src/features/add-transaction/ui/TransactionForm.vue:23,415-441`

**Interfaces:**
- Consumes: `isPageTransitioning` из Task 7.
- Produces: ничего нового.

- [ ] **Step 1: Calendar — асинхронно в двух местах**

В `frontend/src/features/add-transaction/ui/TransactionMetaRow.vue`:

```diff
-import { computed, nextTick, ref } from 'vue';
+import { computed, defineAsyncComponent, nextTick, ref } from 'vue';
 import { UIcon } from '@/shared/ui';
 import { formatDate } from '@/shared/lib/format/date';
 import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
-import { Calendar } from '@/shared/ui/primitives/calendar';
 import { CalendarDate, type DateValue } from '@internationalized/date';
+
+// Календарь тянет reka-примитив и открывается по нажатию — в чанк, который
+// парсится в кадре старта слайда, ему попадать незачем.
+const Calendar = defineAsyncComponent(() =>
+  import('@/shared/ui/primitives/calendar').then((m) => m.Calendar),
+);
```

Внутри `PopoverContent` календарь рендерить только когда поповер открыт:

```diff
-          <Calendar
+          <Calendar
+            v-if="calendarOpen"
             :model-value="calendarValue"
             locale="ru-RU"
             @update:model-value="onCalendarSelect"
           />
```

То же в `frontend/src/features/add-transaction/ui/DatePickerField.vue`:

```diff
-import { computed } from 'vue';
+import { computed, defineAsyncComponent } from 'vue';
 import { type DateValue } from '@internationalized/date';
 import { UIcon } from '@/shared/ui';
 import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
-import { Calendar } from '@/shared/ui/primitives/calendar';
 import { isoToCalendarDate, dateValueToISO } from '@/shared/lib/date';
 import { formatDate } from '@/shared/lib/format/date';
+
+const Calendar = defineAsyncComponent(() =>
+  import('@/shared/ui/primitives/calendar').then((m) => m.Calendar),
+);
```

```diff
       <PopoverContent class="w-auto p-0" align="start" :to="portalTo">
-        <Calendar :model-value="calendarValue" locale="ru-RU" @update:model-value="handleChange" />
+        <Calendar
+          v-if="isOpen"
+          :model-value="calendarValue"
+          locale="ru-RU"
+          @update:model-value="handleChange"
+        />
       </PopoverContent>
```

Если `@/shared/ui/primitives/calendar` экспортирует `Calendar` как `default`,
использовать `import(...)` без `.then` — проверить по `index.ts` этой папки.

- [ ] **Step 2: DebtPanel — асинхронно с префетчем**

В `frontend/src/features/add-transaction/ui/TransactionForm.vue`:

```diff
-import DebtPanel from './DebtPanel.vue';
+
+/**
+ * Панель долга тянет PersonSelector, ToggleRow и календарь, а вкладка «Долг»
+ * почти всегда закрыта — в кадре старта слайда её парсить незачем. Ссылка на
+ * компонент объявлена на уровне модуля: `KeepAlive` требует стабильной.
+ */
+const DebtPanel = defineAsyncComponent(() => import('./DebtPanel.vue'));
```

Добавить `defineAsyncComponent` в импорт из `vue`, затем префетч чанка на
простое, чтобы первый заход на вкладку не ждал сети:

```diff
 onMounted(() => {
   if (shouldShowHint('split-expense')) {
     showSplitHintDelayed();
   }
+
+  // Чанк долга подтягиваем на простое: без этого первый тап по вкладке ждал бы
+  // сеть, а с синхронным импортом он стоил бы кадра при входе на страницу.
+  const prefetchDebt = () => void import('./DebtPanel.vue');
+  if (typeof requestIdleCallback !== 'undefined') {
+    requestIdleCallback(prefetchDebt, { timeout: 2000 });
+  } else {
+    setTimeout(prefetchDebt, 1000);
+  }
 });
```

- [ ] **Step 3: Отложить хвост формы**

В `frontend/src/features/add-transaction/ui/TransactionForm.vue` добавить проп:

```diff
   autofocusAmount?: boolean;
+  /** Слайд закончился — можно дорисовывать тяжёлый хвост формы. */
+  ready?: boolean;
 }>();
```

Обернуть мета-строку и ряд «Разделить/Скан» так, чтобы они появлялись после
перехода. Мета-строка уже отдельный узел; ряд «Разделить/Скан» живёт внутри
`ExpensePanel`, поэтому проп прокидывается туда же:

```diff
       <TransactionMetaRow
-        v-if="formData.type !== 'debt'"
+        v-if="formData.type !== 'debt' && ready !== false"
+        class="form-tail"
         :description="formData.description"
```

и в `expensePanelProps`:

```diff
 const expensePanelProps = computed(() => ({
   formData: props.formData,
   accounts: props.accounts,
   categories: props.expenseCategories,
   transactions: transactions.value,
   splitData: props.splitData,
   splitValidationError: props.splitValidationError,
+  ready: props.ready !== false,
 }));
```

В `<style scoped>` добавить:

```css
/* Хвост формы дорисовывается после слайда: `Calendar` и vaul в кадр перехода
   не попадают, а появление не должно быть заметным. */
.form-tail {
  animation: tail-in 120ms ease-out both;
}

@keyframes tail-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .form-tail {
    animation: none;
  }
}
```

В `frontend/src/features/add-transaction/ui/ExpensePanel.vue` добавить проп и
условие на ряд действий:

```diff
 const props = defineProps<{
   formData: TransactionFormData;
   accounts: AccountWithBalances[];
   categories: Category[];
   transactions?: Transaction[];
   splitData?: SplitExpenseData;
   splitValidationError?: string | null;
+  /** Слайд закончился — можно дорисовывать ряд действий. */
+  ready?: boolean;
 }>();
```

```diff
-    <div class="flex items-stretch gap-2">
+    <div v-if="ready !== false" class="form-tail flex items-stretch gap-2">
```

и то же правило `.form-tail` + `@keyframes tail-in` в `<style scoped>` этого
файла (scoped-стили не наследуются между компонентами).

Наконец, прокинуть готовность со страницы —
`frontend/src/pages/transactions/new/AddTransactionPage.vue`:

```diff
-          :autofocus-amount="canFocusAmount"
+          :autofocus-amount="canFocusAmount"
+          :ready="canFocusAmount"
```

`canFocusAmount` — это и есть «слайд закончился»; отдельный computed был бы его
копией.

- [ ] **Step 4: Verify**

Run: `cd frontend && bun run test && bun run lint && bun run build`
Expected: PASS. Сторож `scripts/check-eager-bundle.mjs` не должен ругаться; в
выводе сборки чанк с `DebtPanel` и чанк календаря должны стать отдельными.

Визуально при `bun run dev`: вход на `/transactions/new` — шапка, сумма, табы,
категории и кнопка приезжают со слайдом; комментарий/дата и ряд
«Разделить/Скан» проявляются сразу после. Открыть календарь и вкладку «Долг» —
работают.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/add-transaction/ui/TransactionMetaRow.vue frontend/src/features/add-transaction/ui/DatePickerField.vue frontend/src/features/add-transaction/ui/TransactionForm.vue frontend/src/features/add-transaction/ui/ExpensePanel.vue frontend/src/pages/transactions/new/AddTransactionPage.vue
git commit -m "perf(add-transaction): календарь, шит категорий и панель долга вне кадра слайда"
```

---

### Task 9: Спокойные кривые

**Files:**
- Modify: `frontend/src/app/App.vue:174-233`
- Modify: `frontend/src/features/add-transaction/model/useAmountInput.ts`
- Modify: `frontend/src/features/add-transaction/ui/AmountHeadline.vue`
- Modify: `frontend/src/entities/account/ui/AccountSelector.vue:52`

**Interfaces:**
- Consumes: `useAmountInput` из Task 7.
- Produces: `useAmountInput` больше не возвращает `isBouncing`.

- [ ] **Step 1: Слайд 350 → 260 мс**

В `frontend/src/app/App.vue` заменить `0.35s` на `0.26s` во всех правилах
`.slide-forward-*` и `.slide-back-*` (шесть вхождений: `enter-active`,
`leave-active` — в `leave-active` у forward две длительности, вторая `0.2s`
остаётся как есть). Правила `.slide-tab-*` **не трогать**.

```diff
 .slide-forward-enter-active {
-  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
+  transition: transform 0.26s cubic-bezier(0.32, 0.72, 0, 1);
   z-index: 10;
 }

 .slide-forward-leave-active {
   transition:
-    transform 0.35s cubic-bezier(0.32, 0.72, 0, 1),
+    transform 0.26s cubic-bezier(0.32, 0.72, 0, 1),
     opacity 0.2s cubic-bezier(0.32, 0.72, 0, 1);
   z-index: 5;
 }
```

```diff
 .slide-back-enter-active {
   transition:
-    transform 0.35s cubic-bezier(0.32, 0.72, 0, 1),
-    opacity 0.35s cubic-bezier(0.32, 0.72, 0, 1);
+    transform 0.26s cubic-bezier(0.32, 0.72, 0, 1),
+    opacity 0.26s cubic-bezier(0.32, 0.72, 0, 1);
   z-index: 5;
 }

 .slide-back-leave-active {
-  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
+  transition: transform 0.26s cubic-bezier(0.32, 0.72, 0, 1);
   z-index: 10;
 }
```

- [ ] **Step 2: Удалить пружину суммы**

В `frontend/src/features/add-transaction/model/useAmountInput.ts` удалить:
константу `BOUNCE_MS`, `const isBouncing = ref(false)`, вызов
`useTimeoutFn(... BOUNCE_MS ...)`, обе строки с `isBouncing.value` внутри
`onInput`, и `isBouncing` из возвращаемого объекта. Импорт `useTimeoutFn` из
`@vueuse/core` удалить, если он больше нигде в файле не используется
(`useEventListener` остаётся).

Итоговый `onInput`:

```ts
  function onInput(event: Event) {
    const sanitized = sanitizeCurrencyInput((event.target as HTMLInputElement).value);
    rawValue.value = sanitized;
    options.onChange(parseFloat(sanitized) || 0);
  }
```

Также обновить docblock композабла: убрать упоминание «пружина» из перечисления
того, что он делает, и упомянуть `AmountHeadline` вместо `AmountSlab`.

- [ ] **Step 3: Убрать использование isBouncing в AmountHeadline**

В `frontend/src/features/add-transaction/ui/AmountHeadline.vue` убрать
`isBouncing` из деструктуризации `useAmountInput(...)` и из классов суммы:

```diff
             :class="[
               amountSizeClass,
               amount
                 ? 'text-text-primary-light dark:text-text-primary-dark'
                 : 'text-text-tertiary-light dark:text-text-tertiary-dark',
-              isBouncing && 'scale-[1.03]',
             ]"
```

В `.amount-value` из `<style scoped>` убрать `transform` из списка переходов —
он больше ничего не анимирует:

```diff
 .amount-value {
   transition:
-    transform 200ms cubic-bezier(0.4, 0, 0.2, 1),
     font-size 200ms cubic-bezier(0.4, 0, 0.2, 1),
     color 200ms ease;
 }
```

- [ ] **Step 4: Перелёт AccountSelector → торможение**

В `frontend/src/entities/account/ui/AccountSelector.vue`:

```diff
-        class="sliding-indicator absolute top-0 bottom-1 rounded-lg bg-primary/10 border border-primary pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0"
+        class="sliding-indicator absolute top-0 bottom-1 rounded-lg bg-primary/10 border border-primary pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] z-0"
```

- [ ] **Step 5: Verify**

Run: `cd frontend && bun run test && bun run lint && bun run build`
Expected: PASS. Если какой-то тест проверял `isBouncing` — удалить эту проверку
вместе с полем.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/App.vue frontend/src/features/add-transaction/model/useAmountInput.ts frontend/src/features/add-transaction/ui/AmountHeadline.vue frontend/src/entities/account/ui/AccountSelector.vue
git commit -m "fix(ui): спокойные кривые — слайд 260 мс, без пружин на сумме и чипах счёта"
```

---

### Task 10: Changelog и финальная проверка

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

**Interfaces:**
- Consumes: ничего.
- Produces: ничего.

- [ ] **Step 1: Узнать текущую версию**

Run: `cd frontend && head -30 src/features/changelog/model/changelogData.ts`
Взять `version` первой записи массива `CHANGELOG_ENTRIES` и увеличить патч
(например `1.0.67` → `1.0.68`).

- [ ] **Step 2: Добавить запись в начало массива**

Вставить **первым элементом** `CHANGELOG_ENTRIES`, повторив форму соседних
записей (поля `version`, `date`, `changes` с `type` и текстом — свериться с
существующей записью, чтобы совпали имена полей):

```ts
  {
    version: '<новый патч>',
    date: '2026-07-27',
    changes: [
      {
        type: 'improvement',
        description: 'Кнопки категорий теперь заполняют всю ширину экрана — без пустых мест по краям',
      },
      {
        type: 'improvement',
        description: 'Экран новой транзакции стал спокойнее: сумма без лишней рамки, кнопка сканирования чека подписана',
      },
      {
        type: 'improvement',
        description: 'Вкладка «Долг» стала вдвое короче: поля собраны в один список, редкие настройки — под «Ещё»',
      },
      {
        type: 'fix',
        description: 'Убран рывок и подтормаживание при открытии экрана новой транзакции',
      },
    ],
  },
```

- [ ] **Step 3: Полная проверка**

Run: `cd frontend && bun run test && bun run lint && bun run build`
Expected: PASS, ноль предупреждений сторожа бандла.

Run: `cd backend && bun run build`
Expected: PASS (бэкенд не менялся, но правило репозитория требует проверки обоих).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/changelog/model/changelogData.ts
git commit -m "chore(changelog): полировка «Новой транзакции»"
```

---

## Self-Review

**Покрытие спеки:**

| Требование спеки | Задача |
|---|---|
| Формула `packJustifiedRows` | Task 1 |
| Замер через `canvas.measureText`, хром с живого узла, `fonts.ready`, ResizeObserver | Task 2 |
| Применение только к `CategoryPicker`, «Ещё N» в упаковке | Task 3 |
| `AmountCard` → `AmountHeadline`, минус тонировка/полоска/паддинги, точка цвета, каретка | Task 4 |
| `AccountPopover` в `entities/account` | Task 4 |
| Волосяная линия под суммой | Task 4, Step 4 |
| Подписанная кнопка скана | Task 5 |
| «Долг»: один список, подписи внутрь, комиссия под «Ещё», итог одной строкой, «Ещё» с линией, `DebtDirectionPill` на всю ширину | Task 6 |
| `isPageTransitioning`, навбар после перехода, автофокус после перехода | Task 7 |
| `defineAsyncComponent` для `Calendar`, `CategoryPickerSheet`, `DebtPanel` + префетч | Task 3 (шит), Task 8 |
| Отложенный хвост формы | Task 8, Step 3 |
| Слайд 260 мс, снятие пружины суммы, кривая `AccountSelector` | Task 9 |
| Тесты `justifyRows`, `CategoryPicker`, `useAmountInput`, `DebtPanel` | Tasks 1, 2, 3, 6, 7 |
| `useDebtForm` не меняется | Task 6 (явно проверяется в Step 8) |
| Changelog | Task 10 |

**Согласованность имён:** `packJustifiedRows` (Task 1) → используется в
`useJustifiedRows` (Task 2) → `containerRef`/`chipRef`/`rows` в `CategoryPicker`
(Task 3). `measureTextWidth`/`resolveFont` объявлены в Task 2 и там же
используются. `isPageTransitioning`/`finishPageTransition` объявлены в Task 7,
Step 5 и используются в Step 6-7 и в Task 8. `AccountPopover` объявлен в Task 4
и используется в Task 6. Проп `ready` объявлен в Task 8 на `TransactionForm` и
`ExpensePanel`, передаётся со страницы там же.

**Заметка о риске:** тест «раскладывает по рядам» в Task 2 зависит от того,
вызывает ли jsdom `ResizeObserver`. В Step 4 задачи указано, что делать, если он
не срабатывает: раскладка уже покрыта чистой функцией в Task 1, поэтому потеря
этого одного кейса не оставляет формулу без тестов.
