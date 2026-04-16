<script setup lang="ts">
import { computed } from 'vue';
import { UIcon, Skeleton } from '@/shared/ui';
import { formatNumberWithSpaces } from '@/shared/lib/format/currency';
import { useQuickActionLongPress } from '@/features/configure-quick-action';
import { DEFAULT_QUICK_ACTION_CATEGORY } from '@/entities/quick-action';
import { useDashboardContext } from '../../model/dashboardContext';
import { compactQuickActionFillStyle, quickActionBadgeStyle } from './constants';

const {
  quickActionSlots,
  quickActionsLoading,
  categoryMap,
  handleQuickActionClick,
  handleQuickActionLongPress,
} = useDashboardContext();

// Compact grid is a 4-wide row: deliberately a subset of MAX_SLOTS (6) from the standard grid.
// We show only the first four configured actions; the rest stay available in the standard layout.
const COMPACT_QUICK_ACTION_COUNT = 4;

const resolvedSlots = computed(() =>
  quickActionSlots.value.slice(0, COMPACT_QUICK_ACTION_COUNT).map((action) => ({
    action,
    cat: action
      ? (categoryMap.value.get(action.categoryId) ?? DEFAULT_QUICK_ACTION_CATEGORY)
      : DEFAULT_QUICK_ACTION_CATEGORY,
  })),
);

const { onTouchStart, onClick, stopLongPress } = useQuickActionLongPress({
  onLongPress: handleQuickActionLongPress,
  onClick: handleQuickActionClick,
});
</script>

<template>
  <section data-testid="compact-quick-actions" class="grid grid-cols-4 gap-2">
    <template v-if="quickActionsLoading">
      <Skeleton v-for="i in 4" :key="`qa-sk-${i}`" class="aspect-[1.6] rounded-xl" />
    </template>
    <template v-else>
      <button
        v-for="({ action, cat }, index) in resolvedSlots"
        :key="action?.id ?? `empty-${index}`"
        :aria-label="
          action
            ? `Добавить расход: ${action.label}`
            : `Настроить быстрое действие, слот ${index + 1}`
        "
        class="qa-card-shell relative flex flex-col items-center justify-center aspect-[1.6] rounded-xl overflow-hidden group cursor-pointer select-none"
        :class="
          action
            ? 'qa-card-compact-filled'
            : 'bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark'
        "
        :style="action ? compactQuickActionFillStyle(cat.color) : undefined"
        @click="onClick(action)"
        @contextmenu.prevent="handleQuickActionLongPress(action)"
        @touchstart.passive="onTouchStart(action)"
        @touchend.passive="stopLongPress()"
        @touchmove.passive="stopLongPress()"
      >
        <template v-if="action">
          <UIcon :name="cat.icon" size="md" class="mb-0.5" :style="{ color: cat.color }" />
          <span
            class="text-caption-sm font-semibold truncate w-full text-center leading-tight tracking-tight px-1 text-text-primary-light dark:text-text-primary-dark"
          >
            {{ action.label }}
          </span>
          <span
            v-if="action.amount != null"
            class="absolute top-1 right-1 text-[8px] font-semibold leading-none tabular-nums px-1 py-[2px] rounded"
            :style="quickActionBadgeStyle(cat.color)"
          >
            {{ formatNumberWithSpaces(action.amount) }}
          </span>
        </template>
        <template v-else>
          <UIcon
            name="add"
            size="sm"
            class="text-text-tertiary-light dark:text-text-tertiary-dark opacity-50 group-hover:text-primary group-hover:opacity-100 transition-all duration-200"
          />
        </template>
      </button>
    </template>
  </section>
</template>
