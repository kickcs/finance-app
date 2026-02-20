<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { UIcon } from '@/shared/ui';
import type { Category } from '@/entities/category';
import { useSlidingIndicator } from '@/shared/lib/hooks/useSlidingIndicator';

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

const containerRef = ref<HTMLElement | null>(null);

const { setChipRef, indicatorStyle, updateIndicator } = useSlidingIndicator(
  containerRef,
  () => props.selectedId,
  (containerRect, activeRect, scrollLeft, scrollTop) => {
    const category = props.categories.find((c) => c.id === props.selectedId);
    return {
      left: `${activeRect.left - containerRect.left + scrollLeft}px`,
      top: `${activeRect.top - containerRect.top + scrollTop}px`,
      width: `${activeRect.width}px`,
      height: `${activeRect.height}px`,
      backgroundColor: category ? `${category.color}15` : 'transparent',
      borderColor: category ? category.color : 'transparent',
    };
  },
);

watch(
  () => props.categories,
  () => nextTick(updateIndicator),
  { deep: true },
);

function getChipStyle(category: Category) {
  if (category.id === props.selectedId) {
    return {
      color: category.color,
      borderColor: 'transparent', // Border handled by indicator
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

    <div
      ref="containerRef"
      class="relative overflow-x-auto no-scrollbar -mx-4 px-4 pb-1"
    >
      <!-- Sliding Indicator -->
      <span
        class="absolute rounded-lg pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0 border"
        :style="indicatorStyle"
      />

      <div class="flex flex-col gap-1.5 w-max">
        <div class="flex gap-1.5">
          <button
            v-for="category in firstRow"
            :key="category.id"
            :ref="(el) => setChipRef(category.id, el as HTMLElement)"
            type="button"
            class="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border active:scale-95 transition-colors duration-300 whitespace-nowrap"
            :class="
              category.id !== selectedId
                ? 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
                : ''
            "
            :style="getChipStyle(category)"
            @click="emit('select', category.id)"
          >
            <UIcon
              :name="category.icon"
              size="sm"
              :style="{ color: category.color }"
            />
            {{ category.name }}
          </button>
        </div>

        <div class="flex gap-1.5">
          <button
            v-for="category in secondRow"
            :key="category.id"
            :ref="(el) => setChipRef(category.id, el as HTMLElement)"
            type="button"
            class="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border active:scale-95 transition-colors duration-300 whitespace-nowrap"
            :class="
              category.id !== selectedId
                ? 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark'
                : ''
            "
            :style="getChipStyle(category)"
            @click="emit('select', category.id)"
          >
            <UIcon
              :name="category.icon"
              size="sm"
              :style="{ color: category.color }"
            />
            {{ category.name }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
