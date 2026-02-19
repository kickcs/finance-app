<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import type { Category } from '@/entities/category';

const props = defineProps<{
  categories: Category[];
  selectedId: string;
  label?: string;
}>();

const emit = defineEmits<{
  select: [categoryId: string];
}>();

const firstRow = computed(() =>
  props.categories.slice(0, Math.ceil(props.categories.length / 2)),
);

const secondRow = computed(() =>
  props.categories.slice(Math.ceil(props.categories.length / 2)),
);

function getChipStyle(category: Category) {
  if (category.id === props.selectedId) {
    return {
      borderColor: category.color,
      backgroundColor: `${category.color}15`,
      color: category.color,
    };
  }
  return {};
}
</script>

<template>
  <div>
    <div v-if="label" class="flex items-center gap-1.5 mb-2">
      <span
        class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark"
      >
        {{ label }}
      </span>
      <span
        v-if="!selectedId"
        class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        — выберите
      </span>
    </div>

    <div class="overflow-x-auto no-scrollbar -mx-4 px-4">
      <div class="flex flex-col gap-1.5 w-max">
        <div class="flex gap-1.5">
          <button
            v-for="category in firstRow"
            :key="category.id"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border active:scale-95 transition-all whitespace-nowrap"
            :class="
              category.id !== selectedId
                ? 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark'
                : ''
            "
            :style="getChipStyle(category)"
            @click="emit('select', category.id)"
          >
            <UIcon :name="category.icon" size="sm" :style="{ color: category.color }" />
            {{ category.name }}
          </button>
        </div>

        <div class="flex gap-1.5">
          <button
            v-for="category in secondRow"
            :key="category.id"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border active:scale-95 transition-all whitespace-nowrap"
            :class="
              category.id !== selectedId
                ? 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark'
                : ''
            "
            :style="getChipStyle(category)"
            @click="emit('select', category.id)"
          >
            <UIcon :name="category.icon" size="sm" :style="{ color: category.color }" />
            {{ category.name }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
