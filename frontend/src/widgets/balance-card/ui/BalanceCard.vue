<script setup lang="ts">
import { UIcon } from '@/shared/ui';
import { formatCurrency, COMPACT_FORMAT } from '@/shared/lib/format/currency';

defineProps<{
  totalBalance: number;
  currency: string;
  percentChange?: number;
  loading?: boolean;
  hidden?: boolean;
}>();

defineEmits<{
  'income-click': [];
  'expense-click': [];
  'toggle-hidden': [];
}>();
</script>

<template>
  <div class="text-center">
    <!-- Balance Label -->
    <div class="flex items-center justify-center gap-1 mb-2">
      <p
        class="text-body-sm font-medium tracking-wide text-text-secondary-light dark:text-text-secondary-dark"
      >
        Общий баланс
      </p>
      <button
        :aria-label="hidden ? 'Показать баланс' : 'Скрыть баланс'"
        class="p-1 rounded-md text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark transition-colors"
        @click="$emit('toggle-hidden')"
      >
        <UIcon :name="hidden ? 'visibility_off' : 'visibility'" size="xs" />
      </button>
    </div>

    <!-- Loading skeleton -->
    <div
      v-if="loading"
      class="h-12 w-48 mx-auto rounded-lg bg-surface-light dark:bg-surface-dark animate-shimmer mb-3"
    />

    <!-- Balance amount -->
    <Transition
      enter-active-class="transition-opacity duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
    >
      <h1
        v-if="!loading"
        class="text-4xl sm:text-5xl font-bold tracking-tight text-text-primary-light dark:text-text-primary-dark"
      >
        {{
          hidden
            ? '••••••'
            : formatCurrency(totalBalance, currency, COMPACT_FORMAT)
        }}
      </h1>
    </Transition>

    <!-- Trend indicator -->
    <div
      v-if="percentChange !== undefined && !loading && !hidden"
      :class="[
        'inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-xs font-medium',
        percentChange >= 0
          ? 'bg-success-light text-success'
          : 'bg-danger-light text-danger',
      ]"
    >
      <UIcon
        :name="percentChange >= 0 ? 'trending_up' : 'trending_down'"
        size="xs"
      />
      <span
        >{{ percentChange >= 0 ? '+' : '' }}{{ percentChange.toFixed(1) }}% за
        месяц</span
      >
    </div>

    <!-- Quick Action Buttons -->
    <div class="flex gap-3 mt-6">
      <button
        class="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white font-medium text-body-sm hover:bg-primary-hover active:bg-primary-pressed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-all duration-150 shadow-sm"
        @click="$emit('income-click')"
      >
        <UIcon name="add" size="sm" />
        Доход
      </button>

      <button
        class="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark font-medium text-body-sm hover:bg-card-light dark:hover:bg-card-dark active:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-all duration-150"
        @click="$emit('expense-click')"
      >
        <UIcon name="remove" size="sm" />
        Расход
      </button>
    </div>
  </div>
</template>
