<script setup lang="ts">
import { ref, computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import type { Transaction } from '@/shared/api/database.types';
import type { Category } from '../model/types';
import { getFrequentCategories } from '../model/useFrequentCategories';
import CategoryPickerSheet from './CategoryPickerSheet.vue';

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
