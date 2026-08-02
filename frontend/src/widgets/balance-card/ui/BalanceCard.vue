<script setup lang="ts">
import { computed } from 'vue';
import { UIcon, Skeleton } from '@/shared/ui';
import { formatMasked } from '@/shared/lib/format/currency';

const props = defineProps<{
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

const balanceText = computed(() =>
  formatMasked(props.totalBalance, props.currency, props.hidden ?? false),
);

/**
 * The hero steps down a size at a time as the amount grows, so a balance in
 * millions stays on one line instead of being cut off mid-number.
 * Thresholds are character counts of the formatted string — safe because the
 * hero is set in tabular-nums, where every digit has the same advance.
 */
const balanceSizeClass = computed(() => {
  const len = balanceText.value.length;
  if (len <= 17) return 'text-3xl sm:text-4xl';
  if (len <= 21) return 'text-2xl sm:text-3xl';
  if (len <= 26) return 'text-xl sm:text-2xl';
  return 'text-lg sm:text-xl';
});

/** Rail amounts drop the currency — the hero right above already states it. */
const railAmount = (value: number) =>
  formatMasked(value, props.currency, props.hidden ?? false, { showSymbol: false });

const showRail = computed(() => props.loading || typeof props.avgDailyExpense === 'number');

const railLabel =
  'text-caption-sm font-semibold uppercase tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark';
const railValue = 'mt-0.5 text-sm font-bold tabular-nums truncate';
const railMuted = 'text-text-tertiary-light dark:text-text-tertiary-dark';
</script>

<template>
  <div
    class="morph-border-card balance-card rounded-2xl bg-card-light dark:bg-card-dark shadow-sm hover:shadow-md transition-all duration-300 md:hover:-translate-y-1"
  >
    <div class="relative z-10">
      <!-- Hero: the balance owns a full-width row of its own -->
      <div class="flex items-end justify-between gap-4 p-5 sm:p-6">
        <div class="min-w-0 flex-1">
          <!-- Balance Label + Eye Toggle -->
          <div class="flex items-center gap-2 mb-2">
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
          <Skeleton v-if="loading" class="h-9 w-[220px] max-w-full rounded-xl" />
          <button
            v-else
            type="button"
            aria-label="Перейти к счетам"
            class="group/btn block max-w-full outline-none rounded-xl focus-visible:ring-2 focus-visible:ring-primary"
            @click="$emit('balance-click')"
          >
            <span
              class="block font-extrabold tracking-tight tabular-nums leading-tight truncate text-text-primary-light dark:text-text-primary-dark group-hover/btn:text-primary transition-colors duration-300"
              :class="balanceSizeClass"
            >
              {{ balanceText }}
            </span>
          </button>
        </div>

        <!-- Desktop: 'К счетам' Button -->
        <div class="hidden lg:flex shrink-0">
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

      <!-- Spending metrics rail -->
      <div
        v-if="showRail"
        class="grid grid-cols-3 divide-x divide-border-light dark:divide-border-dark border-t border-border-light dark:border-border-dark"
      >
        <div class="px-2 py-3 text-center">
          <p :class="railLabel">Расход/дн</p>
          <Skeleton v-if="loading" class="h-4 w-14 mx-auto mt-1.5 rounded" />
          <p v-else class="text-warning" :class="railValue">
            {{ railAmount(avgDailyExpense!) }}
          </p>
        </div>

        <div class="px-2 py-3 text-center">
          <p :class="railLabel">Безопасно</p>
          <Skeleton v-if="loading" class="h-4 w-14 mx-auto mt-1.5 rounded" />
          <p
            v-else-if="safeDailyLimit != null"
            :class="[railValue, safeDailyLimit >= 0 ? 'text-success' : 'text-danger']"
          >
            {{ railAmount(safeDailyLimit) }}
          </p>
          <p v-else :class="[railValue, railMuted]">—</p>
        </div>

        <div class="px-2 py-3 text-center">
          <p :class="railLabel">Осталось</p>
          <Skeleton v-if="loading" class="h-4 w-14 mx-auto mt-1.5 rounded" />
          <p
            v-else-if="daysRemaining != null"
            class="text-text-primary-light dark:text-text-primary-dark"
            :class="railValue"
          >
            {{ daysRemaining }} дн
          </p>
          <p v-else :class="[railValue, railMuted]">—</p>
        </div>
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
