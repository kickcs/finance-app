<script setup lang="ts">
import { IconBadge } from '@/shared/ui';
import { formatCurrency, formatShare, COMPACT_BARE_FORMAT } from '@/shared/lib/format/currency';
import type { DonutSegment } from '../../donut-chart/types';

defineProps<{
  segment: DonutSegment;
  currency: string;
  selected?: boolean;
  dimmed?: boolean;
}>();

const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <button
    type="button"
    :data-testid="`category-legend-${segment.id}`"
    class="w-full flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-colors"
    :class="[
      selected
        ? 'bg-surface-light dark:bg-surface-dark'
        : 'active:bg-surface-light dark:active:bg-surface-dark',
      dimmed ? 'opacity-50' : '',
    ]"
    @click="emit('click')"
  >
    <IconBadge v-if="segment.icon" :icon="segment.icon" size="sm" :color="segment.color" />
    <span
      v-else
      class="w-2.5 h-2.5 rounded-full shrink-0"
      :style="{ backgroundColor: segment.color }"
    />

    <!-- Имя отдаёт ширину числам вместо того, чтобы выдавливать их за край. -->
    <span
      class="flex-1 min-w-0 truncate text-body-sm font-medium text-text-primary-light dark:text-text-primary-dark"
    >
      {{ segment.label }}
    </span>

    <span
      class="w-9 shrink-0 text-right text-caption text-text-tertiary-light dark:text-text-tertiary-dark tabular-nums"
    >
      {{ formatShare(segment.percent) }}
    </span>

    <!-- Без символа валюты: она названа в сводке выше, а в каждой строке
         занимала бы ширину, которой не хватало числу. -->
    <span
      class="w-[80px] shrink-0 text-right text-body-sm font-semibold text-text-primary-light dark:text-text-primary-dark tabular-nums"
    >
      {{ formatCurrency(segment.value, currency, COMPACT_BARE_FORMAT) }}
    </span>
  </button>
</template>
