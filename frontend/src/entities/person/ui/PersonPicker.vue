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
 * клавиатура, попадание в строку выпадающего списка высотой в полторы строки.
 * Постоянных контактов у пользователя единицы, и они прекрасно ложатся в два
 * ряда чипов — а порядок по частоте ставит нужного в первый ряд.
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
 * Выбранный человек виден всегда, даже если по частоте не попал в топ: иначе
 * после выбора из шита ни один чип не подсвечен и экран выглядит незаполненным.
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

/**
 * Кнопка шита стоит всегда, даже когда прятать нечего: только через неё
 * заводится человек, которого ещё нет в контактах. У категорий такой нужды нет
 * — там список закрыт, — поэтому порог «показать всё» из `CategoryPicker`
 * здесь не годится.
 *
 * Подпись зависит от того, есть ли вообще с кем сравнивать: на пустом списке
 * «Другой» читался бы как «другой из чего».
 */
const moreLabel = computed(() => {
  if (hiddenCount.value > 0) return `Ещё ${hiddenCount.value}`;
  return inlinePeople.value.length ? 'Другой' : 'Добавить человека';
});

const cells = computed<Cell[]>(() => [
  ...inlinePeople.value.map((person) => ({ kind: 'person' as const, person })),
  { kind: 'more' as const, label: moreLabel.value },
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
           не измерена (узел смонтирован скрытым — `ResizeObserver` о таком не
           сообщает), формула отдаёт один ряд со всем содержимым. -->
      <div
        v-for="(row, rowIndex) in rows"
        :key="rowIndex"
        role="presentation"
        data-testid="person-row"
        class="flex flex-wrap gap-1.5"
      >
        <template
          v-for="cell in row"
          :key="cell.item.kind === 'person' ? cell.item.person.id : 'more'"
        >
          <!-- `min-w-max shrink-0 grow`: чип растёт, добирая ряд до полной
               ширины, но никогда не уходит ниже своего содержимого — поэтому
               имена не режутся ни при какой погрешности замера. -->
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
      @select="selectPerson"
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
