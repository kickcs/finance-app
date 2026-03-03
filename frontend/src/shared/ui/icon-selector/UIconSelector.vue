<script setup lang="ts">
import { ref, watch } from 'vue';
import { UIcon } from '@/shared/ui';
import { useSlidingIndicator, buildIndicatorRect } from '@/shared/lib/hooks/useSlidingIndicator';

const props = defineProps<{
  modelValue: string;
  icons: readonly string[];
  color?: string;
  label?: string;
  maxHeight?: string;
  itemSize?: string;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();

const containerRef = ref<HTMLElement | null>(null);
const { setChipRef, indicatorStyle, updateIndicator } = useSlidingIndicator(
  containerRef,
  () => props.modelValue,
  (containerRect, activeRect, scrollLeft, scrollTop) => ({
    ...buildIndicatorRect(containerRect, activeRect, scrollLeft, scrollTop),
    borderRadius: '0.75rem',
    backgroundColor: props.color ? `${props.color}20` : 'transparent',
    borderColor: props.color || 'var(--color-primary)',
    borderWidth: '2px',
    borderStyle: 'solid',
  }),
);

watch(() => props.color, updateIndicator);
</script>

<template>
  <div class="space-y-3">
    <label
      v-if="label"
      class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
    >
      {{ label }}
    </label>
    <div
      ref="containerRef"
      class="relative flex flex-wrap gap-2"
      :class="maxHeight && 'overflow-y-auto'"
      :style="maxHeight ? { maxHeight } : undefined"
    >
      <!-- Sliding Indicator -->
      <span
        class="absolute pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0"
        :style="indicatorStyle"
      />

      <button
        v-for="icon in icons"
        :key="icon"
        :ref="(el) => setChipRef(icon, el as HTMLElement)"
        type="button"
        :class="[
          'relative z-10 rounded-xl flex items-center justify-center transition-all duration-200',
          'hover:scale-105 active:scale-95',
          itemSize || 'w-12 h-12',
          modelValue !== icon && 'bg-surface-light dark:bg-surface-dark',
        ]"
        @click="$emit('update:modelValue', icon)"
      >
        <UIcon
          :name="icon"
          size="md"
          :style="modelValue === icon ? { color } : undefined"
          :class="modelValue !== icon && 'text-text-secondary-light dark:text-text-secondary-dark'"
        />
      </button>
    </div>
  </div>
</template>
