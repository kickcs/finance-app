<script setup lang="ts">
import { ref } from 'vue';
import { UIcon } from '@/shared/ui';
import { useSlidingIndicator, buildIndicatorRect } from '@/shared/lib/hooks/useSlidingIndicator';

const props = defineProps<{
  modelValue: string;
  colors: readonly string[];
  label?: string;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();

const containerRef = ref<HTMLElement | null>(null);
const { setChipRef, indicatorStyle } = useSlidingIndicator(
  containerRef,
  () => props.modelValue,
  (containerRect, activeRect, scrollLeft, scrollTop) => ({
    ...buildIndicatorRect(containerRect, activeRect, scrollLeft, scrollTop),
    borderRadius: '9999px',
    borderColor: props.modelValue,
    borderWidth: '2.5px',
    borderStyle: 'solid',
    // --picker-ring-color switches via scoped CSS below
    boxShadow: '0 0 0 2px var(--picker-ring-color)',
  }),
);
</script>

<template>
  <div class="space-y-3">
    <label
      v-if="label"
      class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
    >
      {{ label }}
    </label>
    <div ref="containerRef" class="color-picker-container relative flex flex-wrap gap-3">
      <!-- Sliding Indicator -->
      <span
        class="absolute pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0"
        :style="indicatorStyle"
      />

      <button
        v-for="color in colors"
        :key="color"
        :ref="(el) => setChipRef(color, el as HTMLElement)"
        type="button"
        :class="[
          'relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200',
          'hover:scale-110 active:scale-95',
        ]"
        :style="{ backgroundColor: color }"
        @click="$emit('update:modelValue', color)"
      >
        <Transition
          enter-active-class="transition-all duration-200"
          enter-from-class="scale-0 opacity-0"
          enter-to-class="scale-100 opacity-100"
          leave-active-class="transition-all duration-150"
          leave-from-class="scale-100 opacity-100"
          leave-to-class="scale-0 opacity-0"
        >
          <UIcon v-if="modelValue === color" name="check" size="sm" class="text-white" />
        </Transition>
      </button>
    </div>
  </div>
</template>

<style scoped>
.color-picker-container {
  --picker-ring-color: var(--color-card-light);
}

:global(.dark) .color-picker-container {
  --picker-ring-color: var(--color-card-dark);
}
</style>
