<script setup lang="ts">
import { UIcon, Skeleton } from '@/shared/ui';
import { formatMasked } from '@/shared/lib/format/currency';

defineProps<{
  totalBalance: number;
  currency: string;
  avgDailyExpense?: number | null;
  safeDailyLimit?: number | null;
  daysRemaining?: number;
  loading?: boolean;
  hidden?: boolean;
}>();

defineEmits<{
  'toggle-hidden': [];
  'balance-click': [];
}>();

const metricLabel =
  'text-[0.6rem] font-semibold tracking-wide uppercase text-text-tertiary-light dark:text-text-tertiary-dark';
const metricSub = 'text-[0.6rem] font-medium text-text-tertiary-light dark:text-text-tertiary-dark';
</script>

<template>
  <div
    class="morph-border-card balance-card rounded-2xl bg-card-light dark:bg-card-dark p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300 md:hover:-translate-y-1"
  >
    <div class="relative z-10 flex items-center justify-between gap-4">
      <!-- Left Side: Balance -->
      <div class="flex flex-col min-w-0">
        <!-- Balance Label + Eye Toggle -->
        <div class="flex items-center gap-2 mb-1.5">
          <div
            class="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary"
          >
            <UIcon name="account_balance_wallet" size="xs" />
          </div>
          <p
            class="text-xs font-semibold tracking-wide text-text-secondary-light dark:text-text-secondary-dark uppercase"
          >
            Баланс
          </p>
          <button
            :aria-label="hidden ? 'Показать баланс' : 'Скрыть баланс'"
            class="p-1 rounded-lg text-text-tertiary-light dark:text-text-tertiary-dark hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary-light dark:hover:text-text-primary-dark transition-all duration-200"
            @click.stop="$emit('toggle-hidden')"
          >
            <UIcon :name="hidden ? 'visibility_off' : 'visibility'" size="xs" />
          </button>
        </div>

        <!-- Balance Amount -->
        <Skeleton v-if="loading" class="h-9 w-[180px] rounded-xl" />
        <button
          v-else
          type="button"
          aria-label="Перейти к счетам"
          class="group/btn flex items-center outline-none rounded-xl focus-visible:ring-2 focus-visible:ring-primary"
          @click="$emit('balance-click')"
        >
          <span
            class="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary-light dark:text-text-primary-dark group-hover/btn:text-primary transition-colors duration-300 truncate leading-tight"
          >
            {{ formatMasked(totalBalance, currency, hidden ?? false) }}
          </span>
        </button>
      </div>

      <!-- Divider -->
      <div
        v-if="loading || avgDailyExpense != null"
        class="w-px self-stretch my-1 bg-border-light dark:bg-border-dark"
      />

      <!-- Right Side: Spending Metrics -->
      <div
        v-if="loading || avgDailyExpense != null"
        class="flex flex-col items-end shrink-0 gap-1.5"
      >
        <!-- Loading skeleton -->
        <template v-if="loading">
          <Skeleton class="h-3 w-16 rounded" />
          <Skeleton class="h-5 w-24 rounded-lg" />
          <Skeleton class="h-3 w-16 rounded" />
          <Skeleton class="h-5 w-24 rounded-lg" />
          <Skeleton class="h-2.5 w-20 rounded" />
        </template>

        <!-- Loaded metrics -->
        <template v-else>
          <!-- Average daily expense -->
          <div class="flex flex-col items-end">
            <p :class="metricLabel">Средний расход</p>
            <span class="text-sm font-semibold text-warning/90 leading-tight">
              {{ formatMasked(avgDailyExpense!, currency, hidden ?? false) }}/дн
            </span>
          </div>

          <!-- Safe daily balance -->
          <div v-if="safeDailyLimit != null" class="flex flex-col items-end">
            <p :class="metricLabel">Безопасный остаток</p>
            <span
              class="text-sm font-semibold leading-tight"
              :class="safeDailyLimit >= 0 ? 'text-success/90' : 'text-danger/90'"
            >
              {{ formatMasked(safeDailyLimit, currency, hidden ?? false) }}/дн
            </span>
          </div>

          <span v-if="daysRemaining != null" :class="metricSub">
            осталось {{ daysRemaining }} дн
          </span>
        </template>
      </div>

      <!-- Desktop: 'К счетам' Button -->
      <div class="hidden md:flex shrink-0">
        <button
          type="button"
          aria-label="Перейти ко всем счетам"
          class="group/nav flex items-center gap-2 h-9 text-sm font-semibold text-primary hover:text-primary-hover transition-colors px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20"
          @click="$emit('balance-click')"
        >
          К счетам
          <UIcon
            name="arrow_forward"
            size="sm"
            class="transition-transform group-hover/nav:translate-x-1"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Tune the shared .morph-border-card vars for this widget.
   Keyframes + pseudo-element layout live in app/styles/index.css. */
.balance-card {
  --morph-radius: 1.25rem;
  --morph-blob-size: 85%;
  --morph-blob-blur: 45px;
  --morph-blob-opacity: 0.5;
  --morph-blob-opacity-dark: 0.6;
  --morph-border-inset: 2.5px;
  --morph-border-alpha: 30%;
  --morph-border-alpha-dark: 40%;
}
</style>
