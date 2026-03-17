<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue';
import { useSlidingIndicator, buildIndicatorRect } from '@/shared/lib/hooks/useSlidingIndicator';

const props = withDefaults(
  defineProps<{
    items: { id: string; label: string }[];
    modelValue: string | null;
    allLabel?: string;
  }>(),
  { allLabel: 'Все' },
);

const emit = defineEmits<{
  'update:modelValue': [value: string | null];
}>();

const ALL_ID = '__all__';

const containerRef = ref<HTMLElement | null>(null);

// Map null → '__all__' for the indicator
const activeId = computed(() => props.modelValue ?? ALL_ID);

const { setChipRef, indicatorStyle, updateIndicator } = useSlidingIndicator(
  containerRef,
  activeId,
  (containerRect, activeRect, scrollLeft, scrollTop) =>
    buildIndicatorRect(containerRect, activeRect, scrollLeft, scrollTop),
);

watch(
  () => props.items,
  () => nextTick(updateIndicator),
  { deep: true },
);

function selectAll() {
  emit('update:modelValue', null);
}

function selectItem(id: string) {
  emit('update:modelValue', id);
}
</script>

<template>
  <div
    ref="containerRef"
    class="relative flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar"
  >
    <!-- Sliding indicator -->
    <span
      class="absolute rounded-lg pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0 border bg-primary/10 border-primary"
      :style="indicatorStyle"
    />

    <!-- All chip -->
    <button
      :ref="(el) => setChipRef(ALL_ID, el as HTMLElement)"
      type="button"
      :class="[
        'relative z-10 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors duration-300 border',
        modelValue === null
          ? 'text-primary border-transparent'
          : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark',
      ]"
      @click="selectAll"
    >
      {{ allLabel }}
    </button>

    <!-- Item chips -->
    <button
      v-for="item in items"
      :key="item.id"
      :ref="(el) => setChipRef(item.id, el as HTMLElement)"
      type="button"
      :class="[
        'relative z-10 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors duration-300 border',
        modelValue === item.id
          ? 'text-primary border-transparent'
          : 'border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark',
      ]"
      @click="selectItem(item.id)"
    >
      {{ item.label }}
    </button>
  </div>
</template>
