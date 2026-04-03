<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics/haptics';
import { formatPercentage } from '@/shared/lib/format/currency';

const props = defineProps<{
  label: string;
  sublabel: string;
  canGoNext: boolean;
  canGoPrev: boolean;
  isCurrentPeriod: boolean;
  comparisonPercent?: number;
  comparisonLoading?: boolean;
}>();

const emit = defineEmits<{
  prev: [];
  next: [];
  today: [];
}>();

const { trigger } = useHaptics();

const comparisonColor = computed(() => {
  if (props.comparisonPercent === undefined) return '';
  return props.comparisonPercent > 0 ? 'text-danger bg-danger/10' : 'text-success bg-success/10';
});

const comparisonText = computed(() =>
  props.comparisonPercent !== undefined ? formatPercentage(props.comparisonPercent, 0, true) : '',
);

function handlePrev() {
  if (props.canGoPrev) {
    trigger('selection');
    emit('prev');
  }
}

function handleNext() {
  if (props.canGoNext) {
    trigger('selection');
    emit('next');
  }
}

function handleToday() {
  trigger('selection');
  emit('today');
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <button
        class="w-8 h-8 rounded-full flex items-center justify-center bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark transition-colors hover:bg-border-light dark:hover:bg-border-dark disabled:opacity-30"
        :disabled="!canGoPrev"
        @click="handlePrev"
      >
        <UIcon name="chevron_left" size="sm" />
      </button>

      <div class="flex-1 text-center select-none">
        <div class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
          {{ label }}
        </div>
        <div
          class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark flex items-center justify-center gap-1.5 mt-0.5"
        >
          <span>{{ sublabel }}</span>
          <span
            v-if="comparisonPercent !== undefined && !comparisonLoading"
            class="inline-block px-1.5 py-0.5 rounded-md text-[10px] font-semibold leading-none"
            :class="comparisonColor"
          >
            {{ comparisonText }}
          </span>
        </div>
      </div>

      <button
        class="w-8 h-8 rounded-full flex items-center justify-center bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark transition-colors hover:bg-border-light dark:hover:bg-border-dark disabled:opacity-30"
        :disabled="!canGoNext"
        @click="handleNext"
      >
        <UIcon name="chevron_right" size="sm" />
      </button>
    </div>

    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div v-if="!isCurrentPeriod" class="flex justify-center">
        <button
          class="px-4 py-1 rounded-full text-xs font-medium bg-primary text-white transition-colors hover:bg-primary/90 active:scale-95"
          @click="handleToday"
        >
          Сегодня
        </button>
      </div>
    </Transition>
  </div>
</template>
