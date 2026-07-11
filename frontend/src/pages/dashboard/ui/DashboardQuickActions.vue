<script setup lang="ts">
import { computed } from 'vue';
import { UIcon, Skeleton } from '@/shared/ui';
import { formatNumberWithSpaces } from '@/shared/lib/format/currency';
import { useQuickActionLongPress } from '@/features/configure-quick-action';
import { DEFAULT_QUICK_ACTION_CATEGORY } from '@/entities/quick-action';
import { useDashboardContext } from '../model/dashboardContext';
import { quickActionFillStyle, quickActionBadgeStyle } from './compact/constants';

const {
  quickActionSlots,
  quickActionsHidden,
  quickActionsHintDismissed,
  quickActionsLoading,
  categoryMap,
  nav,
  handleQuickActionClick,
  handleQuickActionLongPress,
  dismissQuickActionsHint,
} = useDashboardContext();

const resolvedSlots = computed(() =>
  quickActionSlots.value.map((action) => ({
    action,
    cat: action
      ? (categoryMap.value.get(action.categoryId) ?? DEFAULT_QUICK_ACTION_CATEGORY)
      : DEFAULT_QUICK_ACTION_CATEGORY,
  })),
);

// A wall of identical empty "+" tiles reads as a broken grid — with nothing
// configured we collapse the section into a single setup CTA instead.
const hasConfiguredActions = computed(() => quickActionSlots.value.some(Boolean));

const { onTouchStart, onClick, stopLongPress } = useQuickActionLongPress({
  onLongPress: handleQuickActionLongPress,
  onClick: handleQuickActionClick,
});
</script>

<template>
  <section v-if="!quickActionsHidden">
    <div v-if="quickActionsLoading" class="flex gap-2.5 pb-1 md:grid md:grid-cols-3 md:pb-0">
      <Skeleton
        v-for="i in 4"
        :key="i"
        class="shrink-0 w-[calc((100%-30px)/4)] md:w-auto aspect-square rounded-2xl"
      />
    </div>

    <button
      v-else-if="!hasConfiguredActions"
      type="button"
      class="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl border border-dashed border-border-light dark:border-border-dark text-text-tertiary-light dark:text-text-tertiary-dark hover:text-primary hover:border-primary/40 transition-all duration-200"
      @click="onClick(null)"
    >
      <UIcon name="bolt" size="sm" />
      <span class="text-body-sm font-medium">Настроить быстрые действия</span>
    </button>

    <div
      v-else
      class="flex gap-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 pt-1.5 -mt-1.5 px-1.5 -mx-1.5 md:grid md:grid-cols-3 md:overflow-visible md:pb-0 md:pt-0 md:mt-0 md:px-0 md:mx-0"
    >
      <button
        v-for="({ action, cat }, index) in resolvedSlots"
        :key="action?.id ?? `empty-${index}`"
        :aria-label="
          action
            ? `Добавить расход: ${action.label}`
            : `Настроить быстрое действие, слот ${index + 1}`
        "
        :class="[
          'qa-card-shell relative flex items-end justify-center aspect-square rounded-2xl overflow-hidden group cursor-pointer snap-start shrink-0 w-[calc((100%-30px)/4)] md:w-auto md:shrink select-none',
          action
            ? 'qa-card-filled border-0'
            : 'bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark items-center',
        ]"
        :style="action ? quickActionFillStyle(cat.color) : undefined"
        @click="onClick(action)"
        @contextmenu.prevent="handleQuickActionLongPress(action)"
        @touchstart.passive="onTouchStart(action)"
        @touchend.passive="stopLongPress()"
        @touchmove.passive="stopLongPress()"
      >
        <template v-if="action">
          <div
            class="absolute inset-0 -top-1 flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-active:scale-95"
          >
            <UIcon
              :name="cat.icon"
              size="2xl"
              class="opacity-45 dark:opacity-40"
              :style="{ color: cat.color }"
            />
          </div>

          <span
            v-if="action.amount != null"
            class="absolute top-1.5 right-1.5 z-10 text-caption-xs md:text-caption-sm font-semibold leading-none tabular-nums px-1.5 py-[3px] rounded-md"
            :style="quickActionBadgeStyle(cat.color)"
          >
            {{ formatNumberWithSpaces(action.amount) }}
          </span>

          <span
            class="relative z-10 text-caption md:text-xs font-semibold truncate w-full text-center leading-tight tracking-tight px-1 pb-2.5 md:pb-3 text-text-primary-light dark:text-text-primary-dark"
          >
            {{ action.label }}
          </span>
        </template>

        <template v-else>
          <div class="flex flex-col items-center justify-center gap-1.5 w-full h-full">
            <UIcon
              name="add"
              size="lg"
              class="text-text-tertiary-light dark:text-text-tertiary-dark opacity-40 group-hover:text-primary group-hover:opacity-60 transition-all duration-200"
            />
            <span
              class="text-caption md:text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark group-hover:text-text-secondary-light dark:group-hover:text-text-secondary-dark transition-colors duration-200"
            >
              Добавить
            </span>
          </div>
        </template>
      </button>
    </div>

    <div
      v-if="!quickActionsLoading && !quickActionsHintDismissed && hasConfiguredActions"
      class="mt-3 flex items-start gap-2 px-1"
    >
      <p class="text-caption-xs leading-snug text-text-tertiary-light dark:text-text-tertiary-dark">
        Удерживайте (или правый клик) для редактирования. Настроить или скрыть — в
        <button
          class="underline text-primary hover:text-primary-hover transition-colors"
          @click="nav.toQuickActionsSettings"
        >
          Профиль → Быстрые действия
        </button>
        .
      </p>
      <button
        aria-label="Закрыть подсказку"
        class="shrink-0 p-0.5 rounded text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark transition-colors"
        @click="dismissQuickActionsHint"
      >
        <UIcon name="close" size="xs" />
      </button>
    </div>
  </section>
</template>
