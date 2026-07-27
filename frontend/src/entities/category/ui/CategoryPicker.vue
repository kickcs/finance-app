<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue';
import { UIcon } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import { useJustifiedRows } from '@/shared/lib/hooks/useJustifiedRows';
import type { Transaction } from '@/shared/api/database.types';
import type { Category } from '../model/types';
import { getFrequentCategories } from '../model/useFrequentCategories';

const props = defineProps<{
  categories: Category[];
  selectedId: string;
  label?: string;
  transactions?: Transaction[];
}>();

const emit = defineEmits<{
  select: [categoryId: string];
}>();

// Шит на vaul тянет свой пакет и открывается по нажатию — в кадр первой
// отрисовки формы ему попадать незачем.
const CategoryPickerSheet = defineAsyncComponent(() => import('./CategoryPickerSheet.vue'));

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
 * Чип «Ещё N» едет в раскладке вместе с категориями: последний ряд, посчитанный
 * без него, всё равно не сошёлся бы по ширине.
 */
type Cell = { kind: 'category'; category: Category } | { kind: 'more'; label: string };

const cells = computed<Cell[]>(() => {
  const list: Cell[] = inlineCategories.value.map((category) => ({
    kind: 'category' as const,
    category,
  }));
  if (showAllButton.value) {
    list.push({ kind: 'more', label: `Ещё ${hiddenCount.value}` });
  }
  return list;
});

const { containerRef, chipRef, rows } = useJustifiedRows(
  cells,
  (cell) => (cell.kind === 'category' ? cell.category.name : cell.label),
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
      <!-- `flex-wrap` — только для вырожденного случая: пока ширина контейнера не
           измерена (узел смонтирован скрытым — `ResizeObserver` о таком не
           сообщает), формула отдаёт один ряд со всем содержимым, и без переноса он
           вылез бы за экран. В измеренной раскладке ряд всегда влезает. -->
      <div
        v-for="(row, rowIndex) in rows"
        :key="rowIndex"
        role="presentation"
        data-testid="category-row"
        class="flex flex-wrap gap-1.5"
      >
        <template
          v-for="cell in row"
          :key="cell.item.kind === 'category' ? cell.item.category.id : 'more'"
        >
          <!-- `min-w-max shrink-0 grow`: чип растёт, добирая ряд до полной
               ширины, но никогда не уходит ниже своего содержимого — поэтому
               названия не режутся ни при какой погрешности замера. -->
          <button
            v-if="cell.item.kind === 'category'"
            :ref="chipRef"
            type="button"
            role="radio"
            :aria-checked="cell.item.category.id === selectedId"
            class="category-chip flex min-w-max shrink-0 grow items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm transition-[color,background-color,border-color,transform] duration-200 active:scale-95"
            :class="
              cell.item.category.id !== selectedId
                ? 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
                : ''
            "
            :style="getChipStyle(cell.item.category, cell.maxWidth)"
            @click="selectCategory(cell.item.category.id)"
          >
            <UIcon
              :name="cell.item.category.icon"
              size="sm"
              :style="{ color: cell.item.category.color }"
            />
            {{ cell.item.category.name }}
          </button>

          <button
            v-else
            type="button"
            aria-label="Все категории"
            class="category-chip flex min-w-max shrink-0 grow items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-dashed border-border-light px-3 py-1.5 text-sm text-text-tertiary-light transition-[color,background-color,border-color,transform] duration-200 hover:text-text-secondary-light active:scale-95 dark:border-border-dark dark:text-text-tertiary-dark dark:hover:text-text-secondary-dark"
            :style="{ maxWidth: `${cell.maxWidth}px` }"
            @click="sheetOpen = true"
          >
            <UIcon name="apps" size="sm" />
            {{ cell.item.label }}
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
