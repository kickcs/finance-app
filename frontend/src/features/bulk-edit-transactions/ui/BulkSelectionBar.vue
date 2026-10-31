<script setup lang="ts">
import { UIcon } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';

defineProps<{
  selectedCount: number;
  selectableCount: number;
  allSelected: boolean;
  /** Готовая строка суммы выбранных; пустая — «Отметьте строки» */
  totalsLabel: string;
}>();

defineEmits<{
  exit: [];
  toggleAll: [];
  category: [];
  transfer: [];
  account: [];
  more: [];
}>();

// Панель всегда тёмная, в обеих темах: у UButton нет варианта для светлой кнопки на тёмном,
// а плитки действий (иконка над подписью) — не кнопка-строка, поэтому классы свои.
const QUIET =
  'inline-flex items-center justify-center text-text-primary-dark transition-colors active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary-dark/80 disabled:pointer-events-none disabled:opacity-40';
const ACTION = cn(
  QUIET,
  'min-h-14 flex-col gap-1 rounded-xl bg-text-primary-dark/10 px-1 py-2 text-xs font-medium hover:bg-text-primary-dark/20',
);
</script>

<template>
  <div data-testid="bulk-selection-bar" class="-mx-2.5 pt-2 pb-2.5">
    <div
      class="flex flex-col gap-2.5 rounded-2xl bg-text-primary-light p-2.5 text-text-primary-dark shadow-lg dark:bg-surface-dark"
    >
      <div class="flex items-center gap-2 pl-0.5">
        <button
          type="button"
          data-testid="bulk-selection-exit"
          aria-label="Закончить выбор"
          :class="
            cn(
              QUIET,
              'size-11 shrink-0 rounded-lg text-text-primary-dark/80 hover:bg-text-primary-dark/10',
            )
          "
          @click="$emit('exit')"
        >
          <UIcon name="close" size="md" />
        </button>

        <div role="status" class="flex min-w-0 flex-1 flex-col">
          <span class="truncate text-xs leading-4 text-text-secondary-dark">
            Выбрано {{ selectedCount }} из {{ selectableCount }}
          </span>
          <span class="truncate text-body-lg leading-6 font-semibold tabular-nums">
            {{ totalsLabel || 'Отметьте строки' }}
          </span>
        </div>

        <button
          type="button"
          data-testid="bulk-selection-toggle-all"
          :disabled="selectableCount === 0"
          :class="
            cn(
              QUIET,
              'h-11 shrink-0 rounded-lg bg-text-primary-dark/15 px-4 text-sm font-semibold hover:bg-text-primary-dark/25',
            )
          "
          @click="$emit('toggleAll')"
        >
          {{ allSelected ? 'Снять все' : 'Все' }}
        </button>
      </div>

      <div class="grid grid-cols-4 gap-1.5">
        <button
          type="button"
          data-testid="bulk-action-category"
          :disabled="selectedCount === 0"
          :class="ACTION"
          @click="$emit('category')"
        >
          <UIcon name="folder" size="md" />
          Категория
        </button>
        <button
          type="button"
          data-testid="bulk-action-transfer"
          :disabled="selectedCount === 0"
          :class="ACTION"
          @click="$emit('transfer')"
        >
          <UIcon name="swap_horiz" size="md" />
          Перевод
        </button>
        <button
          type="button"
          data-testid="bulk-action-account"
          :disabled="selectedCount === 0"
          :class="ACTION"
          @click="$emit('account')"
        >
          <UIcon name="account_balance_wallet" size="md" />
          Счёт
        </button>
        <button
          type="button"
          data-testid="bulk-action-more"
          aria-haspopup="dialog"
          :disabled="selectedCount === 0"
          :class="ACTION"
          @click="$emit('more')"
        >
          <UIcon name="more_horiz" size="md" />
          Ещё
        </button>
      </div>
    </div>
  </div>
</template>
