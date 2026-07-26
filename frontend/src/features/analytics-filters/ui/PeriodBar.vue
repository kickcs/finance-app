<script setup lang="ts">
import { UIcon } from '@/shared/ui';
import { UTabs } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics/haptics';
import type { PeriodScale } from '../model/types';

const props = defineProps<{
  label: string;
  sublabel: string;
  scale: PeriodScale;
  canGoNext: boolean;
  canGoPrev: boolean;
  isCurrentPeriod: boolean;
  /** Сколько счетов выбрано в фильтре; 0 — фильтр не активен. */
  activeFilterCount: number;
  /** Фильтр показывается только когда счетов больше одного. */
  showFilter: boolean;
}>();

const emit = defineEmits<{
  prev: [];
  next: [];
  today: [];
  'update:scale': [value: PeriodScale];
  'open-filter': [];
}>();

const { trigger } = useHaptics();

/**
 * Однобуквенные метки — плата за то, чтобы масштаб, навигация по периоду и
 * фильтр помещались в один ряд. Полные названия остаются в aria-label.
 */
const SCALE_ITEMS = [
  { id: 'day', label: 'Д' },
  { id: 'month', label: 'М' },
  { id: 'year', label: 'Г' },
];

const NAV_BUTTON_CLASS =
  'w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark transition-colors hover:bg-border-light dark:hover:bg-border-dark disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary';

function handlePrev() {
  if (!props.canGoPrev) return;
  trigger('selection');
  emit('prev');
}

function handleNext() {
  if (!props.canGoNext) return;
  trigger('selection');
  emit('next');
}

function handleToday() {
  trigger('selection');
  emit('today');
}
</script>

<template>
  <div class="flex items-center gap-1.5 h-11">
    <button
      :class="NAV_BUTTON_CLASS"
      :disabled="!canGoPrev"
      aria-label="Предыдущий период"
      @click="handlePrev"
    >
      <UIcon name="chevron_left" size="sm" />
    </button>

    <div class="flex-1 min-w-0 text-center select-none">
      <div
        class="text-body-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate"
      >
        {{ label }}
      </div>
      <!-- Для дня метка это «Сегодня»/«12 июля», и дата уточняет её. Для месяца
           и года диапазон дословно повторяет метку, поэтому не рендерится. -->
      <div
        v-if="scale === 'day' && sublabel"
        class="text-caption-sm text-text-tertiary-light dark:text-text-tertiary-dark truncate leading-tight"
      >
        {{ sublabel }}
      </div>
    </div>

    <button
      :class="NAV_BUTTON_CLASS"
      :disabled="!canGoNext"
      aria-label="Следующий период"
      @click="handleNext"
    >
      <UIcon name="chevron_right" size="sm" />
    </button>

    <!-- «Сегодня» занимает место в ряду, а не отдельную строку под ним. -->
    <button
      v-if="!isCurrentPeriod"
      class="w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-primary text-white transition-colors hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label="Вернуться к текущему периоду"
      @click="handleToday"
    >
      <UIcon name="calendar_today" size="sm" />
    </button>

    <!-- 3 таба по 32px + внутренний паддинг списка: уже — и «Г» уезжает под скролл. -->
    <div class="w-[108px] shrink-0">
      <UTabs
        :model-value="scale"
        :items="SCALE_ITEMS"
        size="sm"
        @update:model-value="emit('update:scale', $event as PeriodScale)"
      />
    </div>

    <button
      v-if="showFilter"
      data-testid="account-filter-trigger"
      class="relative w-8 h-8 shrink-0 rounded-full flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      :class="
        activeFilterCount > 0
          ? 'bg-primary/10 text-primary'
          : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark'
      "
      :aria-label="
        activeFilterCount > 0
          ? `Фильтр по счетам, выбрано ${activeFilterCount}`
          : 'Фильтр по счетам'
      "
      @click="emit('open-filter')"
    >
      <UIcon name="tune" size="sm" />
      <span
        v-if="activeFilterCount > 0"
        class="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-white text-caption-xs font-semibold flex items-center justify-center"
      >
        {{ activeFilterCount }}
      </span>
    </button>
  </div>
</template>
