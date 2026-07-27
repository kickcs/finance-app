# Редизайн выбора человека, счёта и срока на вкладке «Долг» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить текстовый выбор человека на ранжированные по частоте чипы, поднять счёт долга к сумме, починить календарь срока и сделать кнопку «Создать долг» липкой.

**Architecture:** Новый `PersonPicker` в `entities/person` — калька с принятого в проекте `CategoryPicker` (юстированные чипы + «Ещё» → vaul-шит). Порядок задаёт чистая функция `rankPeopleByUsage`, считающая вес долга с полураспадом 90 дней по уже прогретому кэшу `useDebts`. `DebtPanel` теряет строку счёта (уезжает на `AmountHeadline`) и строку-итог, получает липкий подвал через общий `SubmitBar`.

**Tech Stack:** Vue 3 (`<script setup>`), TypeScript, Tailwind v4, Reka UI, vaul-vue, TanStack Vue Query, vitest + @vue/test-utils.

## Global Constraints

- FSD: импорты только вниз по слоям. `entities/person` **не** импортирует `entities/debt` — долги принимаются структурным типом `Debt` из `@/shared/api/database.types` (прецедент: `entities/person/lib/foldDebtsByPersonName.ts`).
- Только токены дизайн-системы: `text-text-primary-light dark:text-text-primary-dark`, `border-border-light dark:border-border-dark` и т. п. Сырые тейлвиндовские цвета запрещены.
- Любая динамическая строка классов — через `cn()` из `@/shared/lib/utils`.
- Иконки — `<UIcon name="material_symbol" />`; новое имя требует маппинга в `shared/ui/icon/iconMap.ts`.
- Тексты интерфейса — на русском.
- Тесты, монтирующие vaul-шторки, обязаны стабить `vaul-vue` стабом `@/test/stubs/vaul` — иначе vitest падает целиком (jsdom + reka `Presence`).
- Шиты подключаются только через `defineAsyncComponent` — стартовый бандл сторожит `scripts/check-eager-bundle.mjs`.
- Проверка перед коммитом фазы: `cd frontend && bun run lint && bun run test && bun run build`.

---

### Task 1: `rankPeopleByUsage` — порядок людей по частоте

**Files:**
- Create: `frontend/src/entities/person/lib/rankPeopleByUsage.ts`
- Create: `frontend/src/entities/person/lib/rankPeopleByUsage.spec.ts`
- Modify: `frontend/src/entities/person/index.ts`

**Interfaces:**
- Consumes: `personKey(name: string): string` из `./foldDebtsByPersonName`; тип `Person` из `../model/types`; тип `Debt` из `@/shared/api/database.types`.
- Produces: `rankPeopleByUsage(people: Person[], debts: DebtUsage[] | undefined, now?: number): Person[]`, где `interface DebtUsage { person_name: string | null; created_at: string }`.

- [ ] **Step 1: Написать падающий тест**

Создать `frontend/src/entities/person/lib/rankPeopleByUsage.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rankPeopleByUsage } from './rankPeopleByUsage';
import type { Person } from '../model/types';

const NOW = new Date('2026-07-27T12:00:00.000Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

function person(name: string): Person {
  return {
    id: name,
    user_id: 'u1',
    name,
    color: '#3b82f6',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

function debt(name: string, daysAgo: number) {
  return { person_name: name, created_at: new Date(NOW - daysAgo * DAY).toISOString() };
}

describe('rankPeopleByUsage', () => {
  it('ставит частого впереди редкого', () => {
    const people = [person('Редкий'), person('Частый')];
    const debts = [
      debt('Частый', 1),
      debt('Частый', 2),
      debt('Частый', 3),
      debt('Редкий', 4),
    ];
    expect(rankPeopleByUsage(people, debts, NOW).map((p) => p.name)).toEqual([
      'Частый',
      'Редкий',
    ]);
  });

  it('свежие долги перевешивают более многочисленные старые', () => {
    const people = [person('Старый'), person('Свежий')];
    const debts = [
      ...Array.from({ length: 6 }, () => debt('Старый', 720)),
      ...Array.from({ length: 4 }, () => debt('Свежий', 10)),
    ];
    expect(rankPeopleByUsage(people, debts, NOW).map((p) => p.name)).toEqual([
      'Свежий',
      'Старый',
    ]);
  });

  it('людей без долгов отправляет в конец и сортирует по алфавиту', () => {
    const people = [person('Яна'), person('Борис'), person('Анна')];
    const debts = [debt('Яна', 5)];
    expect(rankPeopleByUsage(people, debts, NOW).map((p) => p.name)).toEqual([
      'Яна',
      'Анна',
      'Борис',
    ]);
  });

  it('сопоставляет имя без учёта регистра и краевых пробелов', () => {
    const people = [person('Тихий'), person('Азиз')];
    const debts = [debt('  азиз ', 1), debt('АЗИЗ', 2)];
    expect(rankPeopleByUsage(people, debts, NOW).map((p) => p.name)).toEqual([
      'Азиз',
      'Тихий',
    ]);
  });

  it('без долгов отдаёт алфавитный порядок', () => {
    const people = [person('Яна'), person('Анна')];
    expect(rankPeopleByUsage(people, undefined, NOW).map((p) => p.name)).toEqual([
      'Анна',
      'Яна',
    ]);
  });

  it('пропускает долги без имени', () => {
    const people = [person('Анна')];
    const debts = [{ person_name: null, created_at: new Date(NOW).toISOString() }];
    expect(rankPeopleByUsage(people, debts, NOW).map((p) => p.name)).toEqual(['Анна']);
  });

  it('не мутирует входной массив', () => {
    const people = [person('Яна'), person('Анна')];
    const copy = [...people];
    rankPeopleByUsage(people, [debt('Яна', 1)], NOW);
    expect(people).toEqual(copy);
  });
});
```

- [ ] **Step 2: Запустить тест и убедиться, что он падает**

Run: `cd frontend && bun run test -- src/entities/person/lib/rankPeopleByUsage.spec.ts`
Expected: FAIL — `Failed to resolve import "./rankPeopleByUsage"`.

- [ ] **Step 3: Написать реализацию**

Создать `frontend/src/entities/person/lib/rankPeopleByUsage.ts`:

```ts
import { personKey } from './foldDebtsByPersonName';
import type { Person } from '../model/types';

/**
 * Долг глазами ранжирования: только имя и момент создания. Структурный тип, а
 * не импорт `entities/debt`, — соседний слой той же высоты трогать нельзя.
 */
export interface DebtUsage {
  person_name: string | null;
  created_at: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Через столько дней долг весит вдвое меньше свежего. */
const HALF_LIFE_DAYS = 90;

/**
 * Порядок людей: от часто используемых к редким.
 *
 * Вес одного долга затухает по времени (`0.5^(дни/90)`), поэтому шесть долгов
 * двухлетней давности не обгоняют четыре за последний месяц: список должен
 * показывать, с кем пользователь имеет дело сейчас, а не с кем имел когда-то.
 *
 * Ключ — нормализованное имя: долги хранят его свободным текстом, без
 * `person_id`, и «азиз», «Азиз» и « АЗИЗ » — один человек.
 *
 * Контакты без единого долга уходят в хвост по алфавиту: у них нет сигнала, а
 * произвольный порядок сервера читался бы как случайный.
 */
export function rankPeopleByUsage(
  people: Person[],
  debts: DebtUsage[] | undefined,
  now: number = Date.now(),
): Person[] {
  const scores = new Map<string, number>();

  for (const debt of debts ?? []) {
    const name = debt.person_name?.trim();
    if (!name) continue;

    const ageDays = Math.max(0, (now - new Date(debt.created_at).getTime()) / DAY_MS);
    const weight = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    const key = personKey(name);
    scores.set(key, (scores.get(key) ?? 0) + weight);
  }

  return [...people].sort((a, b) => {
    const scoreA = scores.get(personKey(a.name)) ?? 0;
    const scoreB = scores.get(personKey(b.name)) ?? 0;
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.name.localeCompare(b.name, 'ru');
  });
}
```

- [ ] **Step 4: Запустить тест — должен пройти**

Run: `cd frontend && bun run test -- src/entities/person/lib/rankPeopleByUsage.spec.ts`
Expected: PASS, 7 тестов.

- [ ] **Step 5: Экспортировать из публичного API слайса**

В `frontend/src/entities/person/index.ts` после строки с `foldDebtsByPersonName` добавить:

```ts
export { rankPeopleByUsage, type DebtUsage } from './lib/rankPeopleByUsage';
```

- [ ] **Step 6: Коммит**

```bash
git add frontend/src/entities/person/lib/rankPeopleByUsage.ts \
        frontend/src/entities/person/lib/rankPeopleByUsage.spec.ts \
        frontend/src/entities/person/index.ts
git commit -m "feat(person): ранжирование людей по частоте с затуханием"
```

---

### Task 2: `useJustifiedRows` — замер чипа с не-svg лидом

**Files:**
- Modify: `frontend/src/shared/lib/hooks/useJustifiedRows.ts:91`
- Create: `frontend/src/shared/lib/hooks/useJustifiedRows.spec.ts`

**Interfaces:**
- Produces: тот же публичный API. Меняется только внутренний поиск ведущего элемента чипа: сначала `[data-chip-lead]`, затем `svg`.

**Why:** чипы людей ведёт `InitialAvatar` — это `div`, а не `svg`. Без правки хук посчитал бы чип уже реального на ширину аватара с зазором, и ряд переполнял бы контейнер.

- [ ] **Step 1: Написать падающий тест**

Создать `frontend/src/shared/lib/hooks/useJustifiedRows.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { useJustifiedRows } from './useJustifiedRows';

/**
 * jsdom не считает раскладку, поэтому проверяем не ширины, а контракт замера:
 * хук обязан прочитать ведущий элемент чипа, помеченный `data-chip-lead`,
 * даже когда внутри чипа нет ни одной `<svg>`.
 */
function mountWithLead(lead: 'avatar' | 'icon') {
  const captured: { chrome: number | null } = { chrome: null };

  const Host = defineComponent({
    setup() {
      const { containerRef, chipRef, rows } = useJustifiedRows(
        () => [{ label: 'Азиз' }],
        (item) => item.label,
      );
      return { containerRef, chipRef, rows, captured };
    },
    render() {
      return h('div', { ref: 'containerRef' }, [
        h('button', { ref: this.chipRef }, [
          lead === 'avatar'
            ? h('div', { 'data-chip-lead': '' }, 'А')
            : h('svg', { width: 16, height: 16 }),
          'Азиз',
        ]),
      ]);
    },
  });

  return mount(Host);
}

describe('useJustifiedRows', () => {
  it('находит ведущий элемент чипа по data-chip-lead', () => {
    const wrapper = mountWithLead('avatar');
    expect(wrapper.find('[data-chip-lead]').exists()).toBe(true);
    // Раскладка не падает и отдаёт ряд с единственным чипом
    expect(wrapper.vm.rows.length).toBeGreaterThan(0);
  });

  it('продолжает читать svg, когда data-chip-lead нет', () => {
    const wrapper = mountWithLead('icon');
    expect(wrapper.find('svg').exists()).toBe(true);
    expect(wrapper.vm.rows.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Запустить тест**

Run: `cd frontend && bun run test -- src/shared/lib/hooks/useJustifiedRows.spec.ts`
Expected: PASS уже сейчас (тест защищает от регрессии обеих веток). Если падает — значит правка Step 3 уже нужна; продолжать.

- [ ] **Step 3: Заменить поиск иконки**

В `frontend/src/shared/lib/hooks/useJustifiedRows.ts` заменить строку

```ts
    const icon = node.querySelector('svg');
```

на

```ts
    // Ведущий элемент чипа не обязан быть иконкой: у чипа человека это аватар —
    // обычный `div`. Явная пометка важнее тега, иначе такие чипы мерились бы
    // уже реального на ширину аватара и ряд переполнял бы контейнер.
    const icon = node.querySelector('[data-chip-lead]') ?? node.querySelector('svg');
```

и обновить комментарий у `DEFAULT_ICON`:

```ts
/** Иконка `size="sm"` или аватар `size="xs"`, когда собственный замер недоступен. */
const DEFAULT_ICON = 16;
```

- [ ] **Step 4: Прогнать тесты хука и существующих потребителей**

Run: `cd frontend && bun run test -- src/shared/lib/hooks/useJustifiedRows.spec.ts src/entities/category/ui/CategoryChips.spec.ts src/entities/category/ui/CategoryPicker.spec.ts`
Expected: PASS во всех.

- [ ] **Step 5: Коммит**

```bash
git add frontend/src/shared/lib/hooks/useJustifiedRows.ts \
        frontend/src/shared/lib/hooks/useJustifiedRows.spec.ts
git commit -m "fix(justified-rows): мерить ведущий элемент чипа, а не только svg"
```

---

### Task 3: `PersonPickerSheet` — полный список с поиском

**Files:**
- Create: `frontend/src/entities/person/ui/PersonPickerSheet.vue`

**Interfaces:**
- Consumes: `Person` из `../model/types`; `useIsDesktop` из `@/shared/lib/composables/useIsDesktop`; `useDrawerKeyboard` из `@/shared/lib/composables`; `UIcon`, `UInput`, `InitialAvatar` из `@/shared/ui`.
- Produces: компонент с пропами `{ open: boolean; people: Person[]; selected: string[]; multiple?: boolean }` и эмитами `{ 'update:open': [boolean]; select: [name: string]; create: [name: string] }`. `people` приходит **уже ранжированным** — шит не сортирует.

- [ ] **Step 1: Создать компонент**

Создать `frontend/src/entities/person/ui/PersonPickerSheet.vue`:

```vue
<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UIcon, UInput, InitialAvatar } from '@/shared/ui';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { useDrawerKeyboard } from '@/shared/lib/composables';
import { personKey } from '../lib/foldDebtsByPersonName';
import type { Person } from '../model/types';

const props = defineProps<{
  open: boolean;
  /** Уже отранжированный список — шит порядок не трогает. */
  people: Person[];
  /** Имена выбранных: одно в обычном режиме, сколько угодно в `multiple`. */
  selected: string[];
  multiple?: boolean;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  select: [name: string];
  create: [name: string];
}>();

const isDesktop = useIsDesktop();

const searchQuery = ref('');
const searchInputRef = ref<InstanceType<typeof UInput> | null>(null);

const drawerContentRef = ref<{ $el?: HTMLElement } | null>(null);
const footerRef = ref<HTMLDivElement | null>(null);
const scrollContainerRef = ref<HTMLDivElement | null>(null);

const { setupKeyboardListener, cleanupKeyboardListener } = useDrawerKeyboard(
  drawerContentRef,
  footerRef,
  scrollContainerRef,
);

const selectedKeys = computed(() => new Set(props.selected.map(personKey)));

const filtered = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return props.people;
  return props.people.filter((p) => p.name.toLowerCase().includes(query));
});

/** Имя, которого нет среди контактов, — предлагаем завести. */
const canCreate = computed(() => {
  const trimmed = searchQuery.value.trim();
  if (!trimmed) return false;
  return !props.people.some((p) => personKey(p.name) === personKey(trimmed));
});

// При открытии сбрасываем поиск. Автофокус только на desktop: на мобиле
// клавиатура сразу съела бы половину шита, а список для того и открыт, чтобы
// выбирать пальцем, а не печатать.
watch(
  () => props.open,
  async (open) => {
    if (open) {
      searchQuery.value = '';
      await nextTick();
      if (!props.open) return;
      if (isDesktop.value) searchInputRef.value?.focus();
      else setupKeyboardListener();
    } else {
      cleanupKeyboardListener();
    }
  },
);

function handleSelect(name: string) {
  emit('select', name);
  // Мультивыбор оставляет шит открытым: участников обычно несколько, и
  // переоткрывать его на каждого — та же морока, от которой уходим.
  if (!props.multiple) emit('update:open', false);
}

function handleCreate() {
  const name = searchQuery.value.trim();
  if (!name) return;
  emit('create', name);
  emit('select', name);
  searchQuery.value = '';
  if (!props.multiple) emit('update:open', false);
}

/** Enter — кнопка «Готово» мобильной клавиатуры: берём первое совпадение. */
function handleSearchEnter() {
  if (filtered.value.length > 0) handleSelect(filtered.value[0].name);
  else if (canCreate.value) handleCreate();
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
        ref="drawerContentRef"
        class="fixed z-50 flex flex-col bg-card-light dark:bg-card-dark"
        :class="
          isDesktop
            ? 'top-0 right-0 bottom-0 w-[420px] rounded-l-2xl border-l border-border-light dark:border-border-dark'
            : 'bottom-0 left-0 right-0 max-h-[90dvh] rounded-t-2xl border-t border-border-light dark:border-border-dark'
        "
      >
        <div v-if="!isDesktop" class="flex justify-center pb-1 pt-3">
          <DrawerHandle class="h-1 w-10 rounded-full bg-border-light dark:bg-border-dark" />
        </div>

        <div class="flex items-center justify-between px-5 pb-3" :class="{ 'pt-4': isDesktop }">
          <DrawerTitle
            class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
          >
            Люди
          </DrawerTitle>
          <button
            type="button"
            aria-label="Закрыть"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary-light transition-colors hover:bg-surface-light dark:text-text-secondary-dark dark:hover:bg-surface-dark"
            @click="emit('update:open', false)"
          >
            <UIcon name="close" size="sm" />
          </button>
        </div>

        <div class="px-5 pb-3">
          <UInput
            ref="searchInputRef"
            v-model="searchQuery"
            variant="search"
            placeholder="Поиск или новое имя..."
            data-testid="person-sheet-search"
            @keydown.enter.prevent="handleSearchEnter"
          />
        </div>

        <div
          ref="scrollContainerRef"
          class="flex-1 overflow-y-auto overscroll-contain px-5 pb-5"
          data-vaul-no-drag
        >
          <button
            v-if="canCreate"
            type="button"
            data-testid="person-sheet-create"
            class="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface-light dark:hover:bg-surface-dark"
            @click="handleCreate"
          >
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <UIcon name="person_add" size="sm" class="text-primary" />
            </span>
            <span class="min-w-0 flex-1 truncate text-sm font-medium text-primary">
              Создать «{{ searchQuery.trim() }}»
            </span>
          </button>

          <button
            v-for="person in filtered"
            :key="person.id"
            type="button"
            data-testid="person-sheet-row"
            class="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface-light dark:hover:bg-surface-dark"
            @click="handleSelect(person.name)"
          >
            <InitialAvatar :name="person.name" :color="person.color" size="md" translucent />
            <span
              class="min-w-0 flex-1 truncate text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
            >
              {{ person.name }}
            </span>
            <UIcon
              v-if="selectedKeys.has(person.name.trim().toLowerCase())"
              name="check"
              size="sm"
              class="shrink-0 text-primary"
            />
          </button>

          <p
            v-if="!filtered.length && !canCreate"
            class="py-8 text-center text-sm text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            Никого не найдено
          </p>
        </div>

        <div
          ref="footerRef"
          class="px-5 pb-[calc(env(safe-area-inset-bottom,16px)+0.75rem)] pt-1"
        />
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
```

- [ ] **Step 2: Проверить, что проект собирается**

Run: `cd frontend && bun run build`
Expected: успешная сборка. Если `UInput` не принимает `variant="search"` — свериться с `frontend/src/shared/ui/UInput.vue` и взять существующее имя варианта.

- [ ] **Step 3: Коммит**

```bash
git add frontend/src/entities/person/ui/PersonPickerSheet.vue
git commit -m "feat(person): шит полного списка людей с поиском и созданием"
```

---

### Task 4: `PersonPicker` — чипы людей

**Files:**
- Create: `frontend/src/entities/person/ui/PersonPicker.vue`
- Create: `frontend/src/entities/person/ui/PersonPicker.spec.ts`
- Modify: `frontend/src/entities/person/index.ts`

**Interfaces:**
- Consumes: `rankPeopleByUsage`, `DebtUsage` (Task 1); `useJustifiedRows` (Task 2); `PersonPickerSheet` (Task 3).
- Produces: компонент с пропами `{ people: Person[]; debts?: DebtUsage[]; selected: string | string[]; label?: string; multiple?: boolean }` и эмитами `{ select: [name: string]; create: [name: string] }`. В режиме `multiple` родитель сам решает, добавление это или снятие — по своему списку.

- [ ] **Step 1: Написать падающий тест**

Создать `frontend/src/entities/person/ui/PersonPicker.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PersonPicker from './PersonPicker.vue';
import type { Person } from '../model/types';

function person(name: string, id = name): Person {
  return {
    id,
    user_id: 'u1',
    name,
    color: '#3b82f6',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

function mountPicker(props: Record<string, unknown>) {
  return mount(PersonPicker, {
    props: { people: [], selected: '', ...props },
    global: { stubs: { PersonPickerSheet: true, UIcon: true, InitialAvatar: true } },
  });
}

const chips = (w: ReturnType<typeof mountPicker>) =>
  w.findAll('[data-testid="person-chip"]').map((c) => c.text());

describe('PersonPicker', () => {
  it('выдаёт людей от часто используемых к редким', () => {
    const wrapper = mountPicker({
      people: [person('Редкий'), person('Частый')],
      debts: [
        { person_name: 'Частый', created_at: new Date().toISOString() },
        { person_name: 'Частый', created_at: new Date().toISOString() },
        { person_name: 'Редкий', created_at: new Date().toISOString() },
      ],
    });
    expect(chips(wrapper)).toEqual(['Частый', 'Редкий']);
  });

  it('эмитит select с именем по тапу на чип', async () => {
    const wrapper = mountPicker({ people: [person('Азиз')] });
    await wrapper.find('[data-testid="person-chip"]').trigger('click');
    expect(wrapper.emitted('select')?.[0]).toEqual(['Азиз']);
  });

  it('показывает не больше восьми чипов и кнопку «Ещё N»', () => {
    const people = Array.from({ length: 12 }, (_, i) => person(`Ч${i}`, `p${i}`));
    const wrapper = mountPicker({ people });
    expect(wrapper.findAll('[data-testid="person-chip"]')).toHaveLength(8);
    expect(wrapper.find('[data-testid="person-more"]').text()).toContain('4');
  });

  it('кнопка открытия шита есть и когда прятать нечего — иначе не завести нового', () => {
    const wrapper = mountPicker({ people: [person('Азиз')] });
    expect(wrapper.find('[data-testid="person-more"]').exists()).toBe(true);
  });

  it('пиннит выбранного, если он не попал в топ', () => {
    const people = Array.from({ length: 12 }, (_, i) => person(`Ч${i}`, `p${i}`));
    const wrapper = mountPicker({ people, selected: 'Ч11' });
    expect(chips(wrapper)[0]).toBe('Ч11');
  });

  it('в режиме multiple помечает всех выбранных', () => {
    const wrapper = mountPicker({
      people: [person('Азиз'), person('Мама')],
      selected: ['Азиз', 'Мама'],
      multiple: true,
    });
    expect(wrapper.findAll('[data-testid="person-chip"][aria-pressed="true"]')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Запустить тест**

Run: `cd frontend && bun run test -- src/entities/person/ui/PersonPicker.spec.ts`
Expected: FAIL — `Failed to resolve import "./PersonPicker.vue"`.

- [ ] **Step 3: Создать компонент**

Создать `frontend/src/entities/person/ui/PersonPicker.vue`:

```vue
<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue';
import { UIcon, InitialAvatar } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import { useJustifiedRows } from '@/shared/lib/hooks/useJustifiedRows';
import { personKey } from '../lib/foldDebtsByPersonName';
import { rankPeopleByUsage, type DebtUsage } from '../lib/rankPeopleByUsage';
import type { Person } from '../model/types';

/**
 * Выбор человека чипами — калька с `CategoryPicker`.
 *
 * Текстовый инпут требовал трёх действий там, где хватает одного: фокус,
 * клавиатура, попадание в строку выпадающего списка. Постоянных контактов у
 * пользователя единицы, и они прекрасно ложатся в два ряда чипов.
 */
const props = defineProps<{
  people: Person[];
  /** Долги — сигнал частоты. Без них порядок остаётся алфавитным. */
  debts?: DebtUsage[];
  /** Имя выбранного; массив имён — в режиме `multiple`. */
  selected: string | string[];
  label?: string;
  multiple?: boolean;
}>();

const emit = defineEmits<{
  select: [name: string];
  create: [name: string];
}>();

// Шит на vaul тянет свой пакет и открывается по нажатию — в кадр первой
// отрисовки формы ему попадать незачем.
const PersonPickerSheet = defineAsyncComponent(() => import('./PersonPickerSheet.vue'));

const TOP_N = 8;

const { trigger } = useHaptics();
const sheetOpen = ref(false);

const selectedNames = computed(() =>
  Array.isArray(props.selected) ? props.selected : props.selected ? [props.selected] : [],
);
const selectedKeys = computed(() => new Set(selectedNames.value.map(personKey)));

const ranked = computed(() => rankPeopleByUsage(props.people, props.debts));

/**
 * Кнопка шита есть всегда, даже когда прятать нечего: только через неё
 * заводится человек, которого ещё нет в контактах. У категорий такой нужды нет
 * — там список закрыт, — поэтому порог `CategoryPicker` здесь не годится.
 */
const inlinePeople = computed(() => {
  const base = ranked.value.slice(0, TOP_N);
  const pinned = ranked.value.filter(
    (p) => selectedKeys.value.has(personKey(p.name)) && !base.some((b) => b.id === p.id),
  );
  return [...pinned, ...base].slice(0, TOP_N);
});

const hiddenCount = computed(() => props.people.length - inlinePeople.value.length);

type Cell = { kind: 'person'; person: Person } | { kind: 'more'; label: string };

const cells = computed<Cell[]>(() => [
  ...inlinePeople.value.map((person) => ({ kind: 'person' as const, person })),
  {
    kind: 'more' as const,
    label: hiddenCount.value > 0 ? `Ещё ${hiddenCount.value}` : 'Другой',
  },
]);

const { containerRef, chipRef, rows } = useJustifiedRows(
  cells,
  (cell) => (cell.kind === 'person' ? cell.person.name : cell.label),
  { gap: 6 },
);

function isSelected(person: Person) {
  return selectedKeys.value.has(personKey(person.name));
}

function selectPerson(name: string) {
  trigger('selection');
  emit('select', name);
}

function handleSheetSelect(name: string) {
  trigger('selection');
  emit('select', name);
}

function getChipStyle(person: Person, maxWidth: number) {
  const base = { maxWidth: `${maxWidth}px` };
  if (!isSelected(person)) return base;
  return {
    ...base,
    color: person.color,
    borderColor: person.color,
    backgroundColor: `${person.color}15`,
  };
}
</script>

<template>
  <div>
    <div v-if="label" class="mb-2 flex items-center gap-1.5">
      <span class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        {{ label }}
      </span>
      <span
        v-if="!selectedNames.length"
        class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        — выберите
      </span>
    </div>

    <div
      ref="containerRef"
      :role="multiple ? 'group' : 'radiogroup'"
      :aria-label="label || 'Человек'"
      class="flex flex-col gap-1.5"
    >
      <!-- `flex-wrap` — только для вырожденного случая: пока ширина контейнера
           не измерена, формула отдаёт один ряд со всем содержимым. -->
      <div
        v-for="(row, rowIndex) in rows"
        :key="rowIndex"
        role="presentation"
        class="flex flex-wrap gap-1.5"
      >
        <template
          v-for="cell in row"
          :key="cell.item.kind === 'person' ? cell.item.person.id : 'more'"
        >
          <button
            v-if="cell.item.kind === 'person'"
            :ref="chipRef"
            type="button"
            data-testid="person-chip"
            :role="multiple ? 'button' : 'radio'"
            :aria-pressed="multiple ? isSelected(cell.item.person) : undefined"
            :aria-checked="multiple ? undefined : isSelected(cell.item.person)"
            class="person-chip flex min-w-max shrink-0 grow items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm transition-[color,background-color,border-color,transform] duration-200 active:scale-95"
            :class="
              isSelected(cell.item.person)
                ? ''
                : 'border-border-light text-text-secondary-light hover:text-text-primary-light dark:border-border-dark dark:text-text-secondary-dark dark:hover:text-text-primary-dark'
            "
            :style="getChipStyle(cell.item.person, cell.maxWidth)"
            @click="selectPerson(cell.item.person.name)"
          >
            <InitialAvatar
              data-chip-lead
              :name="cell.item.person.name"
              :color="cell.item.person.color"
              size="xs"
              translucent
            />
            {{ cell.item.person.name }}
          </button>

          <button
            v-else
            type="button"
            data-testid="person-more"
            aria-label="Все люди"
            class="person-chip flex min-w-max shrink-0 grow items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-dashed border-border-light px-3 py-1.5 text-sm text-text-tertiary-light transition-[color,background-color,border-color,transform] duration-200 hover:text-text-secondary-light active:scale-95 dark:border-border-dark dark:text-text-tertiary-dark dark:hover:text-text-secondary-dark"
            :style="{ maxWidth: `${cell.maxWidth}px` }"
            @click="sheetOpen = true"
          >
            <UIcon name="group" size="sm" />
            {{ cell.item.label }}
          </button>
        </template>
      </div>
    </div>

    <PersonPickerSheet
      v-if="sheetOpen"
      :open="sheetOpen"
      :people="ranked"
      :selected="selectedNames"
      :multiple="multiple"
      @update:open="sheetOpen = $event"
      @select="handleSheetSelect"
      @create="emit('create', $event)"
    />
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .person-chip {
    transition: none;
  }
}
</style>
```

- [ ] **Step 4: Запустить тест**

Run: `cd frontend && bun run test -- src/entities/person/ui/PersonPicker.spec.ts`
Expected: PASS, 6 тестов.

- [ ] **Step 5: Экспортировать**

В `frontend/src/entities/person/index.ts` в блоке `// UI` добавить:

```ts
export { default as PersonPicker } from './ui/PersonPicker.vue';
export { default as PersonPickerSheet } from './ui/PersonPickerSheet.vue';
```

- [ ] **Step 6: Коммит**

```bash
git add frontend/src/entities/person/ui/PersonPicker.vue \
        frontend/src/entities/person/ui/PersonPicker.spec.ts \
        frontend/src/entities/person/index.ts
git commit -m "feat(person): PersonPicker — чипы людей по частоте использования"
```

---

### Task 5: `SubmitBar` — общий липкий подвал формы

**Files:**
- Create: `frontend/src/features/add-transaction/ui/SubmitBar.vue`
- Modify: `frontend/src/features/add-transaction/ui/TransactionForm.vue:469-499` (разметка) и `:504-516` (стили)

**Interfaces:**
- Produces: компонент без пропов, со слотами `hint` (текст над кнопкой) и default (кнопка). Требует, чтобы родитель имел горизонтальный паддинг `px-4` — подвал компенсирует его через `-mx-4 px-4`.

- [ ] **Step 1: Создать компонент**

Создать `frontend/src/features/add-transaction/ui/SubmitBar.vue`:

```vue
<script setup lang="ts">
/**
 * Липкий подвал формы: кнопка отправки не должна уезжать за экран, когда форма
 * выше вьюпорта или когда клавиатура поднимается под раскрытым полем.
 *
 * Живёт отдельным компонентом, потому что нужен и общей форме (расход, доход,
 * перевод), и панели долга, которая владеет собственным сабмитом.
 */
</script>

<template>
  <div
    class="submit-bar sticky bottom-0 -mx-4 mt-auto px-4 pt-3 [--bar-bg:var(--color-background-light)] dark:[--bar-bg:var(--color-background-dark)]"
  >
    <slot name="hint" />
    <slot />
  </div>
</template>

<style scoped>
/*
 * Подложка кнопки повторяет фон страницы. Цвет приходит переменной `--bar-bg`:
 * её ставит Tailwind-вариант `dark:` прямо на элементе — через
 * `:global(html.dark)` не выйдет, тема навешивается классом на `html`, а не на
 * конкретный узел. Верх полупрозрачный, чтобы содержимое уезжало под панель,
 * а не обрывалось.
 */
.submit-bar {
  background: linear-gradient(to bottom, transparent 0, var(--bar-bg) 0.75rem, var(--bar-bg));
  padding-bottom: max(var(--safe-area-inset-bottom), 0.75rem);
}
</style>
```

- [ ] **Step 2: Подключить в `TransactionForm`**

В `frontend/src/features/add-transaction/ui/TransactionForm.vue` в блоке импортов после `import TransactionMetaRow from './TransactionMetaRow.vue';` добавить:

```ts
import SubmitBar from './SubmitBar.vue';
```

Заменить разметку подвала (сейчас `<div v-if="formData.type !== 'debt'" class="submit-bar sticky …">…</div>`) на:

```vue
      <!-- Кнопка прилипает к низу: на «Переводе» форма выше экрана, и раньше до
           сабмита приходилось доскроллить. -->
      <SubmitBar v-if="formData.type !== 'debt'">
        <template #hint>
          <p
            v-if="error"
            data-testid="validation-error"
            role="alert"
            class="pb-2 text-xs text-danger"
          >
            {{ error }}
          </p>
          <p
            v-else-if="submitHint"
            class="pb-2 text-center text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            {{ submitHint }}
          </p>
        </template>

        <UButton
          type="submit"
          variant="primary"
          size="lg"
          full-width
          data-testid="submit-btn"
          :loading="isSubmitting"
          :disabled="!canSubmit"
        >
          {{ submitLabel }}
        </UButton>
      </SubmitBar>
```

- [ ] **Step 3: Убрать переехавшие стили**

Из `<style scoped>` в `TransactionForm.vue` удалить правило `.submit-bar { … }` вместе с его комментарием — оно теперь живёт в `SubmitBar.vue`. Оставить `.suggestion-chip`, комментарий про `.form-tail` и блок `prefers-reduced-motion` (убрав `.submit-bar` из селекторов, если он там упомянут).

- [ ] **Step 4: Прогнать тесты формы и собрать**

Run: `cd frontend && bun run test -- src/features/add-transaction && bun run build`
Expected: PASS + успешная сборка. Визуально подвал не должен измениться.

- [ ] **Step 5: Коммит**

```bash
git add frontend/src/features/add-transaction/ui/SubmitBar.vue \
        frontend/src/features/add-transaction/ui/TransactionForm.vue
git commit -m "refactor(add-transaction): вынести липкий подвал в SubmitBar"
```

---

### Task 6: `DatePickerField` — починка поповера и вариант-чип

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/DatePickerField.vue`
- Modify: `frontend/src/features/create-subscription/ui/SubscriptionForm.vue` (только если использует проп `flush`)

**Interfaces:**
- Produces: проп `flush?: boolean` заменяется на `variant?: 'field' | 'flush' | 'chip'` (по умолчанию `'field'`). `PopoverContent` получает `side="top"` и `:collision-padding="16"`.

**Why:** дефолты поповера (`side="bottom"`, `collisionPadding: 0`) роняют календарь за край экрана. Рабочая конфигурация уже есть в `TransactionMetaRow.vue:104-109`.

- [ ] **Step 1: Проверить, кто использует `flush`**

Run: `cd frontend && grep -rn "DatePickerField" src --include=*.vue`
Expected: `DebtPanel.vue` (два вызова, один с `flush`) и, возможно, `SubscriptionForm.vue`. Все найденные вызовы придётся привести к новому пропу.

- [ ] **Step 2: Заменить проп и починить поповер**

В `frontend/src/features/add-transaction/ui/DatePickerField.vue` заменить объявление пропа

```ts
  /** Поле внутри готовой строки списка: без своей рамки — она была бы второй. */
  flush?: boolean;
```

на

```ts
  /**
   * `field` — поле с рамкой; `flush` — внутри готовой строки списка, без своей
   * рамки; `chip` — компактная кнопка по ширине содержимого.
   */
  variant?: 'field' | 'flush' | 'chip';
```

и добавить дефолт, обернув `defineProps` в `withDefaults`:

```ts
const props = withDefaults(
  defineProps<{
    modelValue: string | null;
    placeholder?: string;
    clearable?: boolean;
    portalTo?: HTMLElement | null;
    variant?: 'field' | 'flush' | 'chip';
  }>(),
  { variant: 'field' },
);
```

Заменить классы триггера:

```vue
          :class="
            cn(
              'flex items-center gap-2 transition-all',
              variant === 'chip'
                ? 'shrink-0 rounded-xl border border-border-light px-3 py-2.5 hover:border-primary/40 dark:border-border-dark'
                : 'flex-1 justify-between py-3',
              variant === 'field' &&
                'px-4 rounded-xl border border-border-light dark:border-border-dark hover:border-primary/50',
              variant === 'flush' && 'px-3',
              modelValue
                ? 'text-text-primary-light dark:text-text-primary-dark'
                : 'text-text-tertiary-light dark:text-text-tertiary-dark',
            )
          "
```

и в `PopoverContent` добавить позиционирование:

```vue
      <!--
        Календарь открывается вверх и с отступом от края: на дефолтных
        `side="bottom"` + `collisionPadding: 0` он свисал за экран на низком
        вьюпорте и под поднявшейся клавиатурой — часть дат была недоступна.
        Ровно эта конфигурация работает в `TransactionMetaRow`.
      -->
      <PopoverContent
        class="w-auto p-0"
        align="start"
        side="top"
        :side-offset="8"
        :collision-padding="16"
        :to="portalTo"
      >
```

- [ ] **Step 3: Обновить вызовы**

В `frontend/src/features/add-transaction/ui/DebtPanel.vue` заменить `flush` на `variant="flush"` (будет полностью переписано в Task 8, но между тасками проект должен собираться). Если `SubscriptionForm.vue` передавал `flush` — заменить там же.

- [ ] **Step 4: Собрать и прогнать тесты**

Run: `cd frontend && bun run test -- src/features/add-transaction && bun run build`
Expected: PASS + успешная сборка.

- [ ] **Step 5: Коммит**

```bash
git add frontend/src/features/add-transaction/ui/DatePickerField.vue \
        frontend/src/features/add-transaction/ui/DebtPanel.vue
git commit -m "fix(date-picker): открывать календарь вверх с отступом от края"
```

---

### Task 7: `DueDateField` — срок возврата пресетами

**Files:**
- Create: `frontend/src/features/add-transaction/ui/DueDateField.vue`
- Create: `frontend/src/features/add-transaction/ui/DueDateField.spec.ts`

**Interfaces:**
- Consumes: `DatePickerField` с `variant="chip"` (Task 6); `toLocalISODate` из `@/shared/lib/date`.
- Produces: компонент с пропом `{ modelValue: string | null }` и эмитом `{ 'update:modelValue': [string | null] }`.

- [ ] **Step 1: Написать падающий тест**

Создать `frontend/src/features/add-transaction/ui/DueDateField.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import DueDateField from './DueDateField.vue';

function mountField(modelValue: string | null = null) {
  return mount(DueDateField, {
    props: { modelValue },
    global: { stubs: { DatePickerField: true, UIcon: true } },
  });
}

const presets = (w: ReturnType<typeof mountField>) =>
  w.findAll('[data-testid="due-preset"]').map((b) => b.text());

describe('DueDateField', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-27T10:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('показывает пресеты без срока, недели, двух недель и месяца', () => {
    expect(presets(mountField())).toEqual(['Без срока', 'Неделя', '2 недели', 'Месяц']);
  });

  it('«Неделя» отдаёт дату через семь дней', async () => {
    const wrapper = mountField();
    await wrapper.findAll('[data-testid="due-preset"]')[1].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['2026-08-03']);
  });

  it('«Месяц» отдаёт ту же дату следующего месяца', async () => {
    const wrapper = mountField();
    await wrapper.findAll('[data-testid="due-preset"]')[3].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['2026-08-27']);
  });

  it('«Без срока» сбрасывает значение', async () => {
    const wrapper = mountField('2026-08-03');
    await wrapper.findAll('[data-testid="due-preset"]')[0].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([null]);
  });

  it('подсвечивает пресет, совпавший с выбранной датой', () => {
    const wrapper = mountField('2026-08-03');
    const week = wrapper.findAll('[data-testid="due-preset"]')[1];
    expect(week.attributes('aria-pressed')).toBe('true');
  });

  it('«Без срока» активен, когда даты нет', () => {
    const none = mountField().findAll('[data-testid="due-preset"]')[0];
    expect(none.attributes('aria-pressed')).toBe('true');
  });
});
```

- [ ] **Step 2: Запустить тест**

Run: `cd frontend && bun run test -- src/features/add-transaction/ui/DueDateField.spec.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Создать компонент**

Создать `frontend/src/features/add-transaction/ui/DueDateField.vue`:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import { toLocalISODate } from '@/shared/lib/date';
import DatePickerField from './DatePickerField.vue';

/**
 * Срок возврата долга.
 *
 * Календарь для этого поля был лишним: срок почти всегда круглый — «через
 * неделю», «через месяц». Пресеты закрывают эти случаи одним нажатием, а
 * календарь остаётся для нерегулярных дат.
 */
const props = defineProps<{ modelValue: string | null }>();

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>();

const isCalendarOpen = ref(false);

/**
 * Смещения считаем от «сегодня» при каждом обращении: форма живёт долго, и
 * посчитанный на монтировании набор к полуночи стал бы вчерашним.
 */
function shiftedISO(shift: (date: Date) => void): string {
  const date = new Date();
  shift(date);
  return toLocalISODate(date);
}

const presets = computed(() => [
  { label: 'Без срока', value: null },
  { label: 'Неделя', value: shiftedISO((d) => d.setDate(d.getDate() + 7)) },
  { label: '2 недели', value: shiftedISO((d) => d.setDate(d.getDate() + 14)) },
  { label: 'Месяц', value: shiftedISO((d) => d.setMonth(d.getMonth() + 1)) },
]);

/** Дата, не попавшая ни в один пресет, живёт в чипе календаря. */
const isCustom = computed(
  () => props.modelValue !== null && !presets.value.some((p) => p.value === props.modelValue),
);
</script>

<template>
  <div>
    <label class="mb-1.5 block text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
      Срок возврата
    </label>

    <div class="flex flex-wrap items-center gap-1.5">
      <button
        v-for="preset in presets"
        :key="preset.label"
        type="button"
        data-testid="due-preset"
        :aria-pressed="modelValue === preset.value"
        class="due-chip shrink-0 rounded-lg border px-3 py-1.5 text-sm transition-[color,background-color,border-color,transform] duration-200 active:scale-95"
        :class="
          modelValue === preset.value
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border-light text-text-secondary-light hover:text-text-primary-light dark:border-border-dark dark:text-text-secondary-dark dark:hover:text-text-primary-dark'
        "
        @click="emit('update:modelValue', preset.value)"
      >
        {{ preset.label }}
      </button>

      <DatePickerField
        v-model:open="isCalendarOpen"
        variant="chip"
        :model-value="isCustom ? modelValue : null"
        placeholder="Дата…"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .due-chip {
    transition: none;
  }
}
</style>
```

- [ ] **Step 4: Запустить тест**

Run: `cd frontend && bun run test -- src/features/add-transaction/ui/DueDateField.spec.ts`
Expected: PASS, 6 тестов.

- [ ] **Step 5: Коммит**

```bash
git add frontend/src/features/add-transaction/ui/DueDateField.vue \
        frontend/src/features/add-transaction/ui/DueDateField.spec.ts
git commit -m "feat(add-transaction): срок возврата пресетами вместо календаря"
```

---

### Task 8: Счёт долга на карточке суммы

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/AmountHeadline.vue:20-39` (пропы), `:76-81` (прогноз)
- Modify: `frontend/src/features/add-transaction/ui/TransactionForm.vue:99-122` (знак, баланс, счёт на карточке), `:438-450` (пропы `DebtPanel`)

**Interfaces:**
- Consumes: эмит `balance-effect` из `DebtPanel` (реализуется в Task 9) с payload `{ sign: 'minus' | 'plus' | null; extraDebit: number }`.
- Produces: у `AmountHeadline` новый необязательный проп `extraDebit?: number` (по умолчанию 0), вычитаемый из прогноза при `sign === 'minus'`.

- [ ] **Step 1: Добавить `extraDebit` в `AmountHeadline`**

В `frontend/src/features/add-transaction/ui/AmountHeadline.vue` в `defineProps` после `showInsufficientFunds?: boolean;` добавить:

```ts
  /**
   * Что уйдёт со счёта сверх суммы — комиссия за перевод при выдаче долга.
   * Без неё прогноз остатка врал бы ровно на её величину.
   */
  extraDebit?: number;
```

и заменить `projectedBalance`:

```ts
const projectedBalance = computed(() => {
  if (props.currentBalance === undefined || !props.sign) return null;
  return props.sign === 'minus'
    ? props.currentBalance - props.amount - (props.extraDebit ?? 0)
    : props.currentBalance + props.amount;
});
```

- [ ] **Step 2: Научить `TransactionForm` знаку долга**

В `frontend/src/features/add-transaction/ui/TransactionForm.vue` после блока `usePanelState` добавить:

```ts
/**
 * Как долг двинет баланс счёта. Направление и комиссия живут в собственной
 * модели панели (`useDebtForm`), поэтому приходят наверх событием: карточке
 * суммы нужен знак, чтобы показать прогноз остатка так же, как на расходе.
 */
const debtEffect = ref<{ sign: 'minus' | 'plus' | null; extraDebit: number }>({
  sign: null,
  extraDebit: 0,
});

const isDebt = computed(() => props.formData.type === 'debt');

/**
 * Значение читаем, только пока открыта вкладка долга: панель кэшируется
 * `KeepAlive` и после ухода на «Расход» последний эффект остался бы в силе.
 */
const extraDebit = computed(() => (isDebt.value ? debtEffect.value.extraDebit : 0));
```

Заменить `amountSign`:

```ts
/**
 * Направление движения денег по счёту. Перевод тоже списывает — поэтому на нём
 * виден прогноз остатка. У долга знак задаёт направление: «дал» списывает,
 * «взял» пополняет, а с выключенной транзакцией баланс не двигается вовсе.
 */
const amountSign = computed<'minus' | 'plus' | null>(() => {
  if (isDebt.value) return debtEffect.value.sign;
  if (props.formData.type === 'income') return 'plus';
  return 'minus';
});
```

Заменить `showInsufficientFunds` (комиссия тоже уходит со счёта, `hasSufficientFunds` о ней не знает):

```ts
/** Списание сверх остатка — предупреждаем и на расходе, и на переводе, и на долге. */
const showInsufficientFunds = computed(() => {
  if (amountSign.value !== 'minus') return false;
  if (currentBalance.value === undefined) return false;
  return currentBalance.value < props.formData.amount + extraDebit.value;
});
```

Заменить `showAccountOnCard` и `cardBalance`:

```ts
/**
 * Заголовок-переключатель счёта на карточке нужен там, где счёт больше нигде не
 * выбирается. У перевода его задаёт строка «Откуда → Куда»; расход, доход и
 * долг выбирают счёт здесь.
 */
const showAccountOnCard = computed(() => props.formData.type !== 'transfer');

const cardBalance = computed(() =>
  props.formData.accountId ? currentBalance.value : undefined,
);
```

Удалить из деструктуризации `usePanelState` больше не используемый `hasSufficientFunds` (если после правок он нигде не читается — проверить `grep -n "hasSufficientFunds" src/features/add-transaction/ui/TransactionForm.vue`).

- [ ] **Step 3: Пробросить проп и подписаться на событие**

В шаблоне `TransactionForm.vue` в `<AmountHeadline …>` добавить строку после `:show-insufficient-funds="showInsufficientFunds"`:

```vue
        :extra-debit="extraDebit"
```

и в `<DebtPanel …>` добавить обработчик:

```vue
          @balance-effect="debtEffect = $event"
```

- [ ] **Step 4: Собрать и прогнать тесты**

Run: `cd frontend && bun run test -- src/features/add-transaction && bun run build`
Expected: PASS + сборка. `DebtPanel` пока событие не шлёт — знак у долга останется `null`, это ожидаемо до Task 9.

- [ ] **Step 5: Коммит**

```bash
git add frontend/src/features/add-transaction/ui/AmountHeadline.vue \
        frontend/src/features/add-transaction/ui/TransactionForm.vue
git commit -m "feat(add-transaction): счёт и прогноз остатка на карточке суммы для долга"
```

---

### Task 9: `DebtPanel` — новая раскладка

**Files:**
- Modify: `frontend/src/features/add-transaction/ui/DebtPanel.vue` (переписывается целиком)
- Modify: `frontend/src/features/add-transaction/ui/DebtPanel.spec.ts`

**Interfaces:**
- Consumes: `PersonPicker` (Task 4), `SubmitBar` (Task 5), `DatePickerField variant="chip"` (Task 6), `DueDateField` (Task 7), `useDebts` из `@/entities/debt`.
- Produces: новый эмит `balance-effect: [{ sign: 'minus' | 'plus' | null; extraDebit: number }]`. Эмиты `update:accountId` и `update:currency` сохраняются (панель по-прежнему подтягивает валюту счёта при монтировании). Проп `defaultAccountId` сохраняется.

- [ ] **Step 1: Переписать тест под новую раскладку**

Заменить содержимое `frontend/src/features/add-transaction/ui/DebtPanel.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import DebtPanel from './DebtPanel.vue';
import { renderWithProviders } from '@/test/test-utils';
import type { AccountWithBalances } from '@/entities/account';

vi.mock('@/shared/lib/haptics', () => ({ useHaptics: () => ({ trigger: vi.fn() }) }));
vi.mock('@/shared/lib/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ userId: { value: 'u1' } }),
}));
vi.mock('@/entities/person', () => ({
  PersonPicker: {
    template: '<div data-testid="person-picker" @click="$emit(\'select\', \'Азиз\')" />',
    props: ['people', 'debts', 'selected', 'label', 'multiple'],
    emits: ['select', 'create'],
  },
  usePeople: () => ({ people: { value: [] }, createPerson: vi.fn() }),
}));
vi.mock('@/entities/debt', () => ({ useDebts: () => ({ debts: { value: [] } }) }));

const accounts = [
  {
    id: 'a1',
    name: 'Основной',
    color: '#3b82f6',
    balances: [{ currency: 'UZS', balance: 1_000_000 }],
  },
] as unknown as AccountWithBalances[];

function mountPanel(amount = 98_000) {
  return renderWithProviders(DebtPanel, {
    props: { amount, currency: 'UZS', accountId: 'a1', accounts },
    global: { stubs: { DatePickerField: true, DueDateField: true, ToggleRow: true } },
  });
}

/** Модель стартует с `debt_type: 'taken'` — комиссию платит только отправитель. */
function switchToGiven(wrapper: ReturnType<typeof mountPanel>) {
  return wrapper.findAll('[role="tab"]')[0].trigger('click');
}

describe('DebtPanel', () => {
  it('человека выбирают чипами, а не текстовым полем', () => {
    const wrapper = mountPanel();
    expect(wrapper.find('[data-testid="person-picker"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="debt-fields"]').exists()).toBe(false);
  });

  it('счёт больше не выбирается внутри панели — он живёт на карточке суммы', () => {
    expect(mountPanel().find('[data-testid="debt-row-account"]').exists()).toBe(false);
  });

  it('не показывает строку-итог: прогноз остатка есть на карточке суммы', () => {
    expect(mountPanel().find('[data-testid="debt-summary"]').exists()).toBe(false);
  });

  it('кнопка сабмита лежит в липком подвале', () => {
    expect(mountPanel().find('.submit-bar [data-testid="debt-submit"]').exists()).toBe(true);
  });

  it('подсказывает, чего не хватает, пока кнопка заблокирована', () => {
    expect(mountPanel(0).find('[data-testid="debt-submit-hint"]').text()).toBe(
      'Укажите имя и сумму',
    );
  });

  it('подсказка исчезает, когда форма заполнена', async () => {
    const wrapper = mountPanel();
    await wrapper.find('[data-testid="person-picker"]').trigger('click');
    expect(wrapper.find('[data-testid="debt-submit-hint"]').exists()).toBe(false);
  });

  it('сообщает наверх, что взятый долг пополняет счёт', () => {
    const events = mountPanel().emitted('balance-effect');
    expect(events?.at(-1)).toEqual([{ sign: 'plus', extraDebit: 0 }]);
  });

  it('сообщает наверх, что выданный долг списывает со счёта', async () => {
    const wrapper = mountPanel();
    await switchToGiven(wrapper);
    expect(wrapper.emitted('balance-effect')?.at(-1)).toEqual([
      { sign: 'minus', extraDebit: 0 },
    ]);
  });

  it('комиссия появляется в раскрытом «Ещё» при выдаче долга', async () => {
    const wrapper = mountPanel();
    await switchToGiven(wrapper);
    await wrapper.find('[data-testid="debt-more-toggle"]').trigger('click');
    expect(wrapper.find('[data-testid="debt-fee-input"]').exists()).toBe(true);
  });

  it('комиссия скрыта, пока «Ещё» свёрнуто', async () => {
    const wrapper = mountPanel();
    await switchToGiven(wrapper);
    expect(wrapper.find('[data-testid="debt-fee-input"]').exists()).toBe(false);
  });

  it('комиссия уходит наверх как дополнительное списание', async () => {
    const wrapper = mountPanel();
    await switchToGiven(wrapper);
    await wrapper.find('[data-testid="debt-more-toggle"]').trigger('click');
    await wrapper.find('[data-testid="debt-fee-input"]').setValue('5000');
    expect(wrapper.emitted('balance-effect')?.at(-1)).toEqual([
      { sign: 'minus', extraDebit: 5000 },
    ]);
  });

  it('с выключенной транзакцией баланс не двигается', async () => {
    const wrapper = mountPanel();
    await wrapper.find('[data-testid="debt-more-toggle"]').trigger('click');
    await wrapper.findAllComponents({ name: 'ToggleRow' })[1].vm.$emit('update:modelValue', true);
    expect(wrapper.emitted('balance-effect')?.at(-1)).toEqual([{ sign: null, extraDebit: 0 }]);
  });
});
```

- [ ] **Step 2: Запустить тест**

Run: `cd frontend && bun run test -- src/features/add-transaction/ui/DebtPanel.spec.ts`
Expected: FAIL — старая разметка не отвечает новым ожиданиям.

- [ ] **Step 3: Переписать `DebtPanel.vue`**

Заменить содержимое `frontend/src/features/add-transaction/ui/DebtPanel.vue`:

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UInput, UButton, UIcon, ToggleRow } from '@/shared/ui';
import { DEFAULT_CURRENCY } from '@/entities/currency';
import { sanitizeCurrencyInput } from '@/shared/lib/format/currency';
import { getCurrencyByCode } from '@/entities/currency';
import { formatCurrency } from '@/shared/lib/format/currency';
import { PersonPicker, usePeople } from '@/entities/person';
import { useDebts } from '@/entities/debt';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useHaptics } from '@/shared/lib/haptics';
import type { AccountWithBalances } from '@/entities/account';
import { useDebtForm } from '../model/useDebtForm';
import DebtDirectionPill from './DebtDirectionPill.vue';
import DatePickerField from './DatePickerField.vue';
import DueDateField from './DueDateField.vue';
import SubmitBar from './SubmitBar.vue';

const props = defineProps<{
  /** Сумма, валюта и счёт живут в общей форме — панель только следует за ними. */
  amount: number;
  currency: string;
  accountId: string | null;
  accounts: AccountWithBalances[];
  defaultAccountId?: string | null;
}>();

const emit = defineEmits<{
  submitted: [];
  'update:currency': [value: string];
  /**
   * Счёт долга поднимается в общую форму, чтобы карточка суммы знала, из каких
   * валют этого счёта выбирать.
   */
  'update:accountId': [value: string];
  /**
   * Как долг двинет баланс: направление плюс то, что уходит сверх суммы.
   * Карточка суммы рисует по этому прогноз остатка — так же, как на расходе.
   */
  'balance-effect': [value: { sign: 'minus' | 'plus' | null; extraDebit: number }];
}>();

const { userId } = useCurrentUser();
const { people, createPerson } = usePeople(userId);
// Долги — сигнал частоты для порядка людей. Запрос уже прогрет дашбордом,
// поэтому здесь это чтение кэша, а не поход в сеть.
const { debts } = useDebts(userId);
const { trigger } = useHaptics();
const { formData, isValid, isSubmitting, error, createDebt, updateField } = useDebtForm();

// Карточка суммы — единственный редактор суммы и валюты долга; своя модель
// подтягивается за ней.
watch(
  () => props.amount,
  (amount) => updateField('amount', amount),
  { immediate: true },
);
watch(
  () => props.currency,
  (currency) => updateField('currency', currency),
  { immediate: true },
);

/**
 * Счёт берём тот, что уже выбран в форме, а не профильный дефолт: панель
 * монтируется при заходе на вкладку, и подстановка «своего» счёта молча
 * перебивала бы счёт и валюту начатой транзакции другого типа.
 */
watch(
  [() => props.accounts, () => props.accountId],
  ([accs, accountId]) => {
    if (accs.length === 0) return;
    const preferred =
      (accountId && accs.find((a) => a.id === accountId)) ||
      (props.defaultAccountId && accs.find((a) => a.id === props.defaultAccountId)) ||
      accs[0];
    if (formData.value.account_id === preferred.id) return;

    updateField('account_id', preferred.id);
    // Наверх сообщаем, только если счёт пришёл не оттуда — иначе это эхо.
    if (preferred.id !== accountId) {
      emit('update:accountId', preferred.id);
      emit('update:currency', preferred.balances[0]?.currency || DEFAULT_CURRENCY);
    }
  },
  { immediate: true },
);

/**
 * Эффект считаем `computed`: пересчёт идёт только на смену направления,
 * комиссии и флага транзакции, поэтому наблюдатель не шлёт событие на каждое
 * нажатие цифры в сумме.
 */
const balanceEffect = computed(() => ({
  sign: formData.value.skip_transaction
    ? null
    : formData.value.debt_type === 'given'
      ? ('minus' as const)
      : ('plus' as const),
  extraDebit: formData.value.skip_transaction ? 0 : formData.value.fee,
}));

watch(balanceEffect, (effect) => emit('balance-effect', effect), { immediate: true });

const isDebtDateOpen = ref(false);
const showMore = ref(false);

/** Сколько необязательных полей заполнено — подпись «Ещё» иначе выглядит пустой. */
const extrasCount = computed(
  () =>
    Number(Boolean(formData.value.due_date)) +
    Number(Boolean(formData.value.description.trim())) +
    Number(formData.value.is_private) +
    Number(formData.value.skip_transaction) +
    Number(formData.value.fee > 0),
);

// Комиссию платит отправитель, поэтому она есть только при выдаче долга.
// Без транзакции списывать нечего — поле тоже прячем.
const showFeeInput = computed(
  () => formData.value.debt_type === 'given' && !formData.value.skip_transaction,
);

const rawFeeValue = ref('');
const isFeeInputFocused = ref(false);
const totalDebited = computed(() => formData.value.amount + formData.value.fee);

function handleFeeInput(raw: string) {
  const sanitized = sanitizeCurrencyInput(raw);
  rawFeeValue.value = sanitized;
  const num = parseFloat(sanitized);
  updateField('fee', Number.isNaN(num) ? 0 : num);
}

function handleFeeBlur() {
  isFeeInputFocused.value = false;
  if (formData.value.fee === 0) rawFeeValue.value = '';
}

// Модель сама обнуляет комиссию при смене направления или отключении
// транзакции — сырое значение инпута должно поехать следом. Пока поле в фокусе
// не трогаем: иначе промежуточные «0» и «0.» стирались бы прямо во время ввода.
watch(
  () => formData.value.fee,
  (fee) => {
    if (isFeeInputFocused.value) return;
    if (fee === 0 && rawFeeValue.value !== '') rawFeeValue.value = '';
  },
);

async function handleSubmit() {
  if (!userId.value) return;
  const debtId = await createDebt(userId.value);
  if (debtId) {
    trigger('success');
    emit('submitted');
  }
}

const personLabel = computed(() =>
  formData.value.debt_type === 'given' ? 'Кому дали в долг' : 'У кого взяли в долг',
);
const skipToggleTitle = computed(() =>
  formData.value.debt_type === 'given' ? 'Не списывать с баланса' : 'Не добавлять на баланс',
);

/**
 * Заблокированная кнопка без объяснения — тупик: пользователь тапает и не
 * понимает, чего не хватает. Называем недостающее прямо над ней, как на
 * остальных вкладках.
 */
const submitHint = computed(() => {
  if (isValid.value || isSubmitting.value) return null;
  const missing: string[] = [];
  if (!formData.value.person_name.trim()) missing.push('имя');
  if (formData.value.amount <= 0) missing.push('сумму');
  if (!formData.value.account_id) missing.push('счёт');
  if (!missing.length) return null;
  const last = missing[missing.length - 1];
  const head = missing.slice(0, -1);
  return `Укажите ${head.length ? `${head.join(', ')} и ${last}` : last}`;
});

/**
 * Печатаем сумму тем же символом, что и главная сумма выше: `Intl` для UZS
 * отдаёт код «UZS», и под «98 000 сўм» появлялось «98 000 UZS» — две записи
 * одной валюты на одном экране.
 */
function withSymbol(value: number) {
  const symbol = getCurrencyByCode(formData.value.currency)?.symbol ?? formData.value.currency;
  return `${formatCurrency(value, formData.value.currency, { showSymbol: false })} ${symbol}`;
}
</script>

<template>
  <div class="flex flex-1 flex-col gap-3 pb-4 md:pb-8">
    <DebtDirectionPill
      :model-value="formData.debt_type"
      @update:model-value="updateField('debt_type', $event)"
    />

    <PersonPicker
      :people="people"
      :debts="debts"
      :selected="formData.person_name"
      :label="personLabel"
      @select="updateField('person_name', $event)"
      @create="(name: string) => createPerson({ name })"
    />

    <!-- Дата — один чип: рамочный список из трёх строк потерял две из них
         (человек уехал в чипы, счёт — на карточку суммы), и одинокая строка в
         рамке читалась бы как обрубок. -->
    <div class="flex">
      <DatePickerField
        v-model:open="isDebtDateOpen"
        variant="chip"
        :model-value="formData.debt_date"
        @update:model-value="updateField('debt_date', $event)"
      />
    </div>

    <!--
      Срок, комиссия, комментарий и два переключателя заполняют единицы — на
      виду они растягивали панель на два экрана. Волосяная линия сверху нужна,
      чтобы строка вообще читалась как элемент управления. Счётчик показывает,
      что под «Ещё» уже что-то задано.
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
          Со счёта спишется {{ withSymbol(totalDebited) }} — долг
          {{ withSymbol(formData.amount) }} + комиссия {{ withSymbol(formData.fee) }}
        </p>
      </div>

      <DueDateField
        :model-value="formData.due_date"
        @update:model-value="updateField('due_date', $event)"
      />

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

    <!-- Кнопка прилипает к низу: без этого раскрытое «Ещё» плюс поднявшаяся
         под комментарием клавиатура уносили её за экран. -->
    <SubmitBar>
      <template #hint>
        <p v-if="error" role="alert" class="pb-2 text-xs text-danger">{{ error }}</p>
        <p
          v-else-if="submitHint"
          data-testid="debt-submit-hint"
          class="pb-2 text-center text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          {{ submitHint }}
        </p>
      </template>

      <UButton
        type="button"
        variant="primary"
        size="lg"
        full-width
        data-testid="debt-submit"
        :loading="isSubmitting"
        :disabled="!isValid"
        @click="handleSubmit"
      >
        Создать долг
      </UButton>
    </SubmitBar>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .more-chevron {
    transition: none;
  }
}
</style>
```

- [ ] **Step 4: Запустить тесты**

Run: `cd frontend && bun run test -- src/features/add-transaction/ui/DebtPanel.spec.ts`
Expected: PASS, 12 тестов.

- [ ] **Step 5: Прогнать всю фичу и собрать**

Run: `cd frontend && bun run lint && bun run test -- src/features/add-transaction && bun run build`
Expected: PASS + успешная сборка.

- [ ] **Step 6: Коммит**

```bash
git add frontend/src/features/add-transaction/ui/DebtPanel.vue \
        frontend/src/features/add-transaction/ui/DebtPanel.spec.ts
git commit -m "feat(add-transaction): новая раскладка панели долга"
```

---

### Task 10: Шторка разделения расхода на `PersonPicker`

**Files:**
- Modify: `frontend/src/features/split-expense/ui/SplitExpenseDrawer.vue:40-62` (модель), `:209-233` (разметка)

**Interfaces:**
- Consumes: `PersonPicker` (Task 4), `useDebts` из `@/entities/debt`.
- Produces: без изменений в эмитах шторки — `addParticipant` / `removeParticipant` остаются прежними.

- [ ] **Step 1: Заменить импорты и модель**

В `frontend/src/features/split-expense/ui/SplitExpenseDrawer.vue` заменить

```ts
import { PersonSelector, usePeople } from '@/entities/person';
```

на

```ts
import { PersonPicker, usePeople } from '@/entities/person';
import { useDebts } from '@/entities/debt';
```

Заменить блок модели (объявления `newParticipantName`, `availablePeople`, `quickContacts`) на:

```ts
const { userId } = useCurrentUser();
const { people, createPerson } = usePeople(userId);
// Порядок людей задаёт частота долгов; запрос прогрет дашбордом.
const { debts } = useDebts(userId);

const participantNames = computed(() => props.splitData.participants.map((p) => p.personName));
```

Удалить `newParticipantName`, `availablePeople` и `quickContacts` — они больше не нужны: выбранные участники не исчезают из ряда, а подсвечиваются.

Заменить `handleAddParticipant` и `handleQuickAdd` одной функцией-переключателем:

```ts
/**
 * Тап по чипу переключает участие. Раньше добавленный человек просто пропадал
 * из списка доступных, и снять его можно было только крестиком в списке ниже —
 * два разных места для одного действия.
 */
function toggleParticipant(name: string) {
  const existing = props.splitData.participants.find(
    (p) => p.personName.toLowerCase() === name.trim().toLowerCase(),
  );
  if (existing) {
    emit('removeParticipant', existing.id);
    return;
  }
  const matched = findPerson(name);
  emit('addParticipant', name.trim(), !!matched, matched?.color);
}
```

- [ ] **Step 2: Заменить разметку**

Заменить блок `<!-- Person search -->` вместе с `<!-- Quick contact chips -->` (от `<PersonSelector` до закрывающего `</Transition>` секции чипов) на:

```vue
          <PersonPicker
            multiple
            :people="people"
            :debts="debts"
            :selected="participantNames"
            label="Кто участвует"
            @select="toggleParticipant"
            @create="(name: string) => createPerson({ name })"
          />
```

- [ ] **Step 3: Убрать осиротевшее**

Проверить, что `sectionFade` всё ещё используется (участники, тумблер, сводка) — если нет, удалить. Проверить, что `findPerson` используется. Запустить:

Run: `cd frontend && bun run lint`
Expected: без ошибок `no-unused-vars`. Удалить всё, на что укажет линтер.

- [ ] **Step 4: Прогнать тесты и собрать**

Run: `cd frontend && bun run test -- src/features/split-expense && bun run build`
Expected: PASS + сборка. Если тесты шторки монтируют её и падают — добавить стаб `vaul-vue` по образцу других spec-файлов проекта (`vi.mock('vaul-vue', () => …)` с реэкспортом `@/test/stubs/vaul`).

- [ ] **Step 5: Коммит**

```bash
git add frontend/src/features/split-expense/ui/SplitExpenseDrawer.vue
git commit -m "feat(split-expense): чипы людей по частоте вместо инпута и быстрых контактов"
```

---

### Task 11: `PersonSelector` — ранжирование для шита импорта

**Files:**
- Modify: `frontend/src/entities/person/ui/PersonSelector.vue:6-46`
- Modify: `frontend/src/pages/import-inbox/confirm/DebtAssignSheet.vue`

**Interfaces:**
- Produces: у `PersonSelector` новый необязательный проп `debts?: DebtUsage[]`. Когда передан — порядок задаёт `rankPeopleByUsage`, иначе прежний алфавитный.

- [ ] **Step 1: Добавить проп и заменить сортировку**

В `frontend/src/entities/person/ui/PersonSelector.vue` в `defineProps` добавить:

```ts
    /** Долги — сигнал частоты. Без них порядок остаётся алфавитным. */
    debts?: DebtUsage[];
```

Добавить импорт:

```ts
import { rankPeopleByUsage, type DebtUsage } from '../lib/rankPeopleByUsage';
```

Заменить `sortedPeople`:

```ts
/**
 * Порядок — от часто используемых к редким, когда есть по чему судить.
 * Алфавит прятал постоянный контакт под последней буквой.
 */
const sortedPeople = computed(() =>
  props.debts
    ? rankPeopleByUsage(props.people, props.debts)
    : [...props.people].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
);
```

- [ ] **Step 2: Передать долги на странице импорта**

В `frontend/src/pages/import-inbox/confirm/DebtAssignSheet.vue` найти использование `<PersonSelector`. Долги на этой странице уже загружены — `ImportConfirmPage.vue:126` вызывает `useDebts(userId)`. Пробросить их в шит пропом `debts` и дальше в `PersonSelector`:

```vue
          <PersonSelector
            :debts="debts"
```

Если `DebtAssignSheet` не получает долги от страницы — добавить проп `debts?: DebtUsage[]` в его `defineProps` и передать из `ImportConfirmPage.vue` в месте, где шит монтируется.

- [ ] **Step 3: Прогнать тесты и собрать**

Run: `cd frontend && bun run lint && bun run test && bun run build`
Expected: PASS во всём наборе + успешная сборка.

- [ ] **Step 4: Коммит**

```bash
git add frontend/src/entities/person/ui/PersonSelector.vue \
        frontend/src/pages/import-inbox/confirm/
git commit -m "feat(person): ранжировать список PersonSelector по частоте"
```

---

### Task 12: Changelog и финальная проверка

**Files:**
- Modify: `frontend/src/features/changelog/model/changelogData.ts`

- [ ] **Step 1: Поднять патч-версию и добавить запись**

В `frontend/src/features/changelog/model/changelogData.ts`:

```ts
export const CURRENT_VERSION = '1.0.69';
```

и первым элементом массива `CHANGELOG_ENTRIES`:

```ts
  {
    version: '1.0.69',
    date: '2026-07-27',
    title: 'Долги стало удобнее заводить',
    items: [
      {
        type: 'improvement',
        text: 'Человека в долге и в разделении расхода теперь выбирают нажатием на имя, а не набором в поле. Имена идут от тех, с кем вы имеете дело чаще всего.',
      },
      {
        type: 'improvement',
        text: 'Счёт долга выбирается там же, где у расхода и дохода — над суммой, с прогнозом остатка.',
      },
      {
        type: 'fix',
        text: 'Кнопка «Создать долг» больше не уезжает за экран, когда заполняете комментарий.',
      },
      {
        type: 'fix',
        text: 'Календарь срока возврата больше не открывается за краем экрана. Неделю, две и месяц можно выбрать одним нажатием.',
      },
    ],
  },
```

- [ ] **Step 2: Полная проверка**

Run: `cd frontend && bun run lint && bun run test && bun run build`
Expected: всё зелёное. Отдельно убедиться, что `scripts/check-eager-bundle.mjs` (запускается после `build`) не ругается на бюджет: `PersonPickerSheet` подключён `defineAsyncComponent`, в стартовый граф попасть не должен.

Run: `cd backend && bun run build`
Expected: успешная сборка (бэкенд не менялся — проверка на всякий случай).

- [ ] **Step 3: Коммит**

```bash
git add frontend/src/features/changelog/model/changelogData.ts
git commit -m "chore(changelog): 1.0.69 — редизайн долга и выбора человека"
```

---

## Self-Review

**Покрытие спеки:**

| Раздел спеки | Задача |
|---|---|
| 1. Ранжирование по частоте | Task 1 |
| 2. `PersonPicker` + замер чипа | Task 2, Task 4 |
| 3. `PersonPickerSheet` | Task 3 |
| 4. Панель «Долг»: счёт наверх, прогноз, итог удалён, чип даты, липкая кнопка | Task 5, Task 8, Task 9 |
| 5. Срок возврата: пресеты + фикс поповера | Task 6, Task 7 |
| 6. Шторка разделения | Task 10 |
| `PersonSelector` для импорта | Task 11 |
| Changelog, сборка | Task 12 |

**Согласованность типов:** `DebtUsage` объявлен в Task 1 и потребляется в Tasks 4, 9, 10, 11 под тем же именем. `balance-effect` объявлен в Task 9 и потребляется в Task 8 с тем же payload `{ sign, extraDebit }`. `variant: 'field' | 'flush' | 'chip'` объявлен в Task 6 и используется в Tasks 7, 9. `rankPeopleByUsage(people, debts, now?)` — одна сигнатура во всех вызовах.

**Порядок:** Task 8 меняет `TransactionForm` под событие, которое появляется в Task 9. Между ними проект собирается и работает — у долга просто нет прогноза остатка. Это допустимый промежуточный шаг; переставлять их местами нельзя, потому что Task 9 иначе эмитил бы событие в пустоту.
